// Run the whole eval from code: every dataset item through the extraction
// prompt, scored by a deterministic structure check. This is the "evals in
// CI" version of what you did in the Langfuse UI during Lab 8.1.
//
//   npm run experiment                     # uses the `production` prompt label
//   PROMPT_LABEL=latest npm run experiment # or pin a label explicitly
//
// The LLM-as-a-judge evaluators you configured in the UI also run on these
// experiment results — compare runs side by side in the dataset view.
import { shutdownTelemetry } from "./telemetry.js";
import Anthropic from "@anthropic-ai/sdk";
import { LangfuseClient } from "@langfuse/client";

const REQUIRED_KEYS = [
  "foundLawyer", "firstName", "lastName", "fullName", "jobTitle",
  "estimatedAge", "description", "country", "stateOrProvince", "city",
  "degrees", "practiceAreas", "normalizedPracticeAreas", "mattersAndDeals",
  "leadershipPositions", "awards", "barAdmissions", "courts",
  "priorExperiences", "phoneNumber", "email", "isPartner", "jobType",
];
const JOB_TYPES = [
  "Partner", "Managing Associate", "Senior Associate", "Associate", "Counsel", "Other",
];

const langfuse = new LangfuseClient();
const anthropic = new Anthropic();

const label = process.env.PROMPT_LABEL ?? "production";
const prompt = await langfuse.prompt.get("lawyer-extractor", { label });
console.error(`Running experiment with prompt v${prompt.version} (label: ${label})`);

const dataset = await langfuse.dataset.get("lawyer-golden-set");

const result = await dataset.runExperiment({
  name: `cli-v${prompt.version}-${new Date().toISOString().slice(0, 16)}`,
  description: `lawyer-extractor v${prompt.version} via ${process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5"}`,
  task: async (item) => {
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
      max_tokens: 2000,
      messages: [
        { role: "user", content: prompt.compile({ document: String(item.input) }) },
      ],
    });
    return message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  },
  evaluators: [
    // Deterministic structure check: cheap, objective, instant. The semantic
    // judges (completeness, accuracy) live in the Langfuse UI — both kinds of
    // scorer together is the pattern.
    async ({ output }) => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(String(output));
      } catch {
        return { name: "structure", value: 0, comment: "output is not valid JSON" };
      }
      const missing = REQUIRED_KEYS.filter((key) => !(key in parsed));
      if (missing.length > 0) {
        return { name: "structure", value: 0, comment: `missing keys: ${missing.join(", ")}` };
      }
      if (!JOB_TYPES.includes(parsed.jobType as string)) {
        return { name: "structure", value: 0, comment: `jobType "${parsed.jobType}" not in enum` };
      }
      return { name: "structure", value: 1 };
    },
  ],
  maxConcurrency: 2,
});

console.log(await result.format());
await shutdownTelemetry();
