import { toast } from "sonner";

export class ApiError extends Error {
  status: number;
  details?: any;
  code?: string;

  constructor(message: string, status: number, details?: any, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

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

    let data: any = {};
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    }

    if (!res.ok) {
        const errorMsg = data.message || data.error || `Erreur ${res.status}`;
        const errorDetails = data.details || null;
        const errorCode = data.code || null;

        if (notify) {
            toast.error(errorMsg, {
              description: errorCode ? `Code: ${errorCode}` : undefined,
            });
        }

        throw new ApiError(errorMsg, res.status, errorDetails, errorCode);
    }

    return data as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    const msg = error.message || "Une erreur inattendue est survenue";
    if (notify) toast.error(msg);
    throw new ApiError(msg, 500);
  }
}
