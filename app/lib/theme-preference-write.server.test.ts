import { afterEach, describe, expect, it, vi } from "vitest";

const { dbMock, getUserIdMock } = vi.hoisted(() => ({
  dbMock: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  getUserIdMock: vi.fn(),
}));

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./session.server", () => ({
  getUserId: getUserIdMock,
}));

import {
  getRequestThemePreference,
  updateUserThemePreference,
} from "./theme-preference-write.server";

describe("theme-preference-write.server", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates the user theme preference", async () => {
    dbMock.user.update.mockResolvedValue({ id: "user-1", themePreference: "DARK" });

    const result = await updateUserThemePreference({
      themePreference: "DARK",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
      themePreference: "DARK",
    });
    expect(dbMock.user.update).toHaveBeenCalledWith({
      data: {
        themePreference: "DARK",
      },
      where: {
        id: "user-1",
      },
    });
  });

  it("rejects invalid preferences", async () => {
    const result = await updateUserThemePreference({
      themePreference: "INVALID" as never,
      userId: "user-1",
    });

    expect(result).toEqual({
      formError: "Ugyldig utseende.",
      status: "VALIDATION_ERROR",
    });
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("returns system for anonymous requests", async () => {
    getUserIdMock.mockResolvedValue(null);

    await expect(
      getRequestThemePreference(new Request("http://localhost/login")),
    ).resolves.toBe("SYSTEM");
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns the stored preference for a signed-in user", async () => {
    getUserIdMock.mockResolvedValue("user-1");
    dbMock.user.findUnique.mockResolvedValue({ themePreference: "LIGHT" });

    await expect(
      getRequestThemePreference(new Request("http://localhost/app")),
    ).resolves.toBe("LIGHT");
  });
});
