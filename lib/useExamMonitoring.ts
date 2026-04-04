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

  const stateRef = useRef(state);
  stateRef.current = state;

  const addEvent = useCallback((event: MonitoringEvent) => {
    setState((prev) => {
      const newEvents = [...prev.events, event];
      const isSuspicious = event.type === 'VISIBILITY_CHANGE' || event.type === 'BLUR';

      const newState: MonitoringState = {
        events: newEvents,
        tabSwitches: event.type === 'VISIBILITY_CHANGE' && event.details === 'hidden' 
          ? prev.tabSwitches + 1 
          : prev.tabSwitches,
        blurCount: event.type === 'BLUR' ? prev.blurCount + 1 : prev.blurCount,
        totalSuspiciousEvents: isSuspicious ? prev.totalSuspiciousEvents + 1 : prev.totalSuspiciousEvents,
        isCurrentlyVisible: event.type === 'VISIBILITY_CHANGE' 
          ? event.details !== 'hidden'
          : prev.isCurrentlyVisible,
        isCurrentlyFocused: event.type === 'FOCUS' 
          ? true 
          : event.type === 'BLUR' 
            ? false 
            : prev.isCurrentlyFocused,
      };

      // Trigger violation callback if threshold exceeded
      if (isSuspicious && onViolation) {
        if (newState.tabSwitches >= maxTabSwitches || newState.blurCount >= maxTabSwitches * 2) {
          onViolation(event, newState);
        }
      }

      return newState;
    });
  }, [maxTabSwitches, onViolation]);

  // Monitor visibility changes (tab switches)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const event: MonitoringEvent = {
        type: 'VISIBILITY_CHANGE',
        timestamp: Date.now(),
        details: document.visibilityState,
      };
      addEvent(event);

      // Log to console for debugging
      if (document.visibilityState === 'hidden') {
        console.warn('⚠️ [EXAM MONITORING] Tab switched - user left the exam');
      } else {
        console.log('✓ [EXAM MONITORING] User returned to exam tab');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [addEvent]);

  // Monitor window blur (user clicks outside browser or switches apps)
  useEffect(() => {
    const handleBlur = () => {
      const event: MonitoringEvent = {
        type: 'BLUR',
        timestamp: Date.now(),
        details: 'Window lost focus',
      };
      addEvent(event);
      console.warn('⚠️ [EXAM MONITORING] Window blurred');
    };

    const handleFocus = () => {
      const event: MonitoringEvent = {
        type: 'FOCUS',
        timestamp: Date.now(),
        details: 'Window regained focus',
      };
      addEvent(event);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [addEvent]);

  // Detect multiple windows/tabs (via localStorage sync)
  useEffect(() => {
    const examSessionKey = `exam-session-${examId}`;
    const sessionId = `${userId || 'anonymous'}-${Date.now()}`;

    // Register this session (only on client)
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(examSessionKey, JSON.stringify({
        sessionId,
        startedAt: Date.now(),
        tabId: sessionId,
      }));
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === examSessionKey && e.newValue) {
        const otherSession = JSON.parse(e.newValue);
        if (otherSession.sessionId !== sessionId) {
          const event: MonitoringEvent = {
            type: 'MULTIPLE_WINDOWS',
            timestamp: Date.now(),
            details: `Another tab detected: ${otherSession.sessionId}`,
          };
          addEvent(event);
          console.error('🚨 [EXAM MONITORING] Multiple exam tabs detected!');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(examSessionKey);
      }
    };
  }, [examId, userId, addEvent]);

  // Warn before leaving page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.events.length > 0) {
        e.preventDefault();
        e.returnValue = 'Vous êtes en plein examen. Êtes-vous sûr de vouloir quitter ?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.events.length]);

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
