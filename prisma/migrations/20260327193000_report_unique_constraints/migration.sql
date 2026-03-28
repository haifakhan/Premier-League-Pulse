WITH ranked_post_reports AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "reporterUserId", "postId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rank
  FROM "Report"
  WHERE "postId" IS NOT NULL
)
DELETE FROM "Report" AS report
USING ranked_post_reports
WHERE report.id = ranked_post_reports.id
  AND ranked_post_reports.rank > 1;

WITH ranked_thread_reports AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "reporterUserId", "threadId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rank
  FROM "Report"
  WHERE "threadId" IS NOT NULL
)
DELETE FROM "Report" AS report
USING ranked_thread_reports
WHERE report.id = ranked_thread_reports.id
  AND ranked_thread_reports.rank > 1;

CREATE UNIQUE INDEX "Report_reporterUserId_postId_key" ON "Report"("reporterUserId", "postId");

CREATE UNIQUE INDEX "Report_reporterUserId_threadId_key" ON "Report"("reporterUserId", "threadId");
