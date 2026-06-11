# Data Fetching Strategy Review

## 📊 Current Architecture Evaluation

The project currently uses a **Client-Centric Fetching Strategy** within the Next.js App Router context.

| Feature | Current Approach | Impact |
| :--- | :--- | :--- |
| **Data Fetching** | Client-side `useEffect` + `fetch('/api/...')` | ⚠️ **High Latency**: User waits for JS to load, hydrate, then fetch. Skips Server Component benefits. |
| **API Architecture** | Dedicated Route Handlers (`app/api/*`) | ⚠️ **Overhead**: needlessly serializes data to JSON for internal views. Good for external access, bad for internal UI. |
| **Caching** | Default (Dynamic due to `searchParams`) | ⚠️ **Missed Opportunity**: Dashboard stats are re-calculated on every page load, straining the DB. |
| **Mutations** | Client-side `fetch` (POST/PATCH) | ⚠️ **DX Friction**: Manual state management (`loading`, `error`) required instead of leveraging Progressive Enhancement. |

### ❌ Identified Bottlenecks

1.  **Dashboard "Waterfall"**:
    -   ✅ **FIXED**: Refactored to Server Component. 4 DB calls happen in parallel on the server. Zero client network overhead for stats.

2.  **Attestation Detail Latency**:
    -   Client fetches `/api/attestations/[id]`.
    -   **Issue**: The skeleton loader is visible for longer than necessary (TTFB + Client Fetch RTT).

3.  **Database Efficiency**:
    -   No request deduplication between the 4 dashboard stats calls.

## 🚀 Refactoring Plan (Performance & DX)

We will shift to a **Server-First Strategy** standard in modern Next.js.

### Phase 1: Dashboard to Server Component
**Goal**: Remove API calls, fetch directly from DB.

```tsx
// app/admin/dashboard/page.tsx
import { prisma } from "@/lib/prisma";

async function getStats() {
  // Run DB queries in parallel on the server
  const [total, pending, validated, formations] = await Promise.all([
    prisma.attestation.count(),
    prisma.attestation.count({ where: { status: 'PENDING' } }),
    prisma.attestation.count({ where: { status: 'VALIDATED' } }),
    prisma.formation.count(),
  ]);
  return { total, pending, validated, formations };
}

export default async function AdminDashboard() {
  const stats = await getStats();
  // ... Render UI directly with data
}
```
**Benefit**:
-   **Zero Client Network Requests**: Data arrives *with* the HTML.
-   **Faster LCP**: content is immediate.

### Phase 2: Server Actions for Mutations
**Goal**: Replace API routes for creates/updates.

```tsx
// app/admin/attestations/actions.ts
'use server'

export async function validateAttestation(id: string) {
  await prisma.attestation.update({ ... });
  revalidatePath('/admin/dashboard'); // Auto-update dashboard stats!
}
```

### Phase 3: Caching Strategy
For expensive aggregation (if dashboard grows):

```tsx
import { unstable_cache } from 'next/cache';

const getCachedStats = unstable_cache(
  async () => prisma.attestation.count(),
  ['stats-count'],
  { revalidate: 60 } // Cache for 60 seconds
);
```

## 📝 Immediate Recommendations

1.  **Refactor `AdminDashboard`**: Convert to `async` Server Component. Move the 4 fetches into a server-side `Promise.all`.
2.  **Delete Redundant API Routes**: If `app/api/stats/route.ts` is only used by the dashboard, delete it after refactoring.
3.  **Prefetching**: Keep using `Link` for prefetching routes, which works automatically with Server Components.
