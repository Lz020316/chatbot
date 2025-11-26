import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { AgentEditor } from "@/components/agent-editor";
import {
  createEmptyAgentConfig,
  parseAgentConfig,
} from "@/lib/ai/agent-config";
import { chatModels } from "@/lib/ai/models";
import { getAgentsByUserIdSorted } from "@/lib/db/queries";
import type { AgentClientModel } from "./actions";

export default async function AgentEditorPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/guest");
  }

  const agentsFromDb = session.user
    ? await getAgentsByUserIdSorted({ userId: session.user.id })
    : [];

  const initialAgents: AgentClientModel[] = agentsFromDb.map((agent) => {
    let parsedConfig = createEmptyAgentConfig();

    try {
      parsedConfig = parseAgentConfig(agent.config);
    } catch (error) {
      console.warn("Invalid agent config detected, using fallback", {
        agentId: agent.id,
        error,
      });
    }

    return {
      id: agent.id,
      name: agent.name,
      description: agent.description ?? "",
      sourcePrompt: agent.sourcePrompt ?? "",
      status: agent.status,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
      publishedAt: agent.publishedAt ? agent.publishedAt.toISOString() : null,
      config: parsedConfig,
    } satisfies AgentClientModel;
  });

  return (
    <div className="flex h-dvh flex-1 flex-col overflow-hidden">
      <AgentEditor initialAgents={initialAgents} models={chatModels} />
    </div>
  );
}
