import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";

type SupabaseLikeError = {
  code?: string;
  message: string;
};

export type SourceErrorPayload = {
  sourceId: number | null;
  rssUrl: string;
  error: string;
};

export type PipelineRunMetrics = {
  articleCount: number;
  eventCount: number;
  summaryCount: number;
};

type PipelineRunRow = {
  id: number;
  status: "running" | "success" | "failed";
};

type SupabaseLike = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: PipelineRunRow | null; error: SupabaseLikeError | null }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => {
        select: (columns: string) => {
          single: () => Promise<{ data: PipelineRunRow | null; error: SupabaseLikeError | null }>;
        };
      };
    };
  };
};

function nowIso() {
  return new Date().toISOString();
}

export function createPipelineRepository(client = getSupabaseAdminClient() as unknown as SupabaseLike) {
  return {
    async startPipelineRun(trigger: string): Promise<PipelineRunRow> {
      const { data, error } = await client
        .from("pipeline_runs")
        .insert({
          started_at: nowIso(),
          status: "running",
          trigger,
        })
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("pipeline_locked");
        }
        throw new Error(error.message);
      }
      if (!data) {
        throw new Error("pipeline_run_start_failed");
      }
      return data;
    },

    async finishPipelineRunSuccess(
      runId: number,
      metrics: PipelineRunMetrics,
      sourceErrors: SourceErrorPayload[],
    ): Promise<PipelineRunRow> {
      const { data, error } = await client
        .from("pipeline_runs")
        .update({
          ended_at: nowIso(),
          status: "success",
          article_count: metrics.articleCount,
          event_count: metrics.eventCount,
          summary_count: metrics.summaryCount,
          source_errors_json: sourceErrors,
        })
        .eq("id", runId)
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "pipeline_run_finish_success_failed");
      }
      return data;
    },

    async finishPipelineRunFailure(
      runId: number,
      errorMessage: string,
      sourceErrors: SourceErrorPayload[],
    ): Promise<PipelineRunRow> {
      const { data, error } = await client
        .from("pipeline_runs")
        .update({
          ended_at: nowIso(),
          status: "failed",
          error: errorMessage,
          source_errors_json: sourceErrors,
        })
        .eq("id", runId)
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "pipeline_run_finish_failure_failed");
      }
      return data;
    },
  };
}
