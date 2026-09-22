import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * On isole la couche notifications : Prisma et Pusher sont entièrement mockés.
 * Aucune écriture DB ni émission temps réel réelle ne doit se produire.
 */
const mocks = vi.hoisted(() => ({
  notificationCreate: vi.fn(),
  userFindMany: vi.fn(),
  trigger: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { create: mocks.notificationCreate },
    user: { findMany: mocks.userFindMany },
  },
}));

vi.mock("@/lib/pusher", () => ({
  pusherServer: { trigger: mocks.trigger },
}));

vi.mock("@prisma/client", () => ({
  NotificationType: {
    ATTESTATION_VALIDATED: "ATTESTATION_VALIDATED",
    ATTESTATION_REJECTED: "ATTESTATION_REJECTED",
    EXAM_RESULT_PUBLISHED: "EXAM_RESULT_PUBLISHED",
    INTERNSHIP_ACCEPTED: "INTERNSHIP_ACCEPTED",
    INTERNSHIP_REJECTED: "INTERNSHIP_REJECTED",
    CORRECTION_APPROVED: "CORRECTION_APPROVED",
    CORRECTION_REJECTED: "CORRECTION_REJECTED",
    SUPPORT_REPLY: "SUPPORT_REPLY",
    GENERAL: "GENERAL",
  },
  Prisma: {},
}));

import {
  createNotification,
  createNotificationsBatch,
  notifyAllAdmins,
} from "@/lib/notifications";
import { NotificationType } from "@prisma/client";

type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
};

function baseInput(overrides: Partial<NotificationInput> = {}): NotificationInput {
  return {
    userId: "user-1",
    type: NotificationType.GENERAL,
    title: "Titre",
    message: "Message",
    ...overrides,
  };
}

const CREATED = {
  id: "notif-1",
  userId: "user-1",
  type: "GENERAL",
  title: "Titre",
  message: "Message",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.trigger.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createNotification", () => {
  it("crée la notification et déclenche l'événement Pusher sur le bon channel/event", async () => {
    mocks.notificationCreate.mockResolvedValue(CREATED);

    const result = await createNotification(baseInput({ link: "/dashboard" }));

    expect(result).toBe(CREATED);
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "GENERAL",
        title: "Titre",
        message: "Message",
        link: "/dashboard",
        metadata: undefined,
      },
    });
    expect(mocks.trigger).toHaveBeenCalledWith(
      "user-user-1",
      "notification",
      CREATED,
    );
  });

  it("normalise link/metadata absents en undefined", async () => {
    mocks.notificationCreate.mockResolvedValue(CREATED);

    await createNotification(baseInput());

    const arg = mocks.notificationCreate.mock.calls[0][0] as {
      data: { link: unknown; metadata: unknown };
    };
    expect(arg.data.link).toBeUndefined();
    expect(arg.data.metadata).toBeUndefined();
  });

  it("transmet metadata quand fourni", async () => {
    mocks.notificationCreate.mockResolvedValue(CREATED);

    await createNotification(
      baseInput({ metadata: { examId: "exam-1" } } as Partial<NotificationInput>),
    );

    const arg = mocks.notificationCreate.mock.calls[0][0] as {
      data: { metadata: unknown };
    };
    expect(arg.data.metadata).toEqual({ examId: "exam-1" });
  });

  it("retourne null et n'émet rien si la création Prisma échoue", async () => {
    mocks.notificationCreate.mockRejectedValue(new Error("DB down"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createNotification(baseInput());

    expect(result).toBeNull();
    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith("[NOTIFICATION ERROR]", expect.any(Error));
  });

  it("mode dégradé : un Pusher indisponible fait retourner null sans propager l'erreur", async () => {
    // PUSHER_* manquants en prod => `trigger` échoue : la notification est
    // bien écrite en base mais la fonction renvoie null (perte silencieuse).
    mocks.notificationCreate.mockResolvedValue(CREATED);
    mocks.trigger.mockRejectedValue(new Error("Pusher credentials missing"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createNotification(baseInput());

    expect(result).toBeNull();
    expect(mocks.notificationCreate).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith("[NOTIFICATION ERROR]", expect.any(Error));
  });
});

describe("createNotificationsBatch", () => {
  it("retourne un tableau vide sans appel pour une entrée vide", async () => {
    const result = await createNotificationsBatch([]);

    expect(result).toEqual([]);
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it("filtre les créations en échec (valeurs falsy)", async () => {
    mocks.notificationCreate
      .mockResolvedValueOnce({ ...CREATED, id: "notif-1" })
      .mockRejectedValueOnce(new Error("DB down"))
      .mockResolvedValueOnce({ ...CREATED, id: "notif-3" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createNotificationsBatch([
      baseInput({ userId: "user-1" }),
      baseInput({ userId: "user-2" }),
      baseInput({ userId: "user-3" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((n) => (n as { id: string }).id)).toEqual([
      "notif-1",
      "notif-3",
    ]);
  });
});

describe("notifyAllAdmins", () => {
  it("cible les admins (insensible à la casse) et notifie chacun", async () => {
    mocks.userFindMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);
    mocks.notificationCreate.mockResolvedValue(CREATED);

    const result = await notifyAllAdmins({
      type: NotificationType.SUPPORT_REPLY,
      title: "Réclamation",
      message: "Traitée",
    });

    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: { role: { equals: "admin", mode: "insensitive" } },
      select: { id: true },
    });
    expect(mocks.notificationCreate).toHaveBeenCalledTimes(2);
    expect(mocks.trigger).toHaveBeenCalledWith("user-admin-1", "notification", CREATED);
    expect(mocks.trigger).toHaveBeenCalledWith("user-admin-2", "notification", CREATED);
    expect(result).toHaveLength(2);
  });

  it("retourne un tableau vide et n'écrit rien sans admin", async () => {
    mocks.userFindMany.mockResolvedValue([]);

    const result = await notifyAllAdmins({
      type: NotificationType.GENERAL,
      title: "T",
      message: "M",
    });

    expect(result).toEqual([]);
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it("retourne un tableau vide si la recherche des admins échoue", async () => {
    mocks.userFindMany.mockRejectedValue(new Error("DB down"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await notifyAllAdmins({
      type: NotificationType.GENERAL,
      title: "T",
      message: "M",
    });

    expect(result).toEqual([]);
    expect(errorLog).toHaveBeenCalledWith("[NOTIFY_ADMINS ERROR]", expect.any(Error));
  });
});
