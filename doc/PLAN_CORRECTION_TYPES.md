# Plan de Correction des Types `any`

## Statistiques

- **Total**: 264 occurrences de `any` (123 en .ts + 141 en .tsx)
- **Catégories**: API Routes, Pages, Composants, Utilitaires

---

## Phase 1: Types de Base (Priorité Haute)

### 1.1 Créer un fichier de types globaux

**Fichier**: `lib/types.ts`

```typescript
import { Prisma } from "@prisma/client";

// Types pour les réponses API
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Types pour les formulaires
export interface ExamFormData {
  /* ... */
}
export interface AttestationFormData {
  /* ... */
}

// Types pour les sessions
export interface ExamSessionWithRelations {
  /* ... */
}
export interface UserWithRelations {
  /* ... */
}
```

### 1.2 Types pour Prisma (existants mais sous-utilisés)

**Fichier**: `lib/prisma-types.ts` (existe déjà - à compléter)

---

## Phase 2: API Routes (lib/)

### 2.1 Fichiers critiques à corriger

| Fichier                | Occurrences | Action          |
| ---------------------- | ----------- | --------------- |
| `lib/auth.ts`          | 4           | Typage session  |
| `lib/prisma.ts`        | 13          | Typage hooks    |
| `lib/audit.ts`         | 2           | Type paramètres |
| `lib/anti-cheat.ts`    | 7           | Types détection |
| `lib/error-handler.ts` | 8           | Types erreur    |
| `lib/api-client.ts`    | 4           | Types réponse   |

### 2.2 Pattern de correction pour les erreurs

```typescript
// AVANT
} catch (error: any) {

// APRÈS
} catch (error: unknown) {
  console.error('Error:', error);
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
}
```

### 2.3 Pattern pour les.map()

```typescript
// AVANT
submissions.map((sub: any) => ({ ... }))

// APRÈS
submissions.map((sub: ExamSession) => ({
  id: sub.id,
  score: sub.score,
}))
```

---

## Phase 3: Pages Utilisateur (app/(user)/)

### 3.1 Fichiers critiques

| Fichier                      | Occurrences | Priorité |
| ---------------------------- | ----------- | -------- |
| `dashboard/page.tsx`         | 7           | P1       |
| `attestations/page.tsx`      | 4           | P1       |
| `attestations/[id]/page.tsx` | 1           | P2       |
| `exams/[id]/page.tsx`        | 10          | P1       |
| `exams/page.tsx`             | 3           | P2       |
| `mock-exams/page.tsx`        | 3           | P2       |
| `results/page.tsx`           | 1           | P2       |
| `transcript/page.tsx`        | 4           | P2       |
| `profile/page.tsx`           | 3           | P2       |

### 3.2 Pattern pour les données React Query

```typescript
// AVANT
{data.attestations.map((att: any) => (}

// APRÈS
{data.attestations.map((att: Attestation) => (}
```

---

## Phase 4: Pages Admin (app/admin/)

### 4.1 Fichiers critiques

| Fichier                           | Occurrences | Priorité |
| --------------------------------- | ----------- | -------- |
| `dashboard/page.tsx`              | 10          | P1       |
| `attestations/[id]/page.tsx`      | 4           | P1       |
| `attestations/[id]/edit/page.tsx` | 8           | P1       |
| `submissions/page.tsx`            | 4           | P2       |
| `users/page.tsx`                  | 3           | P2       |
| `notifications/page.tsx`          | 2           | P2       |

---

## Phase 5: Composants

### 5.1 Composants critiques

| Fichier                | Occurrences | Action            |
| ---------------------- | ----------- | ----------------- |
| `NotificationBell.tsx` | 3           | Type notification |
| `ChatBubble.tsx`       | 1           | Type message      |
| `OfficialDocument.tsx` | 3           | Type données      |
| `ui/chart.tsx`         | 4           | Type props        |

---

## Plan d'Exécution

### Week 1: Fondations

- [ ] Créer `lib/types.ts` avec tous les types de base
- [ ] Compléter `lib/prisma-types.ts`
- [ ] Configurer `tsconfig.json` en mode strict

### Week 2: lib/ et API Routes

- [ ] Corriger `lib/auth.ts`
- [ ] Corriger `lib/prisma.ts`
- [ ] Corriger `lib/audit.ts`
- [ ] Corriger les catch blocks dans toutes les API routes

### Week 3: Pages Utilisateur

- [ ] Corriger `app/(user)/dashboard/page.tsx`
- [ ] Corriger `app/(user)/exams/[id]/page.tsx`
- [ ] Corriger `app/(user)/attestations/page.tsx`

### Week 4: Pages Admin

- [ ] Corriger `app/admin/dashboard/page.tsx`
- [ ] Corriger `app/admin/attestations/[id]/page.tsx`
- [ ] Corriger les autres pages admin

### Week 5: Composants et Finalisation

- [ ] Corriger les composants critiques
- [ ] Linter le projet
- [ ] Tester les fonctionnalités

---

## Commandes de Vérification

```bash
# Compter les any restants
grep -r ": any\|as any" --include="*.ts" --include="*.tsx" | wc -l

# Voir les fichiers les plus affectés
grep -r ": any\|as any" --include="*.ts" --include="*.tsx" | \
  cut -d: -f1 | sort | uniq -c | sort -rn | head -20
```

---

## Configuration TypeScript Recommandée

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

---

_Document généré automatiquement - 7 Avril 2026_
