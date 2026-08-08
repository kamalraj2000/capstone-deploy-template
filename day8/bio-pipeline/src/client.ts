// The client: starts one pipeline run and waits for the summary.
//
//   npm run start           # 10 lawyers (a student-sized run)
//   npm run start -- 100    # the class demo
import { Client, Connection } from "@temporalio/client";
import { TASK_QUEUE } from "./shared";
import type { PipelineSummary } from "./shared";
import { extractFirmProfiles } from "./workflows";

async function run() {
  const count = Number(process.argv[2] ?? 10);
  const connection = await Connection.connect(); // localhost:7233
  const client = new Client({ connection });

  const workflowId = `bio-pipeline-${Date.now()}`;
  const handle = await client.workflow.start(extractFirmProfiles, {
    taskQueue: TASK_QUEUE,
    args: [{ count, batchSize: 5 }],
    workflowId,
  });
  console.log(`started ${workflowId} for ${count} lawyers`);
  console.log(`watch it: http://localhost:8233/namespaces/default/workflows/${workflowId}`);

  const summary: PipelineSummary = await handle.result();
  console.log(`\nrequested: ${summary.requested}`);
  console.log(`extracted: ${summary.extracted}`);
  console.log(`failed:    ${summary.failed}`);
  console.log(`output:    ${summary.outputFile}`);
  for (const failure of summary.failures) {
    console.log(`  ✗ ${failure.url} — ${failure.error}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
