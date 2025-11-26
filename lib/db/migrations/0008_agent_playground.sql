CREATE TABLE "Agent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "sourcePrompt" text,
  "config" jsonb NOT NULL,
  "status" varchar NOT NULL DEFAULT 'draft',
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "publishedAt" timestamp,
  CONSTRAINT "Agent_status_check" CHECK ("status" IN ('draft', 'published'))
);

CREATE INDEX "Agent_userId_idx" ON "Agent" ("userId");
