import { describe, expect, it, vi } from "vitest";

const requestPasswordReset = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { ok: true } }));
const captured = vi.hoisted(() => ({ twoFactorOpts: undefined as undefined | { onTwoFactorRedirect: () => void } }));

vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn(() => ({
    emailOtp: { requestPasswordReset },
    useSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    resetPassword: vi.fn(),
  })),
}));
vi.mock("better-auth/client/plugins", () => ({
  adminClient: vi.fn(() => ({})),
  emailOTPClient: vi.fn(() => ({})),
  twoFactorClient: vi.fn((opts) => {
    captured.twoFactorOpts = opts;
    return {};
  }),
}));

import { forgetPassword } from "@/lib/auth-client";

describe("lib/auth-client", () => {
  it("forgetPassword délègue à emailOtp.requestPasswordReset", async () => {
    const res = await forgetPassword({ email: "a@b.fr" });
    expect(requestPasswordReset).toHaveBeenCalledWith({ email: "a@b.fr" });
    expect(res).toEqual({ data: { ok: true } });
  });

  it("redirige vers la vérification 2FA", () => {
    const loc = { href: "" };
    vi.stubGlobal("window", { location: loc });
    captured.twoFactorOpts!.onTwoFactorRedirect();
    expect(loc.href).toBe("/admin/2fa/verify");
    vi.unstubAllGlobals();
  });
});
