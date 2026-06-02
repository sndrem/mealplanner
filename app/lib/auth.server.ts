import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import type { Prisma } from "@prisma/client";
import { redirect } from "react-router";

import { db } from "./db.server";
import { createUserSession, getUserId } from "./session.server";

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_PREFIX = "scrypt";
const PASSWORD_KEY_LENGTH = 64;

export const PASSWORD_MIN_LENGTH = 8;

const sessionUserSelect = {
  id: true,
  email: true,
  displayName: true,
  isGlobalAdmin: true,
} satisfies Prisma.UserSelect;

type SessionUser = Prisma.UserGetPayload<{
  select: typeof sessionUserSelect;
}>;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getSafeRedirectTo(value: string | null | undefined, fallback = "/app") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function getLoginRedirectTarget(request: Request) {
  const url = new URL(request.url);
  const redirectTo = `${url.pathname}${url.search}`;

  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;

  return `${PASSWORD_HASH_PREFIX}:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string | null | undefined) {
  if (!passwordHash) {
    return false;
  }

  const [prefix, salt, storedKey] = passwordHash.split(":");

  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !storedKey) {
    return false;
  }

  const storedKeyBuffer = Buffer.from(storedKey, "hex");
  const derivedKey = (await scrypt(password, salt, storedKeyBuffer.length)) as Buffer;

  if (derivedKey.length !== storedKeyBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedKeyBuffer);
}

export async function getCurrentUser(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    return null;
  }

  return db.user.findUnique({
    where: { id: userId },
    select: sessionUserSelect,
  });
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    throw redirect(getLoginRedirectTarget(request));
  }

  return user;
}

export async function requireAnonymous(
  request: Request,
  options?: {
    authenticatedRedirectTo?: string;
  },
) {
  const user = await getCurrentUser(request);

  if (!user) {
    return;
  }

  const authenticatedRedirectTo = options?.authenticatedRedirectTo;
  const url = new URL(request.url);
  const redirectTo = authenticatedRedirectTo
    ? getSafeRedirectTo(authenticatedRedirectTo)
    : getSafeRedirectTo(url.searchParams.get("redirectTo"));

  throw redirect(redirectTo);
}

export async function registerUser({
  email,
  password,
  displayName,
}: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ user: SessionUser } | { error: "EMAIL_TAKEN" }> {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    return { error: "EMAIL_TAKEN" };
  }

  const user = await db.user.create({
    data: {
      email: normalizedEmail,
      displayName: displayName.trim(),
      passwordHash: await hashPassword(password),
    },
    select: sessionUserSelect,
  });

  return { user };
}

export async function loginUser({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      ...sessionUserSelect,
      passwordHash: true,
    },
  });

  if (!user) {
    return null;
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);

  if (!isValidPassword) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isGlobalAdmin: user.isGlobalAdmin,
  } satisfies SessionUser;
}

export async function signInUser({
  request,
  userId,
  redirectTo,
}: {
  request: Request;
  userId: string;
  redirectTo?: string;
}) {
  return createUserSession({
    request,
    userId,
    redirectTo: getSafeRedirectTo(redirectTo),
  });
}
