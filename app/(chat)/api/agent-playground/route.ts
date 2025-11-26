import { generateText, tool } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  type AgentConfig,
  agentConfigSchema,
  agentToolRegistry,
} from "@/lib/ai/agent-config";
import { myProvider } from "@/lib/ai/providers";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { ChatSDKError } from "@/lib/errors";

const previewCreateDocument = tool({
  description: "Preview stub for document creation.",
  inputSchema: z.object({
    title: z.string().optional(),
    kind: z.string().optional(),
  }),
  execute(input) {
    const title = input.title?.trim() ?? "untitled";
    return {
      preview: true,
      message: `A document named "${title}" would be created in a live environment.`,
      kind: input.kind ?? "text",
    };
  },
});

const previewUpdateDocument = tool({
  description: "Preview stub for document updates.",
  inputSchema: z.object({
    documentId: z.string().optional(),
    summary: z.string().optional(),
  }),
  execute(input) {
    return {
      preview: true,
      message: `A document${input.documentId ? ` (${input.documentId})` : ""} would be updated in a live environment.`,
      summary: input.summary ?? null,
    };
  },
});

const previewRequestSuggestions = tool({
  description: "Preview stub for request suggestions.",
  inputSchema: z.object({
    documentId: z.string().optional(),
  }),
  execute(input) {
    return {
      preview: true,
      documentId: input.documentId ?? null,
      suggestions: [
        "Refine the wording for clarity.",
        "Add a concrete example to support the main idea.",
      ],
    };
  },
});

const toolMap = {
  getWeather,
  createDocument: previewCreateDocument,
  updateDocument: previewUpdateDocument,
  requestSuggestions: previewRequestSuggestions,
} satisfies Record<string, ReturnType<typeof tool>>;

const requestSchema = z.object({
  agent: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  }),
  config: agentConfigSchema,
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
  prompt: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:agent").toResponse();
  }

  let body: z.infer<typeof requestSchema>;

  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch {
    return new ChatSDKError("bad_request:agent").toResponse();
  }

  const { agent, config, history, prompt } = body;

  try {
    const response = await runModel({
      name: agent.name,
      description: agent.description ?? "",
      config,
      history,
      prompt,
      modelId: config.primaryModelId,
    });

    let comparison: Awaited<ReturnType<typeof runModel>> | null = null;

    if (
      config.comparisonModelId &&
      config.comparisonModelId !== config.primaryModelId
    ) {
      comparison = await runModel({
        name: agent.name,
        description: agent.description ?? "",
        config,
        history,
        prompt,
        modelId: config.comparisonModelId,
      });
    }

    return Response.json({
      primary: response,
      comparison,
    });
  } catch (error) {
    console.error("Agent playground generation failed", error);
    return new ChatSDKError("bad_request:agent").toResponse();
  }
}

type ToolId = keyof typeof toolMap;

function selectTools(toolIds: string[]) {
  const availableIds = new Set<ToolId>(
    agentToolRegistry
      .map((entry) => entry.id)
      .filter((id): id is ToolId => id in toolMap)
  );

  const mapped: Record<string, unknown> = {};

  for (const id of toolIds) {
    if (availableIds.has(id as ToolId)) {
      const typedId = id as ToolId;
      mapped[typedId] = toolMap[typedId];
    }
  }

  return mapped as Record<string, ReturnType<typeof tool>>;
}

async function runModel(params: {
  name: string;
  description: string;
  config: AgentConfig;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  prompt: string;
  modelId: string;
}) {
  const { name, description, config, history, prompt, modelId } = params;
  const selectedTools = selectTools(config.toolIds);

  const messages = history.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const { text } = await generateText({
    model: myProvider.languageModel(modelId),
    temperature: config.temperature,
    system: buildSystemPrompt({ name, description, config }),
    messages: [...messages, { role: "user", content: prompt }],
    tools: Object.keys(selectedTools).length > 0 ? selectedTools : undefined,
  });

  return {
    modelId,
    text: text.trim(),
  };
}

function buildSystemPrompt(input: {
  name: string;
  description: string;
  config: AgentConfig;
}) {
  const { name, description, config } = input;
  const lines: string[] = [
    `You are ${name}, a configurable assistant designed for an internal playground.`,
  ];

  if (description.trim()) {
    lines.push(`Agent persona: ${description.trim()}.`);
  }

  lines.push(
    "Keep responses focused, practical, and aligned with the described persona."
  );
  lines.push(`Default welcome message: ${config.welcomeMessage}`);

  if (config.presetQuestions.length > 0) {
    lines.push(
      `Suggested topics you can reference: ${config.presetQuestions.join(", ")}.`
    );
  }

  if (config.enableNextStepSuggestions) {
    lines.push(
      "When appropriate, include up to three concise follow-up suggestions prefixed with 'Next suggestions:'."
    );
  } else {
    lines.push(
      "Do not include follow-up suggestion lists unless explicitly asked."
    );
  }

  return lines.join("\n");
}
