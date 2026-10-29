import { createAuthClient } from "better-auth/react"
import { adminClient, emailOTPClient, twoFactorClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    // Origine du DOCUMENT (absolue, exigée par Better Auth — une base
    // relative lève `Invalid base URL`). Au navigateur, c'est toujours la
    // même origine que la page : le CSP `connect-src 'self'` matche sur
    // toutes les variantes d'hôte (point final, www, ancien domaine).
    // Côté serveur (prerender), repli sur l'URL configurée.
    baseURL: `${typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000")}/api/auth`,
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
