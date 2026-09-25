FROM node:24-alpine AS deps

# libc6-compat : compat glibc ; openssl : requis par le moteur Prisma
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate && \
    pnpm install --frozen-lockfile

FROM node:24-alpine AS builder

RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# NEXT_PUBLIC_* bakées au build — passées via compose.prod.yml build.args
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER
# #151 — DSN navigateur Sentry (optionnel) : vide = observabilité client désactivée.
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_PUSHER_KEY=$NEXT_PUBLIC_PUSHER_KEY
ENV NEXT_PUBLIC_PUSHER_CLUSTER=$NEXT_PUBLIC_PUSHER_CLUSTER
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Secrets factices pour le build uniquement (les vraies valeurs sont
# injectées au runtime via environment:). Nécessaire car `next build`
# évalue les routes (lib/auth.ts lève une erreur sans secret en prod).
ENV BETTER_AUTH_SECRET=dummy-build-only-secret-do-not-use
ENV DATABASE_URL=postgresql://build:dummy@localhost:5432/build?sslmode=disable

# `pnpm build` exécute déjà `prisma generate` (cf. package.json)
RUN pnpm build

# pnpm (node-linker isolé) génère le client Prisma sous
# node_modules/.pnpm/@prisma+client@.../node_modules/.prisma, PAS à la racine.
# On matérialise un arbre déréférencé (client + .prisma frères) pour le runner.
RUN set -eux; \
    real="$(readlink -f node_modules/@prisma/client)"; \
    mkdir -p /app/prisma-runtime; \
    cp -a "$real" /app/prisma-runtime/client; \
    engine="$(find node_modules/.pnpm -maxdepth 5 -type d -name '.prisma' | head -n 1)"; \
    test -n "$engine"; \
    cp -a "$engine" /app/prisma-runtime/engine; \
    ls -la /app/prisma-runtime /app/prisma-runtime/engine

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# openssl requis au runtime par le moteur Prisma (query engine)
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma-runtime/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma-runtime/engine ./node_modules/.prisma
COPY --from=builder /app/node_modules/pg ./node_modules/pg

# Cache ISR/Next inscriptible par l'utilisateur non-root (sinon EACCES sur /app/.next/cache)
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next

# Répertoires d'upload : CV/images (public) et scans d'examen (private).
# Créés DANS l'image et cédés à l'utilisateur applicatif, pour deux raisons :
#   1. `public/` est copié en root et `private/` n'existe pas du tout dans
#      l'image : sans cela, le `mkdir` fait par l'app en uid 1001 lève EACCES
#      et l'upload échoue (le fichier n'est jamais écrit).
#   2. Un volume NOMMÉ monté sur un dossier existant hérite de son contenu ET
#      de sa propriété au premier montage : l'écriture reste donc possible.
# Les volumes sont déclarés dans compose.prod.yml (fsa-uploads-public/private).
RUN mkdir -p /app/public/uploads /app/private/uploads/scans \
    && chown -R nextjs:nodejs /app/public/uploads /app/private/uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
