import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    internshipRequest: {
      findMany: db.findMany,
      count: db.count,
      findUnique: db.findUnique,
      update: db.update,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
}));

import { GET, PATCH } from "../../app/api/admin/internships/route";
import {
  GET as GET_DETAIL,
  PATCH as PATCH_DETAIL,
} from "../../app/api/admin/internships/[id]/route";

const admin = { id: "admin-1" };

function callGet(query = "") {
  return GET(new NextRequest(`http://localhost/api/admin/internships${query}`));
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

function callPatchDetail(id: string, body: unknown) {
  return PATCH_DETAIL(
    new NextRequest(`http://localhost/api/admin/internships/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function callGetDetail(id: string) {
  return GET_DETAIL(
    new NextRequest(`http://localhost/api/admin/internships/${id}`),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue(admin as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  db.findMany.mockResolvedValue([{ id: "i1", cvKey: null }] as never);
  db.count.mockResolvedValue(45 as never);
  db.findUnique.mockResolvedValue({
    id: "i1",
    status: "PENDING",
    userId: "user-1",
    position: "Dev",
  } as never);
  db.update.mockResolvedValue({ id: "i1", status: "ACCEPTED" } as never);
});

describe("#267 — GET /api/admin/internships (pagination)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    expect((await callGet()).status).toBe(401);
  });

  it("pagine : take = pageSize, skip = (page - 1) * pageSize", async () => {
    const res = await callGet("?page=3&pageSize=10");
    expect(res.status).toBe(200);
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 }),
    );
  });

  it("défauts : page 1, pageSize 20", async () => {
    const res = await callGet();
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 0 }),
    );
    const body = await res.json();
    expect(body.requests).toHaveLength(1);
    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it("filtre par statut valide", async () => {
    await callGet("?status=REVIEWING");
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "REVIEWING" } }),
    );
    expect(db.count).toHaveBeenCalledWith({ where: { status: "REVIEWING" } });
  });

  it("status=ALL → pas de filtre", async () => {
    await callGet("?status=ALL");
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("400 si le filtre de statut est hors enum", async () => {
    const res = await callGet("?status=CANCELLED");
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_QUERY");
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it("400 si la page est mal formée", async () => {
    expect((await callGet("?page=abc")).status).toBe(400);
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it("pageSize abusif borné à 100", async () => {
    await callGet("?pageSize=9999");
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});

describe("#267 — PATCH /api/admin/internships (statuts + audit)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    expect((await callPatch({ id: "i1", status: "ACCEPTED" })).status).toBe(401);
  });

  it("400 si le statut est hors enum", async () => {
    const res = await callPatch({ id: "i1", status: "SUPPRIME" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_INTERNSHIP_STATUS");
    expect(db.update).not.toHaveBeenCalled();
    expect(deps.createAuditLog).not.toHaveBeenCalled();
  });

  it("404 si la demande n'existe pas", async () => {
    db.findUnique.mockResolvedValue(null as never);
    const res = await callPatch({ id: "inconnue", status: "ACCEPTED" });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("INTERNSHIP_REQUEST_NOT_FOUND");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("400 si la transition est interdite (REJECTED → ACCEPTED)", async () => {
    db.findUnique.mockResolvedValue({
      id: "i1",
      status: "REJECTED",
      userId: "user-1",
      position: "Dev",
    } as never);
    const res = await callPatch({ id: "i1", status: "ACCEPTED" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_INTERNSHIP_STATUS_TRANSITION");
    expect(db.update).not.toHaveBeenCalled();
    expect(deps.createAuditLog).not.toHaveBeenCalled();
  });

  it("PENDING → ACCEPTED : écriture + audit INTERNSHIP_ACCEPTED", async () => {
    const res = await callPatch({ id: "i1", status: "ACCEPTED" });
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { status: "ACCEPTED" },
    });
    expect(deps.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "INTERNSHIP_ACCEPTED",
        resource: "INTERNSHIP_REQUEST",
        resourceId: "i1",
        oldValue: { status: "PENDING" },
        newValue: expect.objectContaining({ status: "ACCEPTED" }),
      }),
    );
  });

  it("REVIEWING → REJECTED : audit INTERNSHIP_REJECTED + notification", async () => {
    db.findUnique.mockResolvedValue({
      id: "i1",
      status: "REVIEWING",
      userId: "user-1",
      position: "Dev",
    } as never);
    db.update.mockResolvedValue({ id: "i1", status: "REJECTED" } as never);
    const res = await callPatch({ id: "i1", status: "REJECTED" });
    expect(res.status).toBe(200);
    expect(deps.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "INTERNSHIP_REJECTED" }),
    );
    expect(deps.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "INTERNSHIP_REJECTED" }),
    );
  });

  it("ACCEPTED → ARCHIVED : audit INTERNSHIP_ARCHIVED", async () => {
    db.findUnique.mockResolvedValue({
      id: "i1",
      status: "ACCEPTED",
      userId: "user-1",
      position: "Dev",
    } as never);
    db.update.mockResolvedValue({ id: "i1", status: "ARCHIVED" } as never);
    const res = await callPatch({ id: "i1", status: "ARCHIVED" });
    expect(res.status).toBe(200);
    expect(deps.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "INTERNSHIP_ARCHIVED" }),
    );
  });

  it("statut identique : no-op (aucune écriture, aucun audit)", async () => {
    db.findUnique.mockResolvedValue({
      id: "i1",
      status: "ACCEPTED",
      userId: "user-1",
      position: "Dev",
    } as never);
    const res = await callPatch({ id: "i1", status: "ACCEPTED" });
    expect(res.status).toBe(200);
    expect(db.update).not.toHaveBeenCalled();
    expect(deps.createAuditLog).not.toHaveBeenCalled();
    expect(deps.createNotification).not.toHaveBeenCalled();
  });
});

