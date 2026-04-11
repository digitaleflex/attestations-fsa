// lib/useExamMonitoring.ts
// Hook for detecting tab changes, focus loss, and suspicious behavior during exams
import { useState, useEffect, useRef, useCallback } from 'react';

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
  maxTabSwitches?: number; // Threshold for warnings
  onViolation?: (event: MonitoringEvent, state: MonitoringState) => void;
}

/**
 * Hook to monitor exam-taking behavior
 * Tracks: tab switches, window blur, focus changes, multiple windows
 */
export function useExamMonitoring({
  examId,
  userId,
  maxTabSwitches = 3,
  onViolation,
}: UseExamMonitoringProps) {
  const [state, setState] = useState<MonitoringState>({
    events: [],
    tabSwitches: 0,
    blurCount: 0,
    totalSuspiciousEvents: 0,
    isCurrentlyVisible: true,
    isCurrentlyFocused: true,
  });

  // Track event queue for reporting
  const eventQueue = useRef<MonitoringEvent[]>([]);

  const addEvent = useCallback((type: MonitoringEvent['type'], details?: string) => {
    const newEvent: MonitoringEvent = {
      type,
      timestamp: Date.now(),
      details,
    };

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

      if (onViolation) {
        onViolation(newEvent, newState);
      }

      return newState;
    });
  }, [onViolation]);

  useEffect(() => {
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

    const handleFocus = () => {
      // Focus regained
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    // Periodic reporting of events if userId is provided
    const reportInterval = setInterval(() => {
      if (eventQueue.current.length > 0 && userId) {
        const eventsToReport = [...eventQueue.current];
        eventQueue.current = [];
        reportMonitoringEvents(eventsToReport, examId, userId);
      }
    }, 5000); // Report every 5 seconds if events exist

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      clearInterval(reportInterval);
      
      // Final report
      if (eventQueue.current.length > 0 && userId) {
        reportMonitoringEvents(eventQueue.current, examId, userId);
      }
    };
  }, [addEvent, examId, userId]);

  return state;
}

/**
 * Send monitoring events to server for logging
 */
export async function reportMonitoringEvents(
  events: MonitoringEvent[],
  examId: string,
  userId: string
): Promise<void> {
  if (events.length === 0) return;

  try {
    const response = await fetch('/api/exams/monitoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events,
        examId,
        userId,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      console.error('Failed to report monitoring events');
    }
  } catch (error) {
    console.error('Error reporting monitoring events:', error);
  }
}
