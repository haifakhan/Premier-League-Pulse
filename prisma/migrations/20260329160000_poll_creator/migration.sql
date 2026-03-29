ALTER TABLE "Poll"
  ADD COLUMN "createdByUserId" TEXT;

UPDATE "Poll" AS poll
SET "createdByUserId" = thread."authorId"
FROM "Thread" AS thread
WHERE poll."threadId" = thread.id
  AND poll."createdByUserId" IS NULL;

ALTER TABLE "Poll"
  ALTER COLUMN "createdByUserId" SET NOT NULL;

CREATE INDEX "Poll_createdByUserId_idx" ON "Poll"("createdByUserId");

ALTER TABLE "Poll"
  ADD CONSTRAINT "Poll_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
