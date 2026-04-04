/**
 * lib/error-translator.ts
 * Traduit les messages d'erreur techniques (Better Auth, Zod) en français compréhensible.
 */
export function translateAuthError(message: string): string {
    const msg = message.toLowerCase();

    // Erreurs courantes Better Auth
    if (msg.includes("invalid email or password")) return "Email ou mot de passe incorrect.";
    if (msg.includes("user not found")) return "Compte introuvable.";
    if (msg.includes("email not verified")) return "Votre adresse email n'est pas encore vérifiée.";
    if (msg.includes("session expired")) return "Votre session a expiré. Veuillez vous reconnecter.";
    if (msg.includes("forbidden") || msg.includes("unauthorized")) return "Accès refusé. Vous n'avez pas les permissions nécessaires.";
    if (msg.includes("rate limit exceeded")) return "Trop de tentatives. Veuillez patienter un moment.";
    if (msg.includes("failed to fetch") || msg.includes("network error")) return "Erreur réseau. Vérifiez votre connexion.";
    if (msg.includes("crsf") || msg.includes("invalid original")) return "Erreur de sécurité de session. Veuillez recharger la page.";
    
    // Zod & Validation
    if (msg.includes("is required")) return "Ce champ est obligatoire.";
    if (msg.includes("invalid email")) return "Veuillez entrer une adresse email valide.";
    if (msg.includes("too short")) return "Le contenu est trop court.";
    
    // Fallback
    return message || "Une erreur est survenue lors de l'opération.";
}
