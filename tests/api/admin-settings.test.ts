import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  settingsFindFirst: vi.fn(),
  settingsCreate: vi.fn(),
  settingsUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    settings: {
      findFirst: db.settingsFindFirst,
      create: db.settingsCreate,
      update: db.settingsUpdate,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: deps.applyRateLimit,
}));

import { GET, PATCH } from "../../app/api/admin/settings/route";

function callGet() {
  return GET(new Request("http://localhost/api/admin/settings"));
}

function callPatch(body: unknown) {
  return PATCH(
    new NextRequest("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.applyRateLimit.mockResolvedValue({ success: true } as never);
});

describe("GET /api/admin/settings (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne les settings existants", async () => {
    db.settingsFindFirst.mockResolvedValue({
      id: "settings-1",
      institutionName: "FSA",
    } as never);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.institutionName).toBe("FSA");
  });

  it("crée des settings par défaut si absents", async () => {
    db.settingsFindFirst.mockResolvedValue(null as never);
    db.settingsCreate.mockResolvedValue({ id: "settings-new" } as never);
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(db.settingsCreate).toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/settings (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPatch({ institutionName: "FSA 2" });
    expect(res.status).toBe(401);
  });

  it("met à jour les settings + audit", async () => {
    db.settingsFindFirst.mockResolvedValue({ id: "settings-1" } as never);
    db.settingsUpdate.mockResolvedValue({
      id: "settings-1",
      institutionName: "FSA 2",
    } as never);
    const res = await callPatch({ id: "settings-1", institutionName: "FSA 2" });
    expect(res.status).toBe(200);
    expect(db.settingsUpdate).toHaveBeenCalled();
    expect(deps.createAuditLog).toHaveBeenCalled();
  });
});