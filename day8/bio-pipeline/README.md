# Day 8 — The Bio Pipeline (Temporal, fan-out/fan-in)

A real durable-execution pipeline: read Kirkland & Ellis's public lawyer
sitemap (4,000+ bios), **fan out** across N lawyers — each one is a
download-then-extract chain, run 5 at a time — and **fan in** to a single
`output/profiles.jsonl`. Extraction uses the **same `lawyer-extractor` v2
prompt the morning's eval graded** — the eval is why we trust it enough to
run unattended, 100 times in a row.

The point of the demo: **kill the worker mid-run, restart it, and watch the
pipeline resume exactly where it stopped.** Progress lives in the Temporal
server's event history, not in your process.

## Setup (once)

```bash
brew install temporal          # Windows: CLI zip from temporal.io, add to PATH
cd day8/bio-pipeline
npm install
cp .env.example .env           # your per-team Anthropic key
```

## Run it

Three terminals:

```bash
# 1 — the server (the flag matters: default is in-memory)
temporal server start-dev --db-filename temporal.db

# 2 — the worker (the killable process)
npm run worker

# 3 — start a run
npm run start           # 10 lawyers — student-sized, ~1 minute
npm run start -- 100    # the class demo, a few minutes
```

Watch it live in the Web UI: **http://localhost:8233** — open the running
workflow and keep the event history on screen.

## The murder scene

1. Start `npm run start -- 100` and wait until the UI shows a few dozen
   completed activities.
2. In terminal 2: **Ctrl-C the worker.** The process is gone.
3. UI: the workflow is still **Running**; every completed download/extract is
   in the event history. Nothing is lost, nothing re-runs.
4. `npm run worker` again. The pipeline picks up at the first incomplete
   lawyer and finishes. Terminal 3 prints the summary as if nothing happened.
5. `cat output/profiles.jsonl | head -2` — real structured profiles.

Kill the *server* too if you like — the `--db-filename temporal.db` flag is
what makes that survivable (SQLite instead of in-memory).

## Reading the code (the walkthrough order)

| File | What to notice |
|---|---|
| `src/activities.ts` | ALL I/O: sitemap fetch, bio download + HTML→text, the Claude call, the JSONL write. Plain async functions. No retry loops anywhere. |
| `src/workflows.ts` | Orchestration only. The retry policy is *declared* on `proxyActivities`. Fan-out = `Promise.all` over a batch of 5; per-lawyer failures are recorded, not fatal. Deterministic — the sandbox blocks `fetch`/`Date.now()` here, on purpose. |
| `src/worker.ts` | Binds workflow + activities to the `bio-pipeline` task queue. The killable part. |
| `src/client.ts` | Starts a run, prints the summary. |
| `src/smoke.ts` | `npm run smoke` — pre-class check that the sitemap + one bio download work (no server or API key needed). |

## Being a good citizen

The bios are public pages and the firm's robots.txt allows them (only
PDF/vCard formats are disallowed). Keep it that way: the pipeline runs 5
concurrent fetches max, and there is no reason to run more than ~100 in
class. Extracted output stays on your machine (`output/` is gitignored) —
these are real people's professional bios; don't republish them.

## Costs

~100 bios through `claude-haiku-4-5` ≈ well under $1 on your capped Day 7
key. The summary printed by the client tells you exactly how many extractions
ran.
