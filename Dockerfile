# Capstone deployment image — Next.js standalone + Prisma migrate-on-start.
#
# Requires next.config.ts to include:  output: 'standalone'
# The entrypoint runs `prisma migrate deploy` BEFORE the server starts — the
# Day 4 rule ("always migrate before deploying new code") encoded in the image.

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- runtime stage ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

# Next standalone output + static assets
COPY --from=build /src/.next/standalone ./
COPY --from=build /src/.next/static ./.next/static
COPY --from=build /src/public ./public

# Prisma: schema + migrations + the CLI for `migrate deploy` at startup.
# Invoke the CLI at its real path (not the .bin shim): COPY dereferences the
# .bin symlink into a stray file, and Prisma 7+ loads its WASM engines
# relative to the CLI's own location — the shim copy crashes with
# ENOENT prisma_schema_build_bg.wasm before the server starts.
COPY --from=build /src/prisma ./prisma
COPY --from=build /src/node_modules/prisma ./node_modules/prisma
COPY --from=build /src/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
