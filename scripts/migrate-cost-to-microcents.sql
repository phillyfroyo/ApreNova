-- One-time migration: convert costCents column from cents to microcents
-- Run this AFTER deploying the code change that interprets costCents as microcents.
-- 1 cent = 10,000 microcents, so multiply existing values by 10,000.

UPDATE "ApiCost" SET "costCents" = "costCents" * 10000;
UPDATE "DeletedUserStory" SET "costCents" = "costCents" * 10000;
