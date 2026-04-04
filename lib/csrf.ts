// lib/csrf.ts
// CSRF token utilities for client and server components
import { cookies } from 'next/headers'

/**
 * Get CSRF token from cookies (server-side)
 * Used to pass token to client components
 */
export async function getCsrfToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get('csrf_token')?.value
}

/**
 * Get CSRF token from cookies (client-side)
 */
export function getCsrfTokenClient(): string | null {
  if (typeof document === 'undefined') return null
  
  const match = document.cookie.match(/csrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Fetch wrapper that automatically includes CSRF token
 * Use this for all state-changing requests (POST, PUT, DELETE, PATCH)
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit & { skipCsrf?: boolean } = {}
) {
  const { skipCsrf, headers: customHeaders, ...restOptions } = options
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string> || {}),
  }

  // Add CSRF token unless explicitly skipped
  if (!skipCsrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(restOptions.method || '')) {
    const csrfToken = getCsrfTokenClient()
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }
  }

  return fetch(url, {
    ...restOptions,
    headers,
  })
}
