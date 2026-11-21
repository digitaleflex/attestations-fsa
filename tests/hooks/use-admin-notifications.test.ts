// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";

const { pusherInstance, channelInstance, PusherMock } = vi.hoisted(() => {
  const channelInstance = {
    bind_global: vi.fn(),
    unbind_all: vi.fn(),
    unbind_global: vi.fn(),
  };
  const pusherInstance = {
    subscribe: vi.fn(() => channelInstance),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  };
  const PusherMock = vi.fn(function () {
    return pusherInstance;
  });
  return { pusherInstance, channelInstance, PusherMock };
});

vi.mock("pusher-js", () => ({
  default: PusherMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("pusher", () => {
  const Pusher = vi.fn(function () {
    return { trigger: vi.fn().mockResolvedValue(undefined) };
  });
  return { default: Pusher };
});

import { useAdminNotifications } from "@/hooks/use-admin-notifications";
import {
  PusherChannels,
  PusherEvents,
  getPusherConfigStatus,
  triggerUserNotification,
  triggerAdminEvent,
} from "@/lib/pusher";
import { apiFetch, ApiError } from "@/lib/api-client";

describe("useAdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // restore implementations after clearAllMocks
    PusherMock.mockImplementation(function () {
      return pusherInstance;
    });
    pusherInstance.subscribe.mockReturnValue(channelInstance);
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  it("does nothing when Pusher is not configured", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(pusherInstance.subscribe).not.toHaveBeenCalled();
    unmount();
  });

  it("initializes Pusher and subscribes to the admin channel when configured", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());
    expect(pusherInstance.subscribe).toHaveBeenCalledWith("private-admin");
    expect(channelInstance.bind_global).toHaveBeenCalled();
    unmount();
  });

  it("cleans up on unmount", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());
    unmount();
    expect(channelInstance.unbind_all).toHaveBeenCalled();
    expect(pusherInstance.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(pusherInstance.disconnect).toHaveBeenCalled();
  });
});

describe("lib/pusher helpers", () => {
  it("builds channel names", () => {
    expect(PusherChannels.userNotifications("u1")).toBe("private-user-u1");
    expect(PusherChannels.exam("e1")).toBe("private-exam-e1");
    expect(PusherChannels.attestation("a1")).toBe("private-attestation-a1");
    expect(PusherChannels.admin).toBe("private-admin");
  });

  it("exposes standard events", () => {
    expect(PusherEvents.notificationCreated).toBe("notification:created");
  });

  it("reports missing config", () => {
    const prev = process.env.PUSHER_APP_ID;
    delete process.env.PUSHER_APP_ID;
    const status = getPusherConfigStatus();
    expect(status.configured).toBe(false);
    expect(status.missing).toContain("PUSHER_APP_ID");
    if (prev) process.env.PUSHER_APP_ID = prev;
  });

  it("triggers user and admin events", async () => {
    await triggerUserNotification("u1", "evt", { ok: true });
    await triggerAdminEvent("evt", { ok: true });
    // no throw
  });
});

describe("lib/api-client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed data on success", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
    });
    const data = await apiFetch("/api/x");
    expect(data).toEqual({ ok: true });
  });

  it("throws ApiError on failure", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      json: async () => ({ message: "bad" }),
    });
    await expect(apiFetch("/api/x", {}, false)).rejects.toBeInstanceOf(ApiError);
  });
});