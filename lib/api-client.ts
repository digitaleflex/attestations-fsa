import { toast } from "sonner";

/**
 * Standard fetch wrapper that handles JSON parsing and error reporting
 * Automatically shows a toast if an error occurs and 'notify' is true
 */
export async function apiFetch<T = any>(
  url: string, 
  options: RequestInit = {}, 
  notify: boolean = true
): Promise<T> {
  // Extraire le token CSRF du cookie si présent (Pattern Double-Submit)
  const getCSRFToken = () => {
    if (typeof document === 'undefined') return undefined;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; csrf_token=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return undefined;
  };

  const csrfToken = getCSRFToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    // Content-type application/json expected
    let data: any = {};
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    }

    if (!res.ok) {
        const errorMsg = data.error || data.message || `Erreur ${res.status}`;
        if (notify) toast.error(errorMsg);
        throw new Error(errorMsg);
    }

    return data as T;
  } catch (error: any) {
    if (notify && !error.message.includes("fetch")) {
       // Only toast if it wasn't already toasted by the !res.ok block
       // and avoid raw network errors if possible
    }
    throw error;
  }
}
