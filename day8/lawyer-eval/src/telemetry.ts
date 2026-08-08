// Loads env, starts OTEL, and instruments the Anthropic SDK — import this
// FIRST from any script that should be traced.
//
// Note: LangfuseSpanProcessor filters spans by default — only Langfuse-created
// spans, `gen_ai.*` spans, and known LLM instrumentation scopes are exported.
// Your HTTP/DB/framework spans never leave the process, and never count
// against the free tier's 50k units/month. That default is exactly what you
// want: Langfuse gets the AI parts, nothing else.
import "dotenv/config";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { AnthropicInstrumentation } from "@arizeai/openinference-instrumentation-anthropic";
import Anthropic from "@anthropic-ai/sdk";

const instrumentation = new AnthropicInstrumentation();
instrumentation.manuallyInstrument(Anthropic);

export const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
  instrumentations: [instrumentation],
});
sdk.start();

// Call before the process exits so buffered spans are flushed to Langfuse.
export async function shutdownTelemetry(): Promise<void> {
  await sdk.shutdown();
}
