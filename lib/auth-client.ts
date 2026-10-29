import { createAuthClient } from "better-auth/react"
import { adminClient, emailOTPClient, twoFactorClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    // Relatif volontairement : une URL absolue (NEXT_PUBLIC_APP_URL) casse
    // tous les appels dès que l'origine du document diffère d'un caractère
    // (point final, www, ancien domaine) — le CSP `connect-src 'self'`
    // bloque alors get-session, sign-in, OTP... (constaté le 2026-10-29).
    // En relatif, les requêtes partent toujours vers la même origine.
    baseURL: "/api/auth",
    plugins: [
        adminClient(),
        emailOTPClient(),
        twoFactorClient({
            onTwoFactorRedirect() {
                window.location.href = "/admin/2fa/verify";
            },
        }),
    ],
})

// ✅ FIX: Define explicit types for auth methods to avoid 'any' in page components
export const { useSession, signIn, signOut, signUp, resetPassword } = authClient;

/**
 * ✅ FIX: Custom forgetPassword that uses emailOtp.requestPasswordReset
 * Sends a 6-digit OTP code to the user's email for password reset
 * Note: No redirectTo needed since we send a code, not a link
 */
export async function forgetPassword(data: { email: string }) {
    return await authClient.emailOtp.requestPasswordReset({
        email: data.email,
    });
}
