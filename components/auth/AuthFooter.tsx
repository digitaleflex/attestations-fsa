import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Pied de carte commun : liens secondaires avec zone tactile ≥ 44 px.
 * Microcopies unifiées (#355) : « Code FSA » partout, jamais
 * « Sécurité OTP » ni « Code FSA & OTP ».
 */
export function AuthFooter({
  links,
}: {
  links: Array<{ href: string; label: string; primary?: boolean }>;
}) {
  return (
    <div className="mt-6 flex flex-col items-center gap-1 border-t border-slate-100 pt-4 text-center">
      {links.map((link) => (
        <Link
          key={link.href + link.label}
          href={link.href}
          className={cn(
            "inline-flex min-h-[44px] items-center px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            link.primary
              ? "font-semibold text-brand hover:text-brand-dark hover:underline"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
