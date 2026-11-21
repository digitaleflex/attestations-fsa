// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

vi.mock("pusher-js", () => {
  const channel = {
    bind_global: vi.fn(),
    unbind_all: vi.fn(),
    unbind_global: vi.fn(),
  };
  const pusher = {
    subscribe: vi.fn(() => channel),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  };
  const Pusher = vi.fn(function () { return pusher; });
  return { default: Pusher, __channel: channel, __pusher: pusher };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import * as PusherNS from "pusher-js";
import { toast } from "sonner";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";

const Pusher = (PusherNS as any).default as ReturnType<typeof vi.fn>;

// Accès aux mocks via le module mocké
const pusherMockModule = PusherNS as any;

function renderHook() {
  let captured: void;
  function Comp() {
    useAdminNotifications();
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Comp));
  });
  return { root, container };
}

describe("useAdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    // reset mock implementations capture
    pusherMockModule.__channel.bind_global.mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  it("ne fait rien sans configuration Pusher", () => {
    const { root, container } = renderHook();
    expect(Pusher).not.toHaveBeenCalled();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("initialise Pusher et s'abonne au canal admin", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    const { root, container } = renderHook();
    expect(Pusher).toHaveBeenCalled();
    const channel = pusherMockModule.__pusher.subscribe.mock.results[0]?.value;
    expect(pusherMockModule.__pusher.subscribe).toHaveBeenCalledWith("private-admin");
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("affiche un toast success pour un événement utilisateur", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    // capture bind_global callback
    let cb: any;
    pusherMockModule.__channel.bind_global.mockImplementation((fn: any) => {
      cb = fn;
    });
    const { root, container } = renderHook();
    expect(typeof cb).toBe("function");
    act(() => {
      cb("user.registered", { message: "Bienvenue" });
    });
    expect(toast.success).toHaveBeenCalled();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("ignore les événements internes pusher:*", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    let cb: any;
    pusherMockModule.__channel.bind_global.mockImplementation((fn: any) => {
      cb = fn;
    });
    const { root, container } = renderHook();
    act(() => {
      cb("pusher:subscription_succeeded", { message: "x" });
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("affiche warning pour action importante et info par défaut", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    let cb: any;
    pusherMockModule.__channel.bind_global.mockImplementation((fn: any) => {
      cb = fn;
    });
    const { root, container } = renderHook();
    act(() => {
      cb("important.action", { message: "msg" });
    });
    expect(toast.warning).toHaveBeenCalled();
    act(() => {
      cb("something.else", { message: "msg2" });
    });
    expect(toast.info).toHaveBeenCalled();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("nettoie (disconnect) au démontage", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    const { root, container } = renderHook();
    act(() => {
      root.unmount();
    });
    expect(pusherMockModule.__pusher.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(pusherMockModule.__pusher.disconnect).toHaveBeenCalled();
    container.remove();
  });
});
