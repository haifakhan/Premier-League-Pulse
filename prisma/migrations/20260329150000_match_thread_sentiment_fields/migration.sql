-- Add match-thread sentiment cache columns to Thread
ALTER TABLE "Thread"
  ADD COLUMN "overallSentiment" TEXT,
  ADD COLUMN "teamSentiments" JSONB,
  ADD COLUMN "sentimentGeneratedAt" TIMESTAMP(3),
  ADD COLUMN "sentimentCommentCount" INTEGER;
