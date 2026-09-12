import { vi, describe, it, expect } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    report: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  },
  rawPrisma: {} as never,
}));

import { POST } from "../../app/api/signalement/route";
import { makeRequest } from "../helpers/request";

describe("POST /api/signalement", () => {
  it("refuse un signalement sans motif", async () => {
    const res = await POST(makeRequest({ message: "test" }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Entrée invalide");
    expect(data.details).toBeDefined();
  });

  it("accepte un signalement valide", async () => {
    const res = await POST(makeRequest({ motif: "bug", message: "test" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
