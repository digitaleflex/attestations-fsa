# Next.js Performance Audit Report
## 🚨 Top Performance Killers

| Impact | Issue | Location | Status |
| :--- | :--- | :--- | :--- |
| 🔴 **Critical** | **Bundle Bloat**: `html2pdf.js` (~150KB+) bundled in initial load. | `app/admin/attestations/[id]/page.tsx` | ✅ **FIXED** (Lazy Loaded) |
| 🟢 **Fixed** | **Bundle Bloat**: `@techstark/opencv-js` & `jsqr` (~5MB+). | `src/components/ui/qr-scanner.tsx` | ✅ **FIXED** (Removed unused component). |
| 🟠 **High** | **Layout Re-render**: `RootLayout` was a Client Component. | `app/layout.tsx` | ✅ **FIXED** (Refactored to Server) |
| 🟡 **Medium** | **Fonts**: System fonts used, potential Layout Shift (CLS). | `app/layout.tsx` | ✅ **FIXED** (Added `next/font/google` Inter) |
| 🟡 **Medium** | **Icons**: `lucide-react` loaded as standard. | Global | ℹ️ **Note** (Ensure tree-shaking works). |

## 🛠️ Applied Fixes

### 1. Root Layout Refactor
**Problem**: The entire application was wrapped in `'use client'`, causing full client-side hydration for static shells.
**Fix**:
- Extracted `QueryClientProvider` and `Toaster` to `app/providers.tsx`.
- Converted `app/layout.tsx` to a Server Component.
- Added **Next.js Font Optimization** (Inter) to prevent CLS.

### 2. Dynamic Import for PDF Generation
**Problem**: `html2pdf.js`, `html2canvas`, and `jspdf` were imported statically in the attestation detail page, slowing down the load time even for users just viewing the details.
**Fix**:
```typescript
// app/admin/attestations/[id]/page.tsx
const handleDownloadPDF = async () => {
  const html2pdf = (await import('html2pdf.js')).default; // Lazy load on click
  await html2pdf()...
}
```

## 🔍 Recommendations

1.  **OpenCV.js**: This is an extremely heavy library. If the QR scanner is not the primary feature, ensure it is *strictly* only loaded when the user opens the camera. The current implementation uses dynamic import, which is good, but consider a lighter alternative like `zxing-js` or usage of the native `BarcodeDetector` API (which you have generic support for).
2.  **Auth in Layout**: `app/admin/layout.tsx` performs `router.push('/admin/login')` inside `useEffect`. This causes a "flash of content" or "flash of unauthorized" state. **Recommendation**: Move this logic to `middleware.ts` for server-side redirection.

---

## 🔄 Audit #145 (2026-09-13) — après nettoyage

### Corrigé dans cet audit
| Impact | Point | Fix |
| :--- | :--- | :--- |
| 🟠 **High** | **N+1 Prisma** : `exams/monitoring` faisait N inserts (`Promise.all(events.map(create))`). | ✅ **`createMany`** (N → 1 requête). |
| 🟡 Medium | **Bundle** : deps graphiques inutilisées (`chart.js`, `react-chartjs-2`). | ✅ **Retirées** (PR #143). |

### Vérifié sain (aucune action)
| Point | Constat |
| :--- | :--- |
| **Index Prisma** | ✅ 45 index couvrant les requêtes chaudes : `Notification[userId,isRead]`, `[userId,createdAt]`, `SecurityLog[userId,timestamp,eventType,severity]`, `AuditLog[userId,timestamp,action,resource]`, `ExamSession` (unique + status/submittedAt/gradedAt), `Attestation` (userId/sessionId/status/issuedAt). |
| **Cache** | ✅ `unstable_cache` sur les données publiques (`lib/data-public.ts` : formations + exams). |
| **N+1 restants** | ✅ Aucun autre : les boucles `fsa-login`/`scans`/`submit` sont du traitement pur (cookies, magic-bytes, scoring) sans I/O DB. |
| **Fonts** | ✅ `next/font/google` (Inter, `display: swap`). |

### Dette identifiée (risquée, hors incrément)
| Impact | Point | Recommandation |
| :--- | :--- | :--- |
| 🔴 **Critical** | **`force-dynamic` global** (`app/layout.tsx:13`) : désactive la génération statique/ISR pour **toutes** les pages, y compris les pages publiques (accueil, formations, légal). Ajouté comme *workaround* pour des erreurs de build avec composants client. | Retirer le global et déclarer `dynamic = 'force-dynamic'` **page par page** (déjà fait sur les pages user), après avoir corrigé les erreurs de build sous-jacentes. **Prérequis** : un build vert reproductible (non mesurable ici — DB locale inaccessible + erreurs symlink Windows). |
| 🟠 High | **Ratio client components élevé** : `60` composants `'use client'` sur `65` pages. Les pages de données pourraient être des **Server Components** (moins de JS, meilleur TTFB/LCP). | Refactor progressif page par page (dashboard, résultats, formations) en Server Components + `unstable_cache`. |
| 🟡 Medium | **Auth dans les layouts** : `router.push` dans `useEffect` (flash non-autorisé) — cf. recommandation 2 ci-dessus. | Déplacer la garde dans `proxy.ts` (déjà en place pour `/admin`, `/api/admin`). À vérifier : couverture complète des routes users. |

### Métriques non mesurables dans cet environnement
LCP/TTFB réels, poids de bundle compilé et mémoire sur listes nécessitent un build + app en marche. À mesurer une fois la DB accessible : `pnpm build` + Lighthouse sur accueil / dashboard / résultats.

