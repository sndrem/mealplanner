import { createCookieSessionStorage, redirect } from "react-router";

import { env } from "./env.server";

const USER_SESSION_KEY = "userId";

export const sessionStorage = createCookieSessionStorage<{ userId: string }>({
  cookie: {
    name: "__mealplanner_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secrets: [env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request) {
  const session = await getSession(request);
  const userId = session.get(USER_SESSION_KEY);

  return typeof userId === "string" ? userId : null;
}

export async function createUserSession({
  request,
  userId,
  redirectTo = "/app",
}: {
  request: Request;
  userId: string;
  redirectTo?: string;
}) {
  const session = await getSession(request);

  session.set(USER_SESSION_KEY, userId);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function destroyUserSession({
  request,
  redirectTo = "/",
}: {
  request: Request;
  redirectTo?: string;
}) {
  const session = await getSession(request);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
