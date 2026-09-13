import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  internshipFindMany: vi.fn(),
  internshipFindUnique: vi.fn(),
  internshipUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    internshipRequest: {
      findMany: db.internshipFindMany,
      findUnique: db.internshipFindUnique,
      update: db.internshipUpdate,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
}));

import { GET, PATCH } from "../../app/api/admin/internships/route";

function callGet() {
  return GET(new NextRequest("http://localhost/api/admin/internships"));
}

function callPatch(body: unknown) {
  return PATCH(
    new NextRequest("http://localhost/api/admin/internships", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  db.internshipFindMany.mockResolvedValue([{ id: "i1" }] as never);
  db.internshipFindUnique.mockResolvedValue({
    status: "PENDING",
    userId: "user-1",
    fullName: "Alice",
    position: "Dev",
  } as never);
  db.internshipUpdate.mockResolvedValue({ id: "i1", status: "ACCEPTED" } as never);
});

describe("GET /api/admin/internships (#138)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne les demandes de stage", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(db.internshipFindMany).toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/internships (#138)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPatch({ id: "i1", status: "ACCEPTED" });
    expect(res.status).toBe(401);
  });

  it("400 si id ou status manquant", async () => {
    const res = await callPatch({ id: "i1" });
    expect(res.status).toBe(400);
    expect(db.internshipUpdate).not.toHaveBeenCalled();
  });

  it("ACCEPTED → met à jour + notifie le candidat", async () => {
    const res = await callPatch({ id: "i1", status: "ACCEPTED" });
    expect(res.status).toBe(200);
    expect(db.internshipUpdate).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { status: "ACCEPTED" },
    });
    expect(deps.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "INTERNSHIP_ACCEPTED" }),
    );
  });

  it("REJECTED → notifie le rejet", async () => {
    db.internshipUpdate.mockResolvedValue({ id: "i1", status: "REJECTED" } as never);
    const res = await callPatch({ id: "i1", status: "REJECTED" });
    expect(res.status).toBe(200);
    expect(deps.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "INTERNSHIP_REJECTED" }),
    );
  });

  it("statut inchangé → aucune notification", async () => {
    db.internshipFindUnique.mockResolvedValue({
      status: "ACCEPTED",
      userId: "user-1",
      position: "Dev",
    } as never);
    await callPatch({ id: "i1", status: "ACCEPTED" });
    expect(deps.createNotification).not.toHaveBeenCalled();
  });
});