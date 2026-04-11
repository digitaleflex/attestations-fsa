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
  // ✅ ANTI-CHEAT: DISABLED by request
  return {
    events: [],
    tabSwitches: 0,
    blurCount: 0,
    totalSuspiciousEvents: 0,
    isCurrentlyVisible: true,
    isCurrentlyFocused: true,
  };
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
