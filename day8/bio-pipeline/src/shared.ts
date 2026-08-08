export const TASK_QUEUE = "bio-pipeline";

export interface PipelineInput {
  /** How many lawyers to process (sitemap order). */
  count: number;
  /** How many lawyers to process concurrently per batch. */
  batchSize: number;
}

export interface LawyerResult {
  url: string;
  /** The extracted profile JSON (string, as returned by the model). */
  profile: string;
}

export interface FailedLawyer {
  url: string;
  error: string;
}

export interface PipelineSummary {
  requested: number;
  extracted: number;
  failed: number;
  outputFile: string;
  failures: FailedLawyer[];
}
