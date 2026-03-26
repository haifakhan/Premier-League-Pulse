-- DropIndex
DROP INDEX "Thread_matchId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Thread_matchId_key" ON "Thread"("matchId");
