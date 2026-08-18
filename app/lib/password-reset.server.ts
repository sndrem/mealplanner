import { createHash, randomBytes } from "node:crypto";

import { hashPassword, normalizeEmail } from "./auth.server";
import { db } from "./db.server";
import { sendEmail } from "./mailer.server";

export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_THROTTLE_MS = 15 * 60 * 1000;

export function hashPasswordResetToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createPasswordResetRawToken() {
  return randomBytes(32).toString("hex");
}

export function buildPasswordResetEmail({
  displayName,
  resetUrl,
}: {
  displayName: string;
  resetUrl: string;
}) {
  const subject = "Tilbakestill passordet ditt";
  const text = [
    `Hei ${displayName},`,
    "",
    "Du ba om å tilbakestille passordet ditt på Mealplanner. Åpne lenken under for å velge et nytt passord. Lenken er gyldig i én time.",
    "",
    resetUrl,
    "",
    "Hvis du ikke ba om dette, kan du se bort fra e-posten.",
  ].join("\n");
  const html = [
    `<p>Hei ${escapeHtml(displayName)},</p>`,
    "<p>Du ba om å tilbakestille passordet ditt på Mealplanner. Åpne lenken under for å velge et nytt passord. Lenken er gyldig i én time.</p>",
    `<p><a href="${escapeHtml(resetUrl)}">Tilbakestill passordet</a></p>`,
    "<p>Hvis du ikke ba om dette, kan du se bort fra e-posten.</p>",
  ].join("");

  return { subject, text, html };
}

export async function requestPasswordReset({
  email,
  origin,
}: {
  email: string;
  origin: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });

  if (!user) {
    return;
  }

  const throttleSince = new Date(Date.now() - PASSWORD_RESET_THROTTLE_MS);
  const recentUnusedToken = await db.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      createdAt: { gte: throttleSince },
    },
    select: { id: true },
  });

  if (recentUnusedToken) {
    return;
  }

  const rawToken = createPasswordResetRawToken();
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  const createdToken = await db.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    return tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
      select: { id: true },
    });
  });

  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const message = buildPasswordResetEmail({
    displayName: user.displayName,
    resetUrl,
  });
  const sendResult = await sendEmail({
    to: user.email,
    ...message,
  });

  if (!sendResult.delivered) {
    await db.passwordResetToken.delete({
      where: { id: createdToken.id },
    });
  }
}

export async function getValidPasswordResetToken(rawToken: string) {
  const trimmedToken = rawToken.trim();

  if (!trimmedToken) {
    return null;
  }

  const token = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashPasswordResetToken(trimmedToken) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!token || token.usedAt || token.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return token;
}

export async function resetPasswordWithToken({
  password,
  rawToken,
}: {
  password: string;
  rawToken: string;
}): Promise<{ userId: string } | { error: "INVALID_TOKEN" }> {
  const token = await getValidPasswordResetToken(rawToken);

  if (!token) {
    return { error: "INVALID_TOKEN" };
  }

  const passwordHash = await hashPassword(password);
  const usedAt = new Date();

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    });
    await tx.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt },
    });
    await tx.passwordResetToken.updateMany({
      where: {
        userId: token.userId,
        usedAt: null,
        id: { not: token.id },
      },
      data: { usedAt },
    });
  });

  return { userId: token.userId };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
