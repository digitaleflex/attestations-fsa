import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"),
    plugins: [
        adminClient()
    ]
})

// ✅ FIX: Define explicit types for auth methods to avoid 'any' in page components
export const { useSession, signIn, signOut, signUp, resetPassword } = authClient;

// @ts-expect-error - forgetPassword is added by the emailAndPassword plugin on the server but might be missing on client type
export const forgetPassword = authClient.forgetPassword as (data: { email: string; redirectTo: string }) => Promise<{ error: { message: string } | null }>;