describe("#267 — /api/admin/internships/[id]", () => {
  it("GET 404 si la demande n'existe pas", async () => {
    db.findUnique.mockResolvedValue(null as never);
    const res = await callGetDetail("inconnue");
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("INTERNSHIP_REQUEST_NOT_FOUND");
  });

  it("GET renvoie la demande + les transitions autorisées", async () => {
    db.findUnique.mockResolvedValue({
      id: "i1",
      status: "REJECTED",
      cvKey: null,
      cvUrl: null,
    } as never);
    const res = await callGetDetail("i1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("i1");
    expect(body.allowedTransitions.sort()).toEqual(
      ["ARCHIVED", "REJECTED", "REVIEWING"].sort(),
    );
  });

  it("PATCH 400 sur transition interdite", async () => {
    db.findUnique.mockResolvedValue({
      id: "i1",
      status: "ARCHIVED",
      userId: "user-1",
      position: "Dev",
    } as never);
    const res = await callPatchDetail("i1", { status: "PENDING" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_INTERNSHIP_STATUS_TRANSITION");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("PATCH 400 sur statut hors enum", async () => {
    const res = await callPatchDetail("i1", { status: "N_IMPORTE_QUOI" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_INTERNSHIP_STATUS");
    expect(db.findUnique).not.toHaveBeenCalled();
  });

  it("PATCH 404 sur demande inconnue", async () => {
    db.findUnique.mockResolvedValue(null as never);
    const res = await callPatchDetail("inconnue", { status: "REVIEWING" });
    expect(res.status).toBe(404);
  });

  it("PATCH 200 : applique, audite et renvoie les transitions suivantes", async () => {
    const res = await callPatchDetail("i1", { status: "REVIEWING" });
    expect(res.status).toBe(200);
    db.update.mockResolvedValue({ id: "i1", status: "REVIEWING" } as never);
    const body = await res.json();
    expect(body.previousStatus).toBe("PENDING");
    expect(deps.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "INTERNSHIP_STATUS_UPDATED" }),
    );
  });
});
