# Day 8 Lab Rig — Lawyer Profile Extraction, Measured

A deliberately tiny project for Lab 8.1: one extraction script, traced into
Langfuse, plus the golden dataset and prompts the eval runs on. Everyone runs
the same three commands — your capstone stays untouched until polish week.

Full step-by-step: **Day 8 Walkthrough handout** (posted in Discord).

## Setup (once, ~3 min)

```bash
cd day8/lawyer-eval
npm install
cp .env.example .env   # then fill in your Langfuse + Anthropic keys
```

Needs Node 20+. Keys: Langfuse pair from Part 1 of the walkthrough (US
region), Anthropic key from Day 7.

## The three commands

```bash
# 1. Extract one profile — and watch the trace appear in Langfuse
npm run extract -- data/bios/01-margaret-alvarez.html

# 2. Rebuild the dataset CSV from the source files (already committed;
#    rerun only if you edit the bios/expected files)
npm run make-csv

# 3. Homework: run the whole eval from code (after Lab 8.1's UI version)
npm run experiment
```

`extract` fetches the `lawyer-extractor` prompt from **Langfuse Prompt
Management** (whatever version holds the `production` label) — so you upload
the prompts once (from `prompts/`), and flipping the label changes what this
script does with zero code edits.

## What's where

| Path | What it is |
|---|---|
| `src/telemetry.ts` | OTEL + Langfuse wiring. **Read the comment about span filtering** — only AI spans are exported, by default. |
| `src/extract.ts` | The semantic function from Day 2, grown up: prompt from Langfuse, call traced automatically. |
| `src/run-experiment.ts` | The eval as code: dataset × task × a deterministic structure check. CI for prompts. |
| `src/make-csv.ts` | Builds `data/lawyer-golden-set.csv` from the per-item files. |
| `prompts/lawyer-extractor-v1.txt` | Deliberately weak — upload as version 1. |
| `prompts/lawyer-extractor-v2.txt` | Adds the rules v1 lacks — upload as version 2. |
| `schema/lawyer-profile.schema.json` | The Day 2 lawyer-profile schema, unchanged. |
| `data/bios/*.html` | The golden set inputs — see note below. |
| `data/expected/*.json` | The hand-checked answer key, one per bio. |

## About the golden set

- **The bios are synthetic.** They read like real law-firm bio pages but every
  person, firm, email, and phone number is invented (`.example.com` domains).
  Real bios would put real people's details in a public repo — don't do that.
- Each bio is paired with a hand-checked expected JSON. If you change a bio,
  change its expected file to match **exactly** — a wrong answer key grades
  garbage — then `npm run make-csv`.
- Item 05 is not a lawyer on purpose. Correct answer: `foundLawyer: false`,
  strings `""`, nullables `null`, arrays `[]`, `jobType: "Other"`. It catches
  prompts that "find" a lawyer on any page.
- `estimatedAge` is `null` throughout: the convention is *null unless an age
  is explicitly stated* — inference from graduation years is a judge-wobble
  trap, so the answer key doesn't do it.
- `description` is freeform; the accuracy judge compares it semantically, not
  string-for-string.

## Conventions the answer key follows

These match the rules in prompt v2 (that's the point — v1 doesn't know them):

1. Facts only — nothing invented, nothing padded.
2. Every listed degree/award/admission/prior firm captured, none summarized away.
3. `practiceAreas` = the page's own words; `normalizedPracticeAreas` =
   canonical names ("IP Litigation" → "Intellectual Property Litigation").
4. `jobType` maps to the closest enum value ("Of Counsel" → "Counsel");
   `isPartner` true only for partners.
5. Years are integers; unstated nullable facts are `null`; empty lists are `[]`.
