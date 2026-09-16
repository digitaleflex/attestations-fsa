import { useState, useEffect, useRef, useCallback } from 'react';
import type { EnforcementAction } from '@/lib/exam-enforcement';

export interface MonitoringEvent {
  type: 'VISIBILITY_CHANGE' | 'BLUR' | 'FOCUS' | 'WINDOW_RESIZE' | 'MULTIPLE_WINDOWS';
  timestamp: number;
  details?: string;
}

export interface MonitoringState {
  events: MonitoringEvent[];
  tabSwitches: number;
  blurCount: number;
  totalSuspiciousEvents: number;
  isCurrentlyVisible: boolean;
  isCurrentlyFocused: boolean;
}

interface UseExamMonitoringProps {
  examId: string;
  userId?: string;
  maxTabSwitches?: number;
  onViolation?: (event: MonitoringEvent, state: MonitoringState) => void;
  onEnforcement?: (action: EnforcementAction) => void;
}

/**
 * Logique pure du seuil de changements d'onglet.
 * Une violation est déclenchée dès que le nombre de tab switches
 * atteint (ou dépasse) la limite configurée.
 */
export function shouldTriggerViolation(
  tabSwitches: number,
  maxTabSwitches: number,
): boolean {
  return tabSwitches >= maxTabSwitches;
}

export function useExamMonitoring({
  examId,
  userId,
  maxTabSwitches = 3,
  onViolation,
  onEnforcement,
}: UseExamMonitoringProps) {
  const [state, setState] = useState<MonitoringState>({
    events: [],
    tabSwitches: 0,
    blurCount: 0,
    totalSuspiciousEvents: 0,
    isCurrentlyVisible: true,
    isCurrentlyFocused: true,
  });

  const eventQueue = useRef<MonitoringEvent[]>([]);
  const isFullscreen = useRef(false);

  // #220 — L'effet de surveillance ne doit pas se rejouer quand le parent
  // recrée ses callbacks à chaque rendu (fonctions inline). On conserve donc
  // la dernière version de chaque callback dans une ref : l'effet lit toujours
  // la version à jour sans en dépendre. Le comportement observable est
  // identique (mêmes appels, mêmes arguments), seule la fréquence de
  // (re)montage de l'effet change.
  const onViolationRef = useRef(onViolation);
  const onEnforcementRef = useRef(onEnforcement);

  useEffect(() => {
    onViolationRef.current = onViolation;
    onEnforcementRef.current = onEnforcement;
  });

  const addEvent = useCallback((type: MonitoringEvent['type'], details?: string) => {
    const newEvent: MonitoringEvent = { type, timestamp: Date.now(), details };
    eventQueue.current.push(newEvent);

    setState((prev) => {
      const isHidden = type === 'VISIBILITY_CHANGE' && document.visibilityState === 'hidden';
      const isBlur = type === 'BLUR';

      const newState = {
        ...prev,
        events: [...prev.events, newEvent],
        tabSwitches: isHidden ? prev.tabSwitches + 1 : prev.tabSwitches,
        blurCount: isBlur ? prev.blurCount + 1 : prev.blurCount,
        totalSuspiciousEvents: prev.totalSuspiciousEvents + 1,
        isCurrentlyVisible: document.visibilityState === 'visible',
        isCurrentlyFocused: type === 'FOCUS' ? true : (isBlur ? false : prev.isCurrentlyFocused),
      };

      if (onViolationRef.current && shouldTriggerViolation(newState.tabSwitches, maxTabSwitches)) {
        onViolationRef.current(newEvent, newState);
      }
      return newState;
    });
  }, [maxTabSwitches]);

  // Fullscreen enforcement.
  //
  // #220 — Deux situations très différentes aboutissent ici :
  //  1. La DEMANDE de plein écran échoue (pas d'activation utilisateur
  //     transitoire après un rechargement, API indisponible, permission
  //     refusée…) : c'est une contrainte d'environnement, PAS une action du
  //     candidat. Elle ne doit donc produire aucun événement suspect ni
  //     requête de monitoring, sous peine de compter un faux positif.
  //  2. Le candidat QUITTE réellement le plein écran après y être entré :
  //     détecté par `fullscreenchange` plus bas, qui continue de journaliser
  //     l'événement légitime (anti-triche inchangé).
  const enterFullscreen = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        isFullscreen.current = true;
      }
    } catch {
      // Échec de demande : environnement, pas une violation. Intentionnellement
      // silencieux (aucun `addEvent`).
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
      isFullscreen.current = false;
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    enterFullscreen();

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen.current) {
        addEvent('WINDOW_RESIZE', 'Sortie du mode plein écran');
        enterFullscreen();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        addEvent('VISIBILITY_CHANGE', 'Changement d\'onglet détecté');
      } else {
        addEvent('FOCUS', 'Retour sur l\'examen');
      }
    };

    const handleBlur = () => {
      addEvent('BLUR', 'Perte de focus sur la fenêtre d\'examen');
    };

    // Block copy/paste/contextmenu
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      addEvent('BLUR', 'Tentative de copie détectée');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      addEvent('BLUR', 'Tentative de collage détectée');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addEvent('BLUR', 'Tentative de menu contextuel détectée');
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('contextmenu', handleContextMenu);

    const reportInterval = setInterval(async () => {
      if (eventQueue.current.length > 0 && userId) {
        const eventsToReport = [...eventQueue.current];
        eventQueue.current = [];
        try {
          const enforcement = await reportMonitoringEvents(eventsToReport, examId, userId);
          if (enforcement && (enforcement.lockAnswers || enforcement.warnUser)) {
            onEnforcementRef.current?.(enforcement);
          }
        } catch {
          eventQueue.current.unshift(...eventsToReport);
        }
      }
    }, 5000);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('contextmenu', handleContextMenu);
      clearInterval(reportInterval);
      exitFullscreen();

      if (eventQueue.current.length > 0 && userId) {
        reportMonitoringEvents(eventQueue.current, examId, userId);
      }
    };
  // `onEnforcement`/`onViolation` sont volontairement ABSENTS des dépendances :
  // ils sont lus via leurs refs (cf. #220), ce qui évite que l'effet se
  // démonte/remonte à chaque rendu du parent. `addEvent`, `enterFullscreen` et
  // `exitFullscreen` sont stables (mémorisés) tant que `maxTabSwitches` ne
  // change pas.
  }, [addEvent, examId, userId, enterFullscreen, exitFullscreen]);

  return { ...state, enterFullscreen, exitFullscreen };
}

async function reportMonitoringEvents(
  events: MonitoringEvent[],
  examId: string,
  userId: string,
): Promise<EnforcementAction | null> {
  if (events.length === 0) return null;

  try {
    const response = await fetch('/api/exams/monitoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, examId, userId, timestamp: Date.now() }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.enforcement ?? null;
  } catch {
    return null;
  }
}
