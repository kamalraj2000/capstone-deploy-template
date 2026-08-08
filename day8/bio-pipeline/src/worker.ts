// The worker: the process that executes workflows and activities from the
// task queue. This is the process you'll kill mid-run — and the pipeline
// survives it, because progress lives in the Temporal server, not here.
import { Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { TASK_QUEUE } from "./shared";

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve("./workflows"),
    activities,
    taskQueue: TASK_QUEUE,
  });
  console.log(`worker started on task queue "${TASK_QUEUE}" — Ctrl-C to murder it`);
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
