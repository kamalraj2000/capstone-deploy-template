// Rebuild data/lawyer-golden-set.csv from the per-item source files:
//   data/bios/NN-name.html      -> the `input` column
//   data/expected/NN-name.json  -> the `expected_output` column
//
//   npm run make-csv
//
// Edit or add bios + expected JSON as files (easy to review), then regenerate
// the CSV Langfuse's dataset upload accepts. Files pair up by basename.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const biosDir = path.join(root, "data", "bios");
const expectedDir = path.join(root, "data", "expected");

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

const bioFiles = (await readdir(biosDir)).filter((f) => f.endsWith(".html")).sort();
if (bioFiles.length === 0) throw new Error(`no .html files in ${biosDir}`);

const rows = ["input,expected_output"];
for (const bioFile of bioFiles) {
  const base = bioFile.replace(/\.html$/, "");
  const bio = await readFile(path.join(biosDir, bioFile), "utf8");
  const expectedRaw = await readFile(path.join(expectedDir, `${base}.json`), "utf8");
  // Parse + re-stringify: fails loudly on malformed JSON and normalizes whitespace.
  const expected = JSON.stringify(JSON.parse(expectedRaw));
  rows.push(`${csvEscape(bio.trim())},${csvEscape(expected)}`);
}

const outPath = path.join(root, "data", "lawyer-golden-set.csv");
await writeFile(outPath, rows.join("\n") + "\n");
console.log(`wrote ${outPath} (${bioFiles.length} items)`);
