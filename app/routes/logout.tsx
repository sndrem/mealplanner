import { redirect } from "react-router";

import type { Route } from "./+types/logout";
import { destroyUserSession } from "../lib/session.server";

export async function loader() {
  throw redirect("/");
}

export async function action({ request }: Route.ActionArgs) {
  return destroyUserSession({ request });
}

export default function LogoutRoute() {
  return null;
}
