// Activities: ALL I/O lives here — network, filesystem, LLM calls. Each one
// is retried by Temporal according to the policy the workflow declares; none
// of them needs its own retry loop.
import "dotenv/config";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { LawyerResult } from "./shared";

const SITEMAP_URL = "https://www.kirkland.com/sitemap/lawyers";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Read the firm's lawyer sitemap and return the first `count` bio URLs. */
export async function fetchLawyerUrls(count: number): Promise<string[]> {
  const response = await fetch(SITEMAP_URL, {
    headers: { "user-agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`sitemap fetch failed: HTTP ${response.status}`);
  }
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
  if (urls.length === 0) throw new Error("sitemap contained no <loc> entries");
  return urls.slice(0, count);
}

/** Download one bio page and reduce it to plain text (HTML is ~10x the tokens). */
export async function downloadBio(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`bio fetch failed: HTTP ${response.status} for ${url}`);
  }
  const html = await response.text();
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;|&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 200) {
    throw new Error(`bio page suspiciously short (${text.length} chars): ${url}`);
  }
  return text;
}

/**
 * Extract a structured profile with Claude, using the SAME lawyer-extractor
 * v2 prompt the morning's eval graded (../lawyer-eval/prompts/). The eval is
 * why we trust this prompt enough to run it 100 times unattended.
 */
export async function extractProfile(bioText: string): Promise<string> {
  const promptPath = path.resolve(
    __dirname,
    "../../lawyer-eval/prompts/lawyer-extractor-v2.txt",
  );
  const template = await readFile(promptPath, "utf8");
  const prompt = template.replace("{{document}}", bioText);

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/** Fan-in: write everything we extracted to one JSONL file. */
export async function saveResults(results: LawyerResult[]): Promise<string> {
  const outDir = path.resolve(__dirname, "../output");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "profiles.jsonl");
  const lines = results.map((r) =>
    JSON.stringify({ url: r.url, profile: tryParse(r.profile) }),
  );
  await writeFile(outFile, lines.join("\n") + "\n");
  return outFile;
}

function tryParse(profile: string): unknown {
  try {
    return JSON.parse(profile);
  } catch {
    return { raw: profile, parseError: true };
  }
}
