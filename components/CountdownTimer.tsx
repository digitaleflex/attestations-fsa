// components/CountdownTimer.tsx
// Countdown timer component for scheduled exams
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Play, AlertCircle } from "lucide-react";
import Link from "next/link";

interface CountdownTimerProps {
  scheduledAt: string; // ISO date string
  examId: string;
  examName: string;
  examDescription?: string;
  duration?: number;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  isSoon: boolean; // Less than 24 hours
  isVerySoon: boolean; // Less than 1 hour
}

/**
 * Calculate time remaining until scheduled date
 */
function calculateTimeRemaining(scheduledAt: string): TimeRemaining {
  const now = new Date().getTime();
  const scheduled = new Date(scheduledAt).getTime();
  const diff = scheduled - now;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
      isSoon: false,
      isVerySoon: false,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    days,
    hours,
    minutes,
    seconds,
    isPast: false,
    isSoon: days === 0 && hours < 24,
    isVerySoon: days === 0 && hours === 0 && minutes < 60,
  };
}

/**
 * Countdown timer card for scheduled exams
 */
export function CountdownTimer({
  scheduledAt,
  examId,
  examName,
  examDescription,
  duration,
}: CountdownTimerProps) {
  const [time, setTime] = useState<TimeRemaining>(() => calculateTimeRemaining(scheduledAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(calculateTimeRemaining(scheduledAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [scheduledAt]);

  // Format the scheduled date
  const formattedDate = new Date(scheduledAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Determine status color
  const getStatusColor = () => {
    if (time.isPast) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (time.isVerySoon) return "bg-red-100 text-red-700 border-red-200 animate-pulse";
    if (time.isSoon) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-blue-100 text-blue-700 border-blue-200";
  };

  const getStatusText = () => {
    if (time.isPast) return "✅ Examen disponible";
    if (time.isVerySoon) return "⚠️ Très imminent";
    if (time.isSoon) return "⏰ Bientôt";
    return "📅 Programmé";
  };

  return (
    <Card className={`p-6 bg-white shadow-sm border-l-4 ${
      time.isPast ? 'border-l-emerald-500' :
      time.isVerySoon ? 'border-l-red-500' :
      time.isSoon ? 'border-l-amber-500' :
      'border-l-blue-500'
    } hover:shadow-md transition-shadow`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
              time.isPast ? 'bg-gradient-to-br from-emerald-500 to-green-600' :
              time.isVerySoon ? 'bg-gradient-to-br from-red-500 to-rose-600' :
              time.isSoon ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
              'bg-gradient-to-br from-blue-500 to-indigo-600'
            }`}>
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 text-lg leading-tight">
                {examName}
              </h3>
              {examDescription && (
                <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {examDescription}
                </p>
              )}
            </div>
          </div>
          <Badge className={`${getStatusColor()} px-3 py-1 shadow-sm font-medium`}>
            {getStatusText()}
          </Badge>
        </div>

        {/* Countdown Display */}
        {!time.isPast && (
          <div className={`p-4 rounded-lg ${
            time.isVerySoon ? 'bg-red-50' :
            time.isSoon ? 'bg-amber-50' :
            'bg-slate-50'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className={`w-4 h-4 ${
                time.isVerySoon ? 'text-red-600' :
                time.isSoon ? 'text-amber-600' :
                'text-slate-600'
              }`} />
              <span className={`text-sm font-semibold ${
                time.isVerySoon ? 'text-red-800' :
                time.isSoon ? 'text-amber-800' :
                'text-slate-700'
              }`}>
                Temps restant avant le début
              </span>
            </div>
            
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className={`p-3 rounded-md ${
                time.isVerySoon ? 'bg-red-100' :
                time.isSoon ? 'bg-amber-100' :
                'bg-white'
              }`}>
                <div className={`text-3xl font-bold ${
                  time.isVerySoon ? 'text-red-700' :
                  time.isSoon ? 'text-amber-700' :
                  'text-slate-800'
                }`}>
                  {time.days}
                </div>
                <div className="text-xs text-slate-500 mt-1">Jours</div>
              </div>
              <div className={`p-3 rounded-md ${
                time.isVerySoon ? 'bg-red-100' :
                time.isSoon ? 'bg-amber-100' :
                'bg-white'
              }`}>
                <div className={`text-3xl font-bold ${
                  time.isVerySoon ? 'text-red-700' :
                  time.isSoon ? 'text-amber-700' :
                  'text-slate-800'
                }`}>
                  {time.hours}
                </div>
                <div className="text-xs text-slate-500 mt-1">Heures</div>
              </div>
              <div className={`p-3 rounded-md ${
                time.isVerySoon ? 'bg-red-100' :
                time.isSoon ? 'bg-amber-100' :
                'bg-white'
              }`}>
                <div className={`text-3xl font-bold ${
                  time.isVerySoon ? 'text-red-700' :
                  time.isSoon ? 'text-amber-700' :
                  'text-slate-800'
                }`}>
                  {time.minutes}
                </div>
                <div className="text-xs text-slate-500 mt-1">Minutes</div>
              </div>
              <div className={`p-3 rounded-md ${
                time.isVerySoon ? 'bg-red-100' :
                time.isSoon ? 'bg-amber-100' :
                'bg-white'
              }`}>
                <div className={`text-3xl font-bold ${
                  time.isVerySoon ? 'text-red-700' :
                  time.isSoon ? 'text-amber-700' :
                  'text-slate-800'
                }`}>
                  {time.seconds}
                </div>
                <div className="text-xs text-slate-500 mt-1">Secondes</div>
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formattedDate}
            </span>
            {duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {Math.round(duration / 60)} min
              </span>
            )}
          </div>
        </div>

        {/* Warning for very soon */}
        {time.isVerySoon && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-800">
              <strong>Attention:</strong> L'examen commence dans moins d'une heure. Préparez-vous !
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t">
          <Link href={`/exams/${examId}`} className="flex-1">
            <Button
              className={`w-full gap-2 ${
                time.isPast
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : time.isVerySoon
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Play className="w-4 h-4" />
              {time.isPast ? "Commencer maintenant" : "Accéder à l'examen"}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

/**
 * Simple countdown display for stats section
 */
export function MiniCountdown({ scheduledAt }: { scheduledAt: string }) {
  const [time, setTime] = useState<TimeRemaining>(() => calculateTimeRemaining(scheduledAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(calculateTimeRemaining(scheduledAt));
    }, 60000); // Update every minute for mini version

    return () => clearInterval(timer);
  }, [scheduledAt]);

  if (time.isPast) return null;

  const display = 
    time.days > 0 ? `${time.days}j ${time.hours}h` :
    time.hours > 0 ? `${time.hours}h ${time.minutes}m` :
    `${time.minutes}m ${time.seconds}s`;

  return (
    <span className="font-mono text-sm font-bold text-blue-600">
      dans {display}
    </span>
  );
}
