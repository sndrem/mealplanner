import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, randomBytesMock, sendEmailMock } = vi.hoisted(() => {
  return {
    dbMock: {
      $transaction: vi.fn(),
      passwordResetToken: {
        create: vi.fn(),
        delete: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
    randomBytesMock: vi.fn(),
    sendEmailMock: vi.fn(),
  };
});

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<typeof import("node:crypto")>("node:crypto");

  return {
    ...actual,
    randomBytes: randomBytesMock,
  };
});

vi.mock("./db.server", () => {
  return {
    db: dbMock,
  };
});

vi.mock("./mailer.server", () => {
  return {
    sendEmail: sendEmailMock,
  };
});

import {
  getValidPasswordResetToken,
  hashPasswordResetToken,
  requestPasswordReset,
  resetPasswordWithToken,
} from "./password-reset.server";

const RAW_TOKEN_BYTES = Buffer.alloc(32, 7);
const RAW_TOKEN = RAW_TOKEN_BYTES.toString("hex");
const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

describe("password-reset.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    randomBytesMock.mockReturnValue(RAW_TOKEN_BYTES);
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => unknown) => {
      return callback(dbMock);
    });
  });

  it("hashes reset tokens with SHA-256", () => {
    expect(hashPasswordResetToken(RAW_TOKEN)).toBe(TOKEN_HASH);
  });

  it("does not send mail or write tokens for unknown emails", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);

    await requestPasswordReset({
      email: " Missing@Example.com ",
      origin: "http://localhost:5173",
    });

    expect(dbMock.user.findUnique).toHaveBeenCalledWith({
      select: {
        displayName: true,
        email: true,
        id: true,
      },
      where: { email: "missing@example.com" },
    });
    expect(dbMock.passwordResetToken.findFirst).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("skips a new email when an unused token was created within 15 minutes", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      displayName: "Ola",
      email: "ola@example.com",
      id: "user-1",
    });
    dbMock.passwordResetToken.findFirst.mockResolvedValue({ id: "token-recent" });

    await requestPasswordReset({
      email: "ola@example.com",
      origin: "http://localhost:5173",
    });

    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("stores a hashed token and emails the raw reset link", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      displayName: "Ola",
      email: "ola@example.com",
      id: "user-1",
    });
    dbMock.passwordResetToken.findFirst.mockResolvedValue(null);
    dbMock.passwordResetToken.create.mockResolvedValue({ id: "token-1" });
    sendEmailMock.mockResolvedValue({ delivered: true });

    await requestPasswordReset({
      email: "ola@example.com",
      origin: "http://localhost:5173",
    });

    expect(dbMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      data: {
        usedAt: expect.any(Date),
      },
      where: {
        usedAt: null,
        userId: "user-1",
      },
    });
    expect(dbMock.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        expiresAt: expect.any(Date),
        tokenHash: TOKEN_HASH,
        userId: "user-1",
      },
      select: { id: true },
    });
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Tilbakestill passordet ditt",
        text: expect.stringContaining(`http://localhost:5173/reset-password?token=${RAW_TOKEN}`),
        to: "ola@example.com",
      }),
    );
    expect(dbMock.passwordResetToken.delete).not.toHaveBeenCalled();
  });

  it("deletes the new token when email delivery fails so the user can retry", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      displayName: "Ola",
      email: "ola@example.com",
      id: "user-1",
    });
    dbMock.passwordResetToken.findFirst.mockResolvedValue(null);
    dbMock.passwordResetToken.create.mockResolvedValue({ id: "token-1" });
    sendEmailMock.mockResolvedValue({ delivered: false });

    await requestPasswordReset({
      email: "ola@example.com",
      origin: "http://localhost:5173",
    });

    expect(dbMock.passwordResetToken.delete).toHaveBeenCalledWith({
      where: { id: "token-1" },
    });
  });

  it("rejects missing, used, and expired tokens", async () => {
    expect(await getValidPasswordResetToken("  ")).toBeNull();
    expect(dbMock.passwordResetToken.findUnique).not.toHaveBeenCalled();

    dbMock.passwordResetToken.findUnique.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() + 60_000),
      id: "token-1",
      usedAt: new Date(),
      userId: "user-1",
    });
    await expect(getValidPasswordResetToken(RAW_TOKEN)).resolves.toBeNull();

    dbMock.passwordResetToken.findUnique.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() - 1_000),
      id: "token-1",
      usedAt: null,
      userId: "user-1",
    });
    await expect(getValidPasswordResetToken(RAW_TOKEN)).resolves.toBeNull();
  });

  it("updates the password hash and consumes the token", async () => {
    dbMock.passwordResetToken.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "token-1",
      usedAt: null,
      userId: "user-1",
    });

    await expect(
      resetPasswordWithToken({
        password: "nytt-passord",
        rawToken: RAW_TOKEN,
      }),
    ).resolves.toEqual({ userId: "user-1" });

    expect(dbMock.user.update).toHaveBeenCalledWith({
      data: {
        passwordHash: expect.stringMatching(/^scrypt:/),
      },
      where: { id: "user-1" },
    });
    expect(dbMock.passwordResetToken.update).toHaveBeenCalledWith({
      data: {
        usedAt: expect.any(Date),
      },
      where: { id: "token-1" },
    });
    expect(dbMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      data: {
        usedAt: expect.any(Date),
      },
      where: {
        id: { not: "token-1" },
        usedAt: null,
        userId: "user-1",
      },
    });
  });

  it("does not change the password for an invalid token", async () => {
    dbMock.passwordResetToken.findUnique.mockResolvedValue(null);

    await expect(
      resetPasswordWithToken({
        password: "nytt-passord",
        rawToken: "missing-token",
      }),
    ).resolves.toEqual({ error: "INVALID_TOKEN" });

    expect(dbMock.user.update).not.toHaveBeenCalled();
  });
});
