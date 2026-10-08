import type { ReactNode } from "react";

/**
 * En-tête commun des écrans d'accès : sur-titre, titre, description,
 * pastille e-mail optionnelle (#357, #355).
 */
export function AuthHeader({
  kicker,
  title,
  description,
  email,
  icon,
}: {
  kicker: string;
  title: string;
  description: ReactNode;
  email?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      {icon && (
        <span
          aria-hidden="true"
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white"
        >
          {icon}
        </span>
      )}
      <p className="text-xs font-bold uppercase tracking-widest text-brand">
        {kicker}
      </p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
        {title}
      </h1>
      <div className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
        {description}
      </div>
      {email && (
        <p className="mt-3 max-w-full truncate rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-700">
          {email}
        </p>
      )}
    </div>
  );
}
