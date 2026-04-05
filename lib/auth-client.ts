import { createAuthClient } from "better-auth/react"
import { adminClient, emailOTPClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"),
    plugins: [
        adminClient(),
        emailOTPClient()
    ]
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
