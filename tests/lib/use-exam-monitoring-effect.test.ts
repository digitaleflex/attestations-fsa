// @vitest-environment jsdom
/**
 * Non-régression de l'issue #220.
 *
 * La page d'examen entrait dans une boucle infinie parce que `onEnforcement`
 * (prop inline, recréée à chaque rendu du parent) figurait dans les dépendances
 * de l'effet de surveillance. Chaque rendu démontait/remontait l'effet, ce qui
 * relançait `requestFullscreen()` ; en l'absence d'activation utilisateur, la
 * promesse rejetait, poussait un événement, provoquait un nouveau rendu, etc.
 *
 * Ces tests exécutent le hook dans un vrai DOM (React 19 + jsdom) et prouvent :
 *  1. un `requestFullscreen` rejeté ne boucle pas (rendus/appels bornés) ;
 *  2. il n'incrémente aucun compteur suspect et n'émet aucune requête ;
 *  3. une vraie violation continue d'appeler `onEnforcement` (sémantique) ;
 *  4. un callback non mémoïsé ne fait plus rejouer l'effet ;
 *  5. une sortie RÉELLE du plein écran reste signalée (anti-triche préservé).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { EnforcementAction } from "@/lib/exam-enforcement";
import {
  useExamMonitoring,
  type MonitoringEvent,
  type MonitoringState,
} from "@/lib/useExamMonitoring";

// Requis par `act()` de React 19 hors infrastructure de test dédiée.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HookApi = ReturnType<typeof useExamMonitoring>;
type MutableBox = { current: HookApi };

interface HookProps {
  examId?: string;
  userId?: string;
  maxTabSwitches?: number;
  onViolation?: (event: MonitoringEvent, state: MonitoringState) => void;
  onEnforcement?: (action: EnforcementAction) => void;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function Probe({ box, ...props }: HookProps & { box: MutableBox }): null {
  box.current = useExamMonitoring({
    examId: props.examId ?? "exam-1",
    userId: props.userId ?? "user-1",
    maxTabSwitches: props.maxTabSwitches,
    onViolation: props.onViolation,
    onEnforcement: props.onEnforcement,
  });
  return null;
}

function renderHook(
  props: HookProps = {},
  options: { strict?: boolean } = {},
): {
  box: MutableBox;
  rerender: (next?: HookProps) => void;
} {
  const box: MutableBox = { current: undefined as unknown as HookApi };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  const element = createElement(Probe, { ...props, box });
  act(() => {
    root!.render(options.strict ? createElement(StrictMode, null, element) : element);
  });

  return {
    box,
    rerender(next: HookProps = props) {
      const nextElement = createElement(Probe, { ...next, box });
      act(() => {
        root!.render(options.strict ? createElement(StrictMode, null, nextElement) : nextElement);
      });
    },
  };
}

/** Remplace `requestFullscreen` par un double contrôlable. */
function stubRequestFullscreen(
  implementation: () => Promise<void>,
): ReturnType<typeof vi.fn> {
  const mock = vi.fn(implementation);
  Object.defineProperty(document.documentElement, "requestFullscreen", {
    configurable: true,
    writable: true,
    value: mock,
  });
  return mock;
}

