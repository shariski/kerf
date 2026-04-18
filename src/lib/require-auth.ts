import { redirect } from "@tanstack/react-router"
import { getRequest } from "@tanstack/react-start/server"
import { auth } from "../server/auth"

export async function requireAuth() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!session) throw redirect({ to: "/login" as any })
  return session
}
