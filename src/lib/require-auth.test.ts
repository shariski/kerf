import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../server/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: vi.fn(() => ({
    headers: new Headers(),
  })),
}))

vi.mock("@tanstack/react-router", () => ({
  redirect: vi.fn((opts) => {
    const err = new Error(`REDIRECT:${opts.to}`)
    ;(err as any).isRedirect = true
    ;(err as any).to = opts.to
    return err
  }),
}))

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("throws a redirect to /login when no session exists", async () => {
    const { auth } = await import("../server/auth")
    const { redirect } = await import("@tanstack/react-router")
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const { requireAuth } = await import("./require-auth")
    await expect(requireAuth()).rejects.toMatchObject({ to: "/login" })
    expect(redirect).toHaveBeenCalledWith({ to: "/login" })
  })

  it("returns the session when authenticated", async () => {
    const { auth } = await import("../server/auth")
    const mockSession = { user: { id: "u1", email: "a@b.com" }, session: { id: "s1" } }
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any)

    const { requireAuth } = await import("./require-auth")
    const result = await requireAuth()
    expect(result).toEqual(mockSession)
  })
})
