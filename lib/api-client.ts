import { toast } from "sonner";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  code?: string;

  constructor(
    message: string,
    status: number,
    details?: unknown,
    code?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
  notify: boolean = true,
): Promise<T> {
  const getCSRFToken = () => {
    if (typeof document === "undefined") return undefined;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; csrf_token=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift();
    return undefined;
  };

  const csrfToken = getCSRFToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    let data: unknown = {};
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    }

    if (!res.ok) {
      const errorData = data as {
        message?: string;
        error?: string;
        details?: unknown;
        code?: string;
      };
      const errorMsg =
        errorData.message || errorData.error || `Erreur ${res.status}`;
      const errorDetails = errorData.details ?? null;
      const errorCode = errorData.code ?? undefined;

      if (notify) {
        toast.error(errorMsg, {
          description: errorCode ? `Code: ${errorCode}` : undefined,
        });
      }

      throw new ApiError(
        errorMsg,
        res.status,
        errorDetails,
        errorCode ?? undefined,
      );
    }

    return data as T;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    const msg =
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue";
    if (notify) toast.error(msg);
    throw new ApiError(msg, 500);
  }
}
