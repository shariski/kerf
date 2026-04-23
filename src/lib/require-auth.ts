import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "../server/auth";

export const getAuthSession = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  return auth.api.getSession({ headers: request.headers });
});

export async function requireAuth() {
  const session = await getAuthSession();
  if (!session) throw redirect({ to: "/login" });
  return session;
}
