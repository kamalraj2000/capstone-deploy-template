// Extract one lawyer profile, traced into Langfuse.
//
//   npm run extract -- data/bios/01-margaret-alvarez.html
//
// The prompt comes from Langfuse Prompt Management ("lawyer-extractor",
// whichever version carries the `production` label) — change the label in the
// Langfuse UI and this script picks up the new version with zero code change.
import { shutdownTelemetry } from "./telemetry.js";
import { readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { LangfuseClient } from "@langfuse/client";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run extract -- data/bios/<some-bio>.html");
  process.exit(1);
}

const document = await readFile(file, "utf8");

const langfuse = new LangfuseClient();
const prompt = await langfuse.prompt.get("lawyer-extractor");
console.error(`Using prompt "lawyer-extractor" v${prompt.version}`);

const anthropic = new Anthropic();
const message = await anthropic.messages.create({
  model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
  max_tokens: 2000,
  messages: [{ role: "user", content: prompt.compile({ document }) }],
});

const text = message.content
  .filter((block) => block.type === "text")
  .map((block) => block.text)
  .join("");
console.log(text);

await shutdownTelemetry();
