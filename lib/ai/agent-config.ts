import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "./models";

export const agentToolRegistry = [
  {
    id: "getWeather",
    name: "Weather lookup",
    description: "Fetch the latest weather details for a given location.",
  },
  {
    id: "createDocument",
    name: "Create document",
    description:
      "Generate a new workspace document artifact from the assistant response.",
  },
  {
    id: "updateDocument",
    name: "Update document",
    description: "Modify an existing workspace document artifact by id.",
  },
  {
    id: "requestSuggestions",
    name: "Request follow ups",
    description:
      "Let the model propose follow-up suggestions after a reply is produced.",
  },
] as const;

export type AgentToolId = (typeof agentToolRegistry)[number]["id"];

export const agentConfigSchema = z.object({
  version: z.literal("1.0"),
  primaryModelId: z.string().min(1),
  comparisonModelId: z.string().min(1).nullable().optional(),
  temperature: z.number().min(0).max(2),
  toolIds: z.array(z.string()).default([]),
  welcomeMessage: z.string().min(1),
  presetQuestions: z.array(z.string()).max(8).default([]),
  enableNextStepSuggestions: z.boolean(),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;

export const agentDslSchema = z.object({
  version: z.literal("1.0"),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  config: agentConfigSchema,
});

export type AgentDSL = z.infer<typeof agentDslSchema>;

export function createEmptyAgentConfig(): AgentConfig {
  return {
    version: "1.0",
    primaryModelId: DEFAULT_CHAT_MODEL,
    comparisonModelId: null,
    temperature: 0.7,
    toolIds: [],
    welcomeMessage: "Hello! I am ready to help you.",
    presetQuestions: [],
    enableNextStepSuggestions: true,
  };
}

export function parseAgentConfig(config: unknown): AgentConfig {
  return agentConfigSchema.parse(config);
}

export function toAgentDsl(params: {
  name: string;
  description: string;
  config: AgentConfig;
}): AgentDSL {
  const { name, description, config } = params;
  return {
    version: "1.0",
    name,
    description,
    config,
  };
}
