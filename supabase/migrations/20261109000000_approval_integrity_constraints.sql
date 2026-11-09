-- Approval integrity constraints.
--
-- Adds database-level uniqueness for the approval workflow so that concurrent
-- requests cannot create duplicate rows:
--   1. board_rounds(approval_round_id): at most one board round per approval round.
--   2. approval_decisions(approval_round_id, approver_id): at most one decision per
--      approver per approval round.
--   3. approval_rounds(review_cycle_id) WHERE status = 'open': at most one open
--      approval round per review cycle.
--
-- The application already enforces these rules at the application level:
--   - handleCreateApprovalRound (src/app/cases/[id]/actions.ts) refuses to open a
--     round while one is open for the cycle.
--   - handleApprovalDecision (src/app/cases/[id]/actions.ts) refuses a second
--     decision from the same approver on the same round.
--   - findOrCreateBoardRound (src/app/cases/[id]/board/actions.ts) returns the
--     existing board round and re-reads on a concurrent insert.
-- These indexes are the backstop for races between those checks.
--
-- Safety: no data is deleted. Each index is preceded by a DO block that raises
-- an exception, with a query to locate the offending rows, if duplicates already
-- exist. Resolve the duplicates manually and re-run the migration.

-- 1. One board round per approval round.
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT approval_round_id
    FROM "public"."board_rounds"
    GROUP BY approval_round_id
    HAVING count(*) > 1
  ) AS d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot create board_rounds_approval_round_id_key: % approval_round_id value(s) have more than one board_rounds row. Find offenders with: SELECT approval_round_id, count(*), array_agg(id) FROM board_rounds GROUP BY approval_round_id HAVING count(*) > 1;', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "board_rounds_approval_round_id_key"
  ON "public"."board_rounds" ("approval_round_id");

-- 2. One decision per approver per approval round.
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT approval_round_id, approver_id
    FROM "public"."approval_decisions"
    GROUP BY approval_round_id, approver_id
    HAVING count(*) > 1
  ) AS d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot create approval_decisions_round_approver_key: % (approval_round_id, approver_id) pair(s) have more than one approval_decisions row. Find offenders with: SELECT approval_round_id, approver_id, count(*), array_agg(id) FROM approval_decisions GROUP BY approval_round_id, approver_id HAVING count(*) > 1;', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "approval_decisions_round_approver_key"
  ON "public"."approval_decisions" ("approval_round_id", "approver_id");

-- 3. At most one open approval round per review cycle.
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT review_cycle_id
    FROM "public"."approval_rounds"
    WHERE status = 'open'
    GROUP BY review_cycle_id
    HAVING count(*) > 1
  ) AS d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot create approval_rounds_one_open_per_cycle: % review_cycle_id value(s) have more than one open approval_rounds row. Find offenders with: SELECT review_cycle_id, count(*), array_agg(id) FROM approval_rounds WHERE status = ''open'' GROUP BY review_cycle_id HAVING count(*) > 1;', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "approval_rounds_one_open_per_cycle"
  ON "public"."approval_rounds" ("review_cycle_id")
  WHERE "status" = 'open';
