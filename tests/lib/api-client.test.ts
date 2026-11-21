import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { ApiError, apiFetch } from "@/lib/api-client";

function jsonResponse(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
}

describe("lib/api-client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    toastError.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ApiError conserve statut, détails et code", () => {
    const err = new ApiError("boom", 422, { field: "x" }, "E_VALIDATION");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(422);
    expect(err.details).toEqual({ field: "x" });
    expect(err.code).toBe("E_VALIDATION");
  });

  it("renvoie le JSON et fusionne les en-têtes", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    const data = await apiFetch<{ ok: boolean }>("/api/x", {
      method: "POST",
      headers: { "X-Test": "1" },
    });
    expect(data).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/x");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Test": "1",
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("renvoie un objet vide si la réponse n'est pas du JSON", async () => {
    fetchMock.mockResolvedValue(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    await expect(apiFetch("/api/x")).resolves.toEqual({});
  });

  it("lève une ApiError et notifie sur réponse non-ok", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "Interdit", code: "FORBIDDEN", details: { a: 1 } }, 403),
    );
    const err = await apiFetch("/api/x").catch((e: unknown) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.message).toBe("Interdit");
    expect(err.code).toBe("FORBIDDEN");
    expect(err.details).toEqual({ a: 1 });
    expect(toastError).toHaveBeenCalledWith("Interdit", { description: "Code: FORBIDDEN" });
  });

  it("utilise `error` puis un message par défaut, sans toast si notify=false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Nope" }, 400));
    await expect(apiFetch("/api/x", {}, false)).rejects.toMatchObject({ message: "Nope", status: 400 });

    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(apiFetch("/api/x", {}, false)).rejects.toMatchObject({ message: "Erreur 500" });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("convertit une erreur réseau en ApiError 500", async () => {
    fetchMock.mockRejectedValue(new Error("réseau coupé"));
    const err = await apiFetch("/api/x").catch((e: unknown) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toBe("réseau coupé");
    expect(toastError).toHaveBeenCalledWith("réseau coupé");
  });

  it("message générique pour une erreur non-Error", async () => {
    fetchMock.mockRejectedValue("bizarre");
    await expect(apiFetch("/api/x", {}, false)).rejects.toMatchObject({
      message: "Une erreur inattendue est survenue",
      status: 500,
    });
  });
});
