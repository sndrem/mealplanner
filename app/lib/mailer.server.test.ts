import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTransportMock, envMock, sendMailMock } = vi.hoisted(() => {
  const sendMail = vi.fn();

  return {
    createTransportMock: vi.fn(() => {
      return {
        sendMail,
      };
    }),
    envMock: {
      EMAIL_FROM: undefined as string | undefined,
      SMTP_HOST: undefined as string | undefined,
      SMTP_PASS: undefined as string | undefined,
      SMTP_PORT: undefined as number | undefined,
      SMTP_USER: undefined as string | undefined,
    },
    sendMailMock: sendMail,
  };
});

vi.mock("./env.server", () => {
  return {
    env: envMock,
  };
});

vi.mock("nodemailer", () => {
  return {
    default: {
      createTransport: createTransportMock,
    },
  };
});

import { sendEmail } from "./mailer.server";

describe("mailer.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.EMAIL_FROM = undefined;
    envMock.SMTP_HOST = undefined;
    envMock.SMTP_PASS = undefined;
    envMock.SMTP_PORT = undefined;
    envMock.SMTP_USER = undefined;
  });

  it("logs the email and skips SMTP when host credentials are unset", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      sendEmail({
        html: "<p>Hello</p>",
        subject: "Reset",
        text: "Hello https://example.com/reset-password?token=abc",
        to: "ola@example.com",
      }),
    ).resolves.toEqual({ delivered: true });

    expect(createTransportMock).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      "[mailer] Email not sent (SMTP is unset).",
      expect.objectContaining({
        subject: "Reset",
        text: "Hello https://example.com/reset-password?token=abc",
        to: "ola@example.com",
      }),
    );

    infoSpy.mockRestore();
  });

  it("sends through SMTP when host, user, and password are set", async () => {
    envMock.SMTP_HOST = "smtp.gmail.com";
    envMock.SMTP_PORT = 587;
    envMock.SMTP_USER = "mealplanner@gmail.com";
    envMock.SMTP_PASS = "app-password";
    envMock.EMAIL_FROM = "Mealplanner <mealplanner@gmail.com>";
    sendMailMock.mockResolvedValue({ messageId: "email-1" });

    await expect(
      sendEmail({
        html: "<p>Hello</p>",
        subject: "Reset",
        text: "Hello",
        to: "ola@example.com",
      }),
    ).resolves.toEqual({ delivered: true });

    expect(createTransportMock).toHaveBeenCalledWith({
      auth: {
        pass: "app-password",
        user: "mealplanner@gmail.com",
      },
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
    });
    expect(sendMailMock).toHaveBeenCalledWith({
      from: "Mealplanner <mealplanner@gmail.com>",
      html: "<p>Hello</p>",
      subject: "Reset",
      text: "Hello",
      to: "ola@example.com",
    });
  });

  it("returns undelivered when SMTP send throws", async () => {
    envMock.SMTP_HOST = "smtp.gmail.com";
    envMock.SMTP_USER = "mealplanner@gmail.com";
    envMock.SMTP_PASS = "app-password";
    sendMailMock.mockRejectedValue(new Error("invalid login"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      sendEmail({
        html: "<p>Hello</p>",
        subject: "Reset",
        text: "Hello",
        to: "ola@example.com",
      }),
    ).resolves.toEqual({ delivered: false });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
