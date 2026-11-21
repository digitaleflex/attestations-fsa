import { beforeEach, describe, expect, it, vi } from "vitest";

const trigger = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("pusher", () => ({
  default: vi.fn().mockImplementation(function () {
    return { trigger };
  }),
}));

import {
  PusherChannels,
  PusherEvents,
  getPusherConfigStatus,
  triggerAdminEvent,
  triggerUserNotification,
} from "@/lib/pusher";

describe("lib/pusher", () => {
  beforeEach(() => {
    trigger.mockClear();
    vi.unstubAllEnvs();
  });

  it("construit les noms de canaux", () => {
    expect(PusherChannels.userNotifications("u1")).toBe("private-user-u1");
    expect(PusherChannels.exam("e1")).toBe("private-exam-e1");
    expect(PusherChannels.attestation("a1")).toBe("private-attestation-a1");
    expect(PusherChannels.admin).toBe("private-admin");
    expect(PusherEvents.notificationCreated).toBe("notification:created");
  });

  it("déclenche une notification utilisateur sur le bon canal", async () => {
    await triggerUserNotification("u1", PusherEvents.notificationCreated, { id: 1 });
    expect(trigger).toHaveBeenCalledWith("private-user-u1", "notification:created", { id: 1 });
  });

  it("déclenche un événement admin", async () => {
    await triggerAdminEvent("evt", { x: 1 });
    expect(trigger).toHaveBeenCalledWith("private-admin", "evt", { x: 1 });
  });

  it("signale les variables manquantes", () => {
    for (const k of ["PUSHER_APP_ID", "PUSHER_KEY", "PUSHER_SECRET", "PUSHER_CLUSTER"]) {
      vi.stubEnv(k, "");
    }
    expect(getPusherConfigStatus()).toEqual({
      configured: false,
      missing: ["PUSHER_APP_ID", "PUSHER_KEY", "PUSHER_SECRET", "PUSHER_CLUSTER"],
    });
    for (const k of ["PUSHER_APP_ID", "PUSHER_KEY", "PUSHER_SECRET", "PUSHER_CLUSTER"]) {
      vi.stubEnv(k, "v");
    }
    expect(getPusherConfigStatus()).toEqual({ configured: true, missing: [] });
  });
});
