// The workflow: pure orchestration, no I/O. This code is replayed from event
// history after a crash — which is why it must be deterministic (no fetch,
// no Math.random, no Date.now; the sandbox enforces it). All the real work
// happens in activities, and Temporal remembers which ones completed.
import * as workflow from "@temporalio/workflow";
import type * as activities from "./activities";
import type { FailedLawyer, LawyerResult, PipelineInput, PipelineSummary } from "./shared";

const { fetchLawyerUrls, downloadBio, extractProfile, saveResults } =
  workflow.proxyActivities<typeof activities>({
    startToCloseTimeout: "2 minutes",
    retry: {
      initialInterval: "2 seconds",
      backoffCoefficient: 2,
      maximumInterval: "30 seconds",
      maximumAttempts: 3,
    },
  });

export async function extractFirmProfiles(input: PipelineInput): Promise<PipelineSummary> {
  const { count, batchSize } = input;

  // Step 1: one activity gives us the work list.
  const urls = await fetchLawyerUrls(count);

  const results: LawyerResult[] = [];
  const failures: FailedLawyer[] = [];

  // Step 2: FAN-OUT. Process `batchSize` lawyers concurrently — each lawyer
  // is a two-activity chain (download -> extract). Promise.all is safe here
  // because it only sequences activity *scheduling*; Temporal records every
  // completion in the event history. Kill the worker at lawyer #40 and
  // restart it: completed lawyers are NOT re-downloaded or re-extracted.
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const settled = await Promise.all(
      batch.map(async (url): Promise<LawyerResult | FailedLawyer> => {
        try {
          const bioText = await downloadBio(url);
          const profile = await extractProfile(bioText);
          return { url, profile };
        } catch (err) {
          // 3 retries already happened (declared above). A lawyer that still
          // fails is recorded and skipped — one bad page must not kill the
          // other 99. Temporal wraps the real error; walk the cause chain so
          // the summary says WHY (e.g. "HTTP 403", "missing API key").
          let cause: unknown = err;
          while (cause instanceof Error && cause.cause) cause = cause.cause;
          const message = cause instanceof Error ? cause.message : String(cause);
          return { url, error: message };
        }
      }),
    );
    for (const item of settled) {
      if ("profile" in item) results.push(item);
      else failures.push(item);
    }
  }

  // Step 3: FAN-IN. Everything collected in one place, written once.
  const outputFile = await saveResults(results);

  return {
    requested: urls.length,
    extracted: results.length,
    failed: failures.length,
    outputFile,
    failures,
  };
}