function stubFetch(response: unknown): ReturnType<typeof vi.fn> {
  const mock = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
  }
  root = null;
  container?.remove();
  container = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useExamMonitoring — régression #220", () => {
  it("un échec de requestFullscreen ne boucle pas (rendus et appels bornés)", async () => {
    const requestFullscreen = stubRequestFullscreen(() =>
      Promise.reject(
        new TypeError(
          "Failed to execute 'requestFullscreen': API can only be initiated by a user gesture.",
        ),
      ),
    );
    const fetchSpy = stubFetch({ ok: true, json: async () => ({}) });

    let renders = 0;
    const box: MutableBox = { current: undefined as unknown as HookApi };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    function CountingProbe(): null {
      renders += 1;
      box.current = useExamMonitoring({
        examId: "exam-1",
        userId: "user-1",
        // Callback inline, recréé à chaque rendu : c'est le déclencheur du bug.
        onEnforcement: () => {},
      });
      return null;
    }

    await act(async () => {
      root!.render(createElement(CountingProbe));
    });
    // Laisse tourner un éventuel cycle de rejet/re-rendu.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(renders, "l'effet ne doit pas se rejouer en boucle").toBeLessThanOrEqual(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("un échec de requestFullscreen n'incrémente pas les compteurs suspects ni ne requête le monitoring", async () => {
    vi.useFakeTimers();
    stubRequestFullscreen(() =>
      Promise.reject(new TypeError("API can only be initiated by a user gesture.")),
    );
    const fetchSpy = stubFetch({ ok: true, json: async () => ({}) });

    const { box } = renderHook({ onEnforcement: () => {} });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(box.current.totalSuspiciousEvents).toBe(0);
    expect(box.current.events).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("une vraie violation appelle toujours onEnforcement (la ref préserve la sémantique)", async () => {
    vi.useFakeTimers();
    stubRequestFullscreen(() => Promise.resolve());
    const enforcement: EnforcementAction = {
      lockAnswers: false,
      forceSubmit: false,
      warnUser: true,
      reason: "Triche détectée",
    };
    const fetchSpy = stubFetch({ ok: true, json: async () => ({ enforcement }) });
    const onEnforcement = vi.fn();

    const { box } = renderHook({ onEnforcement });

    await act(async () => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(box.current.totalSuspiciousEvents).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(onEnforcement).toHaveBeenCalledWith(enforcement);
  });

  it("un callback non mémoïsé ne fait plus rejouer l'effet", () => {
    const requestFullscreen = stubRequestFullscreen(() => Promise.resolve());
    stubFetch({ ok: true, json: async () => ({}) });

    const { rerender } = renderHook({ onEnforcement: () => {} });
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    // Simule un rendu du parent avec une NOUVELLE identité de callback.
    rerender({ onEnforcement: () => {} });
    rerender({ onEnforcement: () => {} });

    expect(requestFullscreen, "l'effet ne doit pas se remonter à chaque rendu").toHaveBeenCalledTimes(1);
  });

  it("une sortie réelle du plein écran reste signalée (anti-triche préservé)", async () => {
    // L'entrée en plein écran réussit : le candidat est bien en plein écran.
    stubRequestFullscreen(() => Promise.resolve());
    stubFetch({ ok: true, json: async () => ({}) });

    const { box } = renderHook({ onEnforcement: () => {} });

    // Laisse `requestFullscreen()` se résoudre : le candidat est bien entré
    // en plein écran avant d'en sortir.
    await act(async () => {
      await Promise.resolve();
    });

    // L'utilisateur quitte réellement le plein écran (Échap, etc.).
    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(box.current.totalSuspiciousEvents).toBe(1);
    expect(box.current.events[0]?.type).toBe("WINDOW_RESIZE");
    expect(box.current.events[0]?.details).toBe("Sortie du mode plein écran");
  });
});

describe("useExamMonitoring — pureté de l'updater (#225)", () => {
  /** Force l état caché/visible du document : jsdom ne permet pas de la piloter autrement. */
  function setDocumentHidden(hidden: boolean): void {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
  }

  afterEach(() => {
    // Retire les propriétés propres posées par ces tests : les getters natifs de
    // Document.prototype reprennent la main pour les tests suivants.
    delete (document as unknown as Record<string, unknown>).visibilityState;
    delete (document as unknown as Record<string, unknown>).hidden;
  });

  it("un seul événement déclencheur n'appelle onViolation qu'une fois (StrictMode)", async () => {
    stubRequestFullscreen(() => Promise.resolve());
    stubFetch({ ok: true, json: async () => ({}) });
    const onViolation = vi.fn();

    // StrictMode invoque délibérément les updaters de `setState` deux fois en
    // développement : ce test échouerait si un effet de bord y subsistait.
    renderHook({ maxTabSwitches: 1, onViolation }, { strict: true });

    await act(async () => {
      setDocumentHidden(true);
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onViolation).toHaveBeenCalledTimes(1);
    expect(onViolation.mock.calls[0]?.[0]).toMatchObject({ type: "VISIBILITY_CHANGE" });
    expect(onViolation.mock.calls[0]?.[1]).toMatchObject({ tabSwitches: 1 });
  });

  it("deux événements déclencheurs distincts → deux appels, pas quatre (StrictMode)", async () => {
    stubRequestFullscreen(() => Promise.resolve());
    stubFetch({ ok: true, json: async () => ({}) });
    const onViolation = vi.fn();

    renderHook({ maxTabSwitches: 1, onViolation }, { strict: true });

    for (let i = 0; i < 2; i += 1) {
      await act(async () => {
        setDocumentHidden(true);
        document.dispatchEvent(new Event("visibilitychange"));
      });
    }

    expect(onViolation).toHaveBeenCalledTimes(2);
  });

  it("le franchissement du seuil produit toujours une seule action d'enforcement (StrictMode)", async () => {
    vi.useFakeTimers();
    stubRequestFullscreen(() => Promise.resolve());
    const enforcement: EnforcementAction = {
      lockAnswers: true,
      forceSubmit: false,
      warnUser: true,
      reason: "Triche détectée",
    };
    const fetchSpy = stubFetch({ ok: true, json: async () => ({ enforcement }) });
    const onViolation = vi.fn();
    const onEnforcement = vi.fn();

    const { box } = renderHook({ maxTabSwitches: 1, onViolation, onEnforcement }, { strict: true });

    await act(async () => {
      setDocumentHidden(true);
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onViolation).toHaveBeenCalledTimes(1);
    expect(box.current.tabSwitches).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(onEnforcement).toHaveBeenCalledTimes(1);
    expect(onEnforcement).toHaveBeenCalledWith(enforcement);
  });
});
