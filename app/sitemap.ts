import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fsa.eurin.tech";

const routes: string[] = [
  "/",
  "/formations",
  "/examens",
  "/demande-stage",
  "/contact",
  "/faq",
  "/verifier",
  "/legal/confidentialite",
  "/legal/cookies",
  "/legal/mentions-legales",
  "/legal/attestations",
  "/legal/cgu",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));
}
