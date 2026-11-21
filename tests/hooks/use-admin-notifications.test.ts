// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

vi.mock("pusher-js", () => {
  const channel = {
    bind_global: vi.fn(),
    unbind_all: vi.fn(),
    unbind_global: vi.fn(),
  };
  const instance = {
    subscribe: vi.fn(() => channel),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  };
  const Pusher = vi.fn(function () { return instance; });
  return { default: Pusher };
});

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

describe("useAdminNotifications", () => {
  const originalKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const originalCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = originalKey;
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = originalCluster;
  });

  it("ne fait rien si la config Pusher est absente", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "";
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(Pusher).not.toHaveBeenCalled();
    unmount();
  });

  it("initialise Pusher et s'abonne au canal admin si config présente", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(Pusher).toHaveBeenCalledWith("test-key", expect.objectContaining({
      cluster: "eu",
      authEndpoint: "/api/pusher/auth",
      authTransport: "ajax",
    }));
    const instance = (Pusher as any).mock.results[0].value;
    expect(instance.subscribe).toHaveBeenCalledWith("private-admin");
    unmount();
  });

  it("nettoie les ressources au démontage", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    const { unmount } = renderHook(() => useAdminNotifications());
    const instance = (Pusher as any).mock.results[0].value;
    const channel = instance.subscribe.mock.results[0].value;
    unmount();
    expect(channel.unbind_all).toHaveBeenCalled();
    expect(channel.unbind_global).toHaveBeenCalled();
    expect(instance.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(instance.disconnect).toHaveBeenCalled();
  });

  it("déclenche un toast pour un événement utilisateur", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    const { unmount } = renderHook(() => useAdminNotifications());
    const instance = (Pusher as any).mock.results[0].value;
    const channel = instance.subscribe.mock.results[0].value;
    // récupérer le callback bind_global
    const bindGlobalCall = channel.bind_global.mock.calls[0];
    const handler = bindGlobalCall[0];
    act(() => {
      handler("user-registered", { message: "hello" });
    });
    expect(toast.success).toHaveBeenCalledWith("Nouvel utilisateur inscrit", expect.objectContaining({ description: "hello" }));
    unmount();
  });
});
