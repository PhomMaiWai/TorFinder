FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so
# this has to be a build arg — setting it at container runtime is too late.
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
# `next start` reads next.config.ts again at runtime. Without it the server
# runs on Next's defaults, so `poweredByHeader: false` was lost and every page
# sent `X-Powered-By: Next.js` (found in the evidence screenshots, #376). The
# header rules are compiled into .next, which is why only this one leaked.
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts

# Run as the image's unprivileged `node` user, not root (Semgrep dockerfile.missing-user).
USER node

EXPOSE 3000
CMD ["npm", "start"]
