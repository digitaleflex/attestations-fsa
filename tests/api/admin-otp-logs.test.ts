import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  getOTPLogs: vi.fn(),
  clearOTPLogs: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/otp-store", () => ({
  getOTPLogs: deps.getOTPLogs,
  clearOTPLogs: deps.clearOTPLogs,
}));

import { GET, DELETE } from "../../app/api/admin/otp-logs/route";

function callGet() {
  return GET(new NextRequest("http://localhost/api/admin/otp-logs"));
}

function callDelete() {
  return DELETE(
    new NextRequest("http://localhost/api/admin/otp-logs", { method: "DELETE" }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.getOTPLogs.mockReturnValue([
    { email: "a@b.c", otp: "123456", createdAt: Date.now() },
  ] as never);
  deps.clearOTPLogs.mockReturnValue(undefined as never);
});

describe("GET /api/admin/otp-logs (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne les logs avec OTP masqué", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs[0].otp).toBe("12****"); // masqué
  });
});

describe("DELETE /api/admin/otp-logs (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callDelete();
    expect(res.status).toBe(401);
  });

  it("purge les logs", async () => {
    const res = await callDelete();
    expect(res.status).toBe(200);
    expect(deps.clearOTPLogs).toHaveBeenCalled();
  });
});