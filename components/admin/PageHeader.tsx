import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: PageHeaderBreadcrumb[];
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Fil d'Ariane">
          <ol className="flex flex-wrap items-center gap-1 text-sm">
            {breadcrumb.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? (
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-[var(--admin-text-secondary)]"
                    aria-hidden="true"
                  />
                ) : null}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="truncate rounded font-medium text-[var(--admin-text-secondary)] transition-colors hover:text-[var(--admin-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-primary)]"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate font-semibold text-[var(--admin-text)]">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-text)] sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export default PageHeader;
