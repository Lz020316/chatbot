"use server";

import { generateText } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  agentConfigSchema,
  agentToolRegistry,
  createEmptyAgentConfig,
  parseAgentConfig,
  toAgentDsl,
} from "@/lib/ai/agent-config";
import { chatModels, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { myProvider } from "@/lib/ai/providers";
import {
  createAgentRecord,
  getAgentByIdSafe,
  getAgentsByUserIdSorted,
  publishAgentRecord,
  updateAgentRecord,
} from "@/lib/db/queries";
import type { Agent } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";

const seedSchema = z.object({
  seed: z.string().trim().min(5),
});

const suggestionSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  primaryModelId: z.string().trim().optional(),
  comparisonModelId: z.string().trim().optional().nullable(),
  temperature: z.number().min(0).max(2).optional(),
  toolIds: z.array(z.string().trim()).optional(),
  welcomeMessage: z.string().trim().optional(),
  presetQuestions: z.array(z.string().trim()).optional(),
  enableNextStepSuggestions: z.boolean().optional(),
});

const upsertSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  sourcePrompt: z.string().trim().optional(),
  config: agentConfigSchema,
  status: z.enum(["draft", "published"]).optional(),
});

const updateSchema = upsertSchema.extend({
  id: z.string().uuid(),
});

function ensureAuthenticated(
  session: Session | null
): asserts session is Session {
  if (!session?.user) {
    throw new ChatSDKError("unauthorized:agent");
  }
}

function sanitizeAgent(agentRecord: Agent) {
  return {
    id: agentRecord.id,
    name: agentRecord.name,
    description: agentRecord.description ?? "",
    sourcePrompt: agentRecord.sourcePrompt ?? "",
    status: agentRecord.status,
    createdAt: agentRecord.createdAt.toISOString(),
    updatedAt: agentRecord.updatedAt.toISOString(),
    publishedAt: agentRecord.publishedAt
      ? agentRecord.publishedAt.toISOString()
      : null,
    config: parseAgentConfig(agentRecord.config),
  };
}

export async function generateAgentConfigFromSeed(input: { seed: string }) {
  const parsedInput = seedSchema.parse(input);
  const session = await auth();
  ensureAuthenticated(session);

  const allowedModelIds = chatModels.map((model) => model.id).join(", ");
  const allowedToolIds = new Set<string>(
    agentToolRegistry.map((tool) => tool.id)
  );
  const systemPrompt = [
    "You design assistant agents for a chat application.",
    "Return a strict JSON object describing the configuration.",
    `Allowed primaryModelId values: ${allowedModelIds}.`,
    "If the summary hints at multimodal or reasoning tasks, you may pick a reasoning model.",
    "Limit presetQuestions to at most 5 diverse, concise examples.",
    "Respond only with JSON and no additional commentary.",
  ].join(" ");

  let rawText: string;

  try {
    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
      system: systemPrompt,
      prompt: parsedInput.seed,
    });
    rawText = text.trim();
  } catch (error) {
    console.error("Failed to generate agent suggestion", error);
    throw new ChatSDKError(
      "bad_request:agent",
      "Unable to generate agent suggestion."
    );
  }

  let payload: z.infer<typeof suggestionSchema>;

  try {
    payload = suggestionSchema.parse(JSON.parse(rawText));
  } catch (error) {
    console.error("Failed to parse agent suggestion payload", rawText, error);
    throw new ChatSDKError(
      "bad_request:agent",
      "Received an invalid agent suggestion."
    );
  }

  const configInput = {
    version: "1.0" as const,
    primaryModelId: payload.primaryModelId ?? DEFAULT_CHAT_MODEL,
    comparisonModelId: payload.comparisonModelId ?? null,
    temperature: payload.temperature ?? 0.7,
    toolIds: Array.from(
      new Set((payload.toolIds ?? []).filter((id) => allowedToolIds.has(id)))
    ),
    welcomeMessage: payload.welcomeMessage ?? "Hello! I am ready to help you.",
    presetQuestions: payload.presetQuestions ?? [],
    enableNextStepSuggestions: payload.enableNextStepSuggestions ?? true,
  } satisfies z.input<typeof agentConfigSchema>;

  const config = agentConfigSchema.parse(configInput);
  const agentName = payload.name ?? "New Agent";
  const agentDescription = payload.description ?? "";

  let craftedSourcePrompt = parsedInput.seed;

  try {
    craftedSourcePrompt = await buildSourcePromptDraft({
      seed: parsedInput.seed,
      name: agentName,
      description: agentDescription,
      config,
    });
  } catch (error) {
    console.error("Failed to craft structured source prompt", error);
  }

  return {
    name: agentName,
    description: agentDescription,
    sourcePrompt: craftedSourcePrompt,
    config,
  };
}

