import { describe, it, expect } from "vitest"

describe("auth instance", () => {
  it("exports handler and api methods", async () => {
    const { auth } = await import("./auth")
    expect(typeof auth.handler).toBe("function")
    expect(typeof auth.api.getSession).toBe("function")
    expect(typeof auth.api.signOut).toBe("function")
  })
})
