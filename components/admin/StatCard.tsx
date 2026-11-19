import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatCardColor = "brand" | "success" | "warning" | "error";

const colorStyles: Record<StatCardColor, { iconBg: string; iconText: string }> = {
  brand: { iconBg: "bg-red-50", iconText: "text-red-600" },
  success: { iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
  warning: { iconBg: "bg-amber-50", iconText: "text-amber-600" },
  error: { iconBg: "bg-red-50", iconText: "text-red-600" },
};

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: StatCardColor;
  trend?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  color = "brand",
  trend,
  className,
}: StatCardProps) {
  const styles = colorStyles[color];

  return (
    <div
      className={cn(
        "rounded-xl border bg-[var(--admin-surface)] p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5",
        "border-[var(--admin-border)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--admin-text-secondary)]">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--admin-text)] sm:text-3xl">
            {value}
          </p>
          {trend ? (
            <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">
              {trend}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            styles.iconBg,
            styles.iconText
          )}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default StatCard;
