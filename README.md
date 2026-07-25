# Deploy your capstone 🚀

This is everything you need to put your capstone on the internet at
**`https://<your-team>.apps.human-angle.com`**. Once set up, deploying is one move:
**merge to `main`**. That's it. Forever.

You do **not** need to install Docker, or anything else. The build happens in the cloud.

## Setup (once per team, ~15 minutes)

### 1. Copy two files into your repo

From this repo, into yours — **paths matter**:

```text
your-capstone/
├── Dockerfile                    ← copy `Dockerfile` here (repo root, capital D)
├── .github/
│   └── workflows/
│       └── deploy.yml            ← copy `deploy.yml` to exactly this path
├── prisma/
└── package.json
```

⚠️ GitHub only runs workflows from `.github/workflows/` — a typo in that path means
nothing ever runs, **with no error**. Check it twice.

### 2. Add one line to `next.config.ts`

```ts
const nextConfig: NextConfig = {
  // ...whatever you already have...
  output: 'standalone',
};
```

Without this line, **your build will fail** — the Dockerfile ships the standalone build,
and there won't be one.

### 3. Set five repository variables

Your team's **values card** (posted in the #day6 Discord thread) has all five values.

In your repo: **Settings → Secrets and variables → Actions → Variables tab** (⚠️ *not*
the Secrets tab) → **New repository variable**, five times:

| Name | What it is |
|---|---|
| `AZURE_CLIENT_ID` | your team's deploy identity — **unique to you** |
| `AZURE_TENANT_ID` | shared — same for everyone |
| `AZURE_SUBSCRIPTION_ID` | shared — same for everyone |
| `ACR_NAME` | shared — the class container registry |
| `STUDENT` | your team name — **unique to you** |

(Why Variables, not Secrets? None of these values are secret — deployment is
authenticated by GitHub proving *which repo* the run came from, not by a password.)

### 4. Ship it

```bash
git checkout -b add-deploy
git add Dockerfile .github/workflows/deploy.yml next.config.ts
git commit -m "Add deployment"
git push -u origin add-deploy
```

Open a PR, merge it to `main`, then open your repo's **Actions** tab and watch.
Green in ~4 minutes → **open your URL**. 🎉

## When the build is red (this is normal)

Open the failed run, find the **first** error line, and paste it — with the lines around
it — into Claude Code. The usual suspects:

| Symptom | Cause |
|---|---|
| Type errors during build | `next build` is stricter than `next dev` — production finally cashing TypeScript's check. Fix the types. |
| `standalone` / COPY errors | you skipped step 2 |
| `Module not found` for a file that exists | case-sensitive paths (Linux is; your Mac isn't) — or the file was never committed |
| Deploy step fails | one of the five variables is missing or typo'd — recheck against your card |
| Build green, site broken | your app's runtime logs — see below |

## What your app can rely on in production

- `DATABASE_URL` is provided — your Prisma setup already reads it. **The database starts
  empty** (migrated, no data): your laptop's data did not come along.
- `PORT=3000` and `HOSTNAME=0.0.0.0` are set — Next.js respects both by default.
- Migrations run automatically before every start (`prisma migrate deploy` — it's in the
  Dockerfile). Change your schema with `npx prisma migrate dev` locally, commit the new
  migration folder, push — production migrates itself.
- Your app runs behind a gateway. It forwards the real hostname as `X-Forwarded-Host` —
  NextAuth with `trustHost: true` works as-is.

### Seeding your production database

Your container is the only thing that can reach the database (that's a security feature).
So let it do the seeding:

1. Make your `prisma/seed.ts` **idempotent** — use `upsert`, so running twice is safe
2. In the Dockerfile's last line, add the seed between migrate and start:
   ```dockerfile
   CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node server.js"]
   ```
3. Push. Your app seeds itself on startup. Remove the clause later — or leave it (it's
   idempotent); decide deliberately and say why in the commit message.

## Need an API key or other setting in production?

Your `.env` file does not deploy (good — it's gitignored). If your app needs an
environment variable in production — an API key for a weather service, a config
value, anything you read with `process.env` — **don't ask the instructor and don't
paste keys into your code.** There's a skill for it.

Copy the skill folder from this repo into yours, same paths-matter rule as step 1:

```text
your-capstone/
├── .claude/
│   └── skills/
│       └── add-env-var/
│           └── SKILL.md          ← copy from this repo, exactly this path
```

Then just tell Claude Code what you need, in your own words:

> "My app needs OPENWEATHER_API_KEY in production — here's the key: ..."

Claude knows the class platform and will make the right edits (and tell you the
one thing only you can do: pasting the key into your repo's **Secrets** tab).
Two rules it will also enforce, worth knowing yourself:

- **Never commit a key** — not in code, not in the Dockerfile, not in `deploy.yml`.
- **Never touch** `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `PORT`, or
  `HOSTNAME` — the platform sets those for you.

## Watching your app (read access)

You each got an Azure invitation by email. Accept it, then at **portal.azure.com**:

- **Your app:** search `rg-students-platform` → `ca-<your-team>` → **Log stream** (live
  logs) and **Revisions** (every version you've deployed)
- **Search past logs:** `rg-students-platform` → `log-students` → Logs, then run
  (replace the name):

```kusto
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "ca-<your-team>"
| project TimeGenerated, Log_s
| order by TimeGenerated desc
| take 100
```

You have read-only access: look at anything, break nothing.

---

*Summer Training 2026 · deployment day (Day 6). The platform behind this —*
*gateway, WAF, private network, shared PostgreSQL — is what the morning session*
*explained. One image, built once per commit, configured by its environment.*
