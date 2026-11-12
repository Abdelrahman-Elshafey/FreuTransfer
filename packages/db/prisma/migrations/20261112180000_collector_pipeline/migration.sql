-- CreateEnum
CREATE TYPE "CollectorRunStatus" AS ENUM ('running', 'succeeded', 'failed');

-- AlterTable
ALTER TABLE "mid_market_rates" ADD COLUMN     "raw_observation_id" BIGINT;

-- CreateTable
CREATE TABLE "collector_runs" (
    "id" BIGSERIAL NOT NULL,
    "collector" TEXT NOT NULL,
    "status" "CollectorRunStatus" NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),
    "error" TEXT,

    CONSTRAINT "collector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_observations" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "url" TEXT NOT NULL,
    "http_status" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "raw_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collector_runs_collector_started_at_idx" ON "collector_runs"("collector", "started_at" DESC);

-- CreateIndex
CREATE INDEX "raw_observations_run_id_idx" ON "raw_observations"("run_id");

-- AddForeignKey
ALTER TABLE "mid_market_rates" ADD CONSTRAINT "mid_market_rates_raw_observation_id_fkey" FOREIGN KEY ("raw_observation_id") REFERENCES "raw_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_observations" ADD CONSTRAINT "raw_observations_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "collector_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written below this line (Prisma can't express these rules).
-- ---------------------------------------------------------------------------

-- A run's state and its columns agree: running = not finished; a failed run says why.
ALTER TABLE "collector_runs" ADD CONSTRAINT "collector_runs_state_check" CHECK (
  ("status" = 'running' AND "finished_at" IS NULL AND "error" IS NULL)
  OR ("status" = 'succeeded' AND "finished_at" IS NOT NULL AND "error" IS NULL)
  OR ("status" = 'failed' AND "finished_at" IS NOT NULL AND "error" IS NOT NULL AND "error" <> '')
);
ALTER TABLE "collector_runs" ADD CONSTRAINT "collector_runs_times_check" CHECK (
  "finished_at" IS NULL OR "finished_at" >= "started_at"
);

-- Raw responses are evidence: append-only, like the rates parsed from them.
CREATE TRIGGER "raw_observations_append_only"
  BEFORE UPDATE OR DELETE ON "raw_observations"
  FOR EACH ROW EXECUTE FUNCTION "forbid_update_delete"();

-- A collector run is inserted when it starts and finished exactly once (status, finished_at,
-- error); after that it never changes, and no run is ever deleted.
CREATE FUNCTION "collector_run_finish_once"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Table % is append-only: DELETE is not allowed', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."status" <> 'running' THEN
    RAISE EXCEPTION 'Collector run % is already finished', OLD."id"
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."id" <> OLD."id" OR NEW."collector" <> OLD."collector" OR NEW."started_at" <> OLD."started_at" THEN
    RAISE EXCEPTION 'Only status, finished_at and error of a running collector run may change'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "collector_runs_finish_once"
  BEFORE UPDATE OR DELETE ON "collector_runs"
  FOR EACH ROW EXECUTE FUNCTION "collector_run_finish_once"();
