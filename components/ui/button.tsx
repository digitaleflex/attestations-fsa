import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // `focus-visible:ring-offset-2` + `ring-offset-background` : sans le
  // décalage, l'anneau de focus (rouge marque) se confond avec le fond rouge
  // d'un bouton plein et devient invisible. Le décalage blanc, lui, sépare
  // l'anneau de la forme sur TOUTES les variantes — condition nécessaire pour
  // que le focus clavier reste visible (WCAG 2.4.7).
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md hover:bg-brand-dark hover:shadow-lg",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border-2 border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-brand",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Cibles tactiles. Le seuil contraignant est WCAG 2.5.8 (AA) : 24 x 24
        // px. `default`, `lg` et `icon` le dépassent (44 / 48 / 44 px).
        // `sm` reste à 36 px (`h-9`) : c'est au-dessus du seuil, et le porter
        // à 44 px densifierait mal les tableaux denses sans gain réel — le
        // plancher de 36 px est donc assumé, pas subi.
        default: "h-11 min-h-11 px-6 py-2",
        sm: "h-9 min-h-9 rounded-xl px-4 text-xs",
        lg: "h-12 min-h-12 rounded-2xl px-8",
        // `icon` : seule taille réellement carrée, donc la seule où `w-11`
        // est sûr. Les autres gardent leur largeur pilotée par `px-*`.
        icon: "h-11 min-h-11 w-11 min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

/**
 * Avertit en développement quand un bouton de type `icon` (carré, sans texte)
 * n'a aucun nom accessible : ni `aria-label`, ni `aria-labelledby`, ni
 * `title`, ni contenu texte. C'est l'erreur la plus fréquente sur ces
 * boutons — l'icône seule ne se lit pas. Le garde-fou ne bloque pas le rendu
 * (les cas légitimes passent par Slot/`asChild`), il signale.
 *
 * Volontairement, on ne tente PAS de marquer automatiquement les icônes
 * décoratives : lucide-react n'expose aucun marqueur fiable (son `displayName`
 * est le nom brut de l'icône — "Menu", pas "LucideMenu" — et sa classe
 * `lucide` est ÉCRASÉE dès que l'appelant fournit son propre `className`, ce
 * qui est le cas de `<X className="h-5 w-5" />`). Deviner à l'aveugle
 * reviendrait à risquer `aria-hidden` sur une icône porteuse de sens, soit une
 * régression plus grave que celle qu'on cherche à éviter. Le nom accessible
 * reste donc une responsabilité explicite de l'appelant, et c'est ce qu'on
 * vérifie ici.
 */
function warnIfUnlabeledIconButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
  size: ButtonProps["size"]
): void {
  if (process.env.NODE_ENV === "production" || size !== "icon") return

  const hasName =
    typeof props["aria-label"] === "string" ||
    typeof props["aria-labelledby"] === "string" ||
    typeof props.title === "string"
  if (hasName) return

  // Un enfant textuel non vide suffit aussi (texte visible ou `sr-only`).
  // On descend d'un niveau dans les enfants ÉLÉMENT : le motif légitime le
  // plus courant est `<Icon /><span className="sr-only">Libellé</span>`, où le
  // nom est porté par un élément enfant et non par une chaîne directe. Ne
  // chercher que les chaînes directes produirait un avertissement injustifié
  // sur ce motif — c'est-à-dire sur `SidebarTrigger` lui-même.
  const hasTextChild = React.Children.toArray(props.children).some((child) => {
    if (typeof child === "string") return child.trim().length > 0
    if (typeof child === "number") return true
    if (React.isValidElement(child)) {
      const nested = (child.props as { children?: React.ReactNode })?.children
      return React.Children.toArray(nested).some(
        (inner) => typeof inner === "string" && inner.trim().length > 0,
      )
    }
    return false
  })
  if (hasTextChild) return

  // L'avertissement est volontaire : il ne s'affiche qu'en développement
  // (gardé en tête de fonction) et ne bloque jamais le rendu.
  console.warn(
    "[ui/button] Bouton `size=\"icon\"` sans nom accessible. " +
      "Ajoutez aria-label (ou aria-labelledby / title) : une icône seule " +
      "n'est pas annoncée par les lecteurs d'écran."
  )
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    warnIfUnlabeledIconButton(props, size)

    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