async function buildSourcePromptDraft(params: {
  seed: string;
  name: string;
  description: string;
  config: z.infer<typeof agentConfigSchema>;
}) {
  const { seed, name, description, config } = params;

  const selectedTools = config.toolIds
    .map(
      (toolId) => agentToolRegistry.find((tool) => tool.id === toolId) ?? null
    )
    .filter((tool): tool is (typeof agentToolRegistry)[number] => tool !== null)
    .map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
    }));

  const promptAuthoringSystemPrompt = [
    "You are a senior prompt engineer for enterprise assistants.",
    "Given an agent specification in JSON, craft a detailed system prompt in Chinese.",
    "Follow this outline with Chinese section headings: \u89d2\u8272\u5b9a\u4f4d, \u6838\u5fc3\u4efb\u52a1, \u6c9f\u901a\u98ce\u683c, \u80fd\u529b\u4e0e\u5de5\u5177, \u5de5\u4f5c\u6d41\u7a0b, \u8f93\u51fa\u8981\u6c42, \u9650\u5236\u4e0e\u7981\u6b62.",
    "Use concise bullet lists or numbered steps where appropriate.",
    "Explicitly mention tool usage guidance when tools are provided; otherwise state the assistant works without external tools.",
    "If presetQuestions are available, leverage them to infer common scenarios but do not repeat them verbatim unless helpful.",
    "If enableNextStepSuggestions is true, instruct the assistant to produce follow-up suggestions when confident; otherwise make it clear that no proactive suggestions should be offered.",
    "Ensure the final prompt is actionable, specific, and avoids generic filler sentences.",
    "Return only the final prompt text without additional commentary or markdown fences.",
  ].join(" \n");

  const builderInput = {
    seed,
    persona: {
      name,
      description,
    },
    welcomeMessage: config.welcomeMessage,
    presetQuestions: config.presetQuestions,
    enableNextStepSuggestions: config.enableNextStepSuggestions,
    tools: selectedTools,
  };

  const { text } = await generateText({
    model: myProvider.languageModel("chat-model"),
    system: promptAuthoringSystemPrompt,
    prompt: JSON.stringify(builderInput),
  });

  return text.trim();
}

export async function fetchAgentsForCurrentUser() {
  const session = await auth();
  ensureAuthenticated(session);

  const agents = await getAgentsByUserIdSorted({
    userId: session.user.id,
  });

  return agents.map(sanitizeAgent);
}

export async function createAgentAction(input: z.infer<typeof upsertSchema>) {
  const session = await auth();
  ensureAuthenticated(session);

  const parsed = upsertSchema.parse(input);

  const created = await createAgentRecord({
    userId: session.user.id,
    name: parsed.name,
    description: parsed.description,
    sourcePrompt: parsed.sourcePrompt,
    config: parsed.config,
    status: parsed.status ?? "draft",
  });

  return sanitizeAgent(created);
}

export async function updateAgentAction(input: z.infer<typeof updateSchema>) {
  const session = await auth();
  ensureAuthenticated(session);

  const parsed = updateSchema.parse(input);

  const updated = await updateAgentRecord({
    id: parsed.id,
    userId: session.user.id,
    name: parsed.name,
    description: parsed.description,
    sourcePrompt: parsed.sourcePrompt,
    config: parsed.config,
    status: parsed.status,
  });

  if (!updated) {
    throw new ChatSDKError("not_found:agent");
  }

  return sanitizeAgent(updated);
}

export async function publishAgentAction(input: { id: string }) {
  const session = await auth();
  ensureAuthenticated(session);

  const payload = z.object({ id: z.string().uuid() }).parse(input);

  const published = await publishAgentRecord({
    id: payload.id,
    userId: session.user.id,
  });

  if (!published) {
    throw new ChatSDKError("not_found:agent");
  }

  return sanitizeAgent(published);
}

export async function exportAgentDslAction(input: { id: string }) {
  const session = await auth();
  ensureAuthenticated(session);

  const payload = z.object({ id: z.string().uuid() }).parse(input);

  const agentRecord = await getAgentByIdSafe({ id: payload.id });

  if (!agentRecord) {
    throw new ChatSDKError("not_found:agent");
  }

  if (agentRecord.userId !== session.user.id) {
    throw new ChatSDKError("forbidden:agent");
  }

  const config = parseAgentConfig(
    agentRecord.config ?? createEmptyAgentConfig()
  );
  const dsl = toAgentDsl({
    name: agentRecord.name,
    description: agentRecord.description ?? "",
    config,
  });

  const fileName = createDownloadFileName(agentRecord.name);

  return {
    fileName,
    content: JSON.stringify(dsl, null, 2),
  };
}

function createDownloadFileName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return base ? `${base}.agent.dsl.json` : "agent.dsl.json";
}

export type AgentClientModel = ReturnType<typeof sanitizeAgent>;
