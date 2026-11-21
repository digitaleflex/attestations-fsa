// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("pusher-js", () => ({
  default: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import Pusher from "pusher-js";
import { toast } from "sonner";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";

const PusherMock = Pusher as unknown as ReturnType<typeof vi.fn>;

describe("useAdminNotifications", () => {
  let channelMock: {
    bind_global: ReturnType<typeof vi.fn>;
    unbind_all: ReturnType<typeof vi.fn>;
    unbind_global: ReturnType<typeof vi.fn>;
  };
  let pusherInstance: {
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    channelMock = {
      bind_global: vi.fn(),
      unbind_all: vi.fn(),
      unbind_global: vi.fn(),
    };
    pusherInstance = {
      subscribe: vi.fn(() => channelMock),
      unsubscribe: vi.fn(),
      disconnect: vi.fn(),
    };
    PusherMock.mockImplementation(function () { return pusherInstance as any; });
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  it("does nothing when Pusher env vars are missing", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(PusherMock).not.toHaveBeenCalled();
    unmount();
  });

  it("initializes Pusher when env vars are present", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(PusherMock).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({ cluster: "eu" }),
    );
    expect(pusherInstance.subscribe).toHaveBeenCalledWith("private-admin");
    unmount();
  });

  it("cleans up on unmount", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    const { unmount } = renderHook(() => useAdminNotifications());
    unmount();
    expect(channelMock.unbind_all).toHaveBeenCalled();
    expect(channelMock.unbind_global).toHaveBeenCalled();
    expect(pusherInstance.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(pusherInstance.disconnect).toHaveBeenCalled();
  });

  it("shows a success toast for user events", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    let captured: ((eventName: string, data: any) => void) | undefined;
    channelMock.bind_global.mockImplementation((cb: any) => {
      captured = cb;
    });

    const { unmount } = renderHook(() => useAdminNotifications());
    expect(captured).toBeDefined();
    captured!("user-registered", { message: "new user" });
    expect(toast.success).toHaveBeenCalledWith(
      "Nouvel utilisateur inscrit",
      expect.objectContaining({ description: "new user" }),
    );
    unmount();
  });

  it("shows a warning toast for important events", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    let captured: ((eventName: string, data: any) => void) | undefined;
    channelMock.bind_global.mockImplementation((cb: any) => {
      captured = cb;
    });

    const { unmount } = renderHook(() => useAdminNotifications());
    captured!("important-action", { title: "do it" });
    expect(toast.warning).toHaveBeenCalledWith(
      "Action importante",
      expect.objectContaining({ description: "do it" }),
    );
    unmount();
  });

  it("shows an info toast for other events", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    let captured: ((eventName: string, data: any) => void) | undefined;
    channelMock.bind_global.mockImplementation((cb: any) => {
      captured = cb;
    });

    const { unmount } = renderHook(() => useAdminNotifications());
    captured!("something-happened", { description: "desc" });
    expect(toast.info).toHaveBeenCalledWith("desc");
    unmount();
  });

  it("ignores pusher: internal events", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    let captured: ((eventName: string, data: any) => void) | undefined;
    channelMock.bind_global.mockImplementation((cb: any) => {
      captured = cb;
    });

    const { unmount } = renderHook(() => useAdminNotifications());
    captured!("pusher:connection_established", { message: "x" });
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    unmount();
  });
});
