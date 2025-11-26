"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type AgentClientModel,
  createAgentAction,
  exportAgentDslAction,
  generateAgentConfigFromSeed,
  publishAgentAction,
  updateAgentAction,
} from "@/app/(chat)/agent-editor/actions";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  type AgentConfig,
  agentToolRegistry,
  createEmptyAgentConfig,
} from "@/lib/ai/agent-config";
import type { ChatModel } from "@/lib/ai/models";
import { cn, generateUUID } from "@/lib/utils";

const NEW_AGENT_OPTION = "__new__";

type AgentEditorProps = {
  initialAgents: AgentClientModel[];
  models: ChatModel[];
};

type AgentFormState = {
  id: string | null;
  name: string;
  description: string;
  sourcePrompt: string;
  status: "draft" | "published";
  config: AgentConfig;
  publishedAt: string | null;
};

type PreviewMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string;
  variant?: "primary" | "comparison";
  isWelcome?: boolean;
};

export function AgentEditor({ initialAgents, models }: AgentEditorProps) {
  const [agents, setAgents] = useState<AgentClientModel[]>(initialAgents);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    initialAgents[0]?.id ?? null
  );
  const [currentAgent, setCurrentAgent] = useState<AgentFormState>(() =>
    initialAgents[0] ? mapToFormState(initialAgents[0]) : createNewFormState()
  );
  const [seedText, setSeedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [conversation, setConversation] = useState<PreviewMessage[]>(() =>
    buildWelcomeConversation(currentAgent.config)
  );

  const modelNamesById = useMemo(() => {
    return new Map(models.map((model) => [model.id, model.name]));
  }, [models]);

  useEffect(() => {
    if (!selectedAgentId) {
      const fresh = createNewFormState();
      setCurrentAgent(fresh);
      setConversation(buildWelcomeConversation(fresh.config));
      return;
    }

    const existing = agents.find((agent) => agent.id === selectedAgentId);

    if (existing) {
      const mapped = mapToFormState(existing);
      setCurrentAgent(mapped);
      setConversation(buildWelcomeConversation(mapped.config));
    }
  }, [selectedAgentId, agents]);

  useEffect(() => {
    setConversation((prev) => {
      const welcomeOnly =
        prev.length === 0 || (prev.length === 1 && prev[0]?.isWelcome);

      if (!welcomeOnly) {
        return prev;
      }

      return buildWelcomeConversation(currentAgent.config);
    });
  }, [currentAgent.config.welcomeMessage, currentAgent.config.primaryModelId]);

  const handleSeedGenerate = async () => {
    if (!seedText.trim()) {
      toast({ type: "error", description: "请填写一句描述后再生成。" });
      return;
    }

    setIsGenerating(true);
    try {
      const suggestion = await generateAgentConfigFromSeed({ seed: seedText });
      setCurrentAgent((prev) => ({
        ...prev,
        name: suggestion.name,
        description: suggestion.description,
        sourcePrompt: suggestion.sourcePrompt,
        config: cloneConfig(suggestion.config),
      }));
      setConversation(buildWelcomeConversation(suggestion.config));
      toast({ type: "success", description: "已根据描述生成智能体配置。" });
    } catch (error) {
      console.error(error);
      toast({ type: "error", description: "生成配置失败，请稍后再试。" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!currentAgent.name.trim()) {
      toast({ type: "error", description: "请先请输入智能体名称。" });
      return;
    }

    setIsSaving(true);

    const payload = {
      name: currentAgent.name.trim(),
      description: currentAgent.description,
      sourcePrompt: currentAgent.sourcePrompt,
      config: cloneConfig(currentAgent.config),
      status: currentAgent.status,
    } as const;

    try {
      let result: AgentClientModel;

      if (currentAgent.id) {
        result = await updateAgentAction({
          id: currentAgent.id,
          ...payload,
        });
      } else {
        result = await createAgentAction(payload);
      }

      setAgents((prev) => upsertAgentList(prev, result));
      setSelectedAgentId(result.id);
      setCurrentAgent(mapToFormState(result));
      toast({ type: "success", description: "智能体已保存。" });
    } catch (error) {
      console.error(error);
      toast({ type: "error", description: "保存失败，请重试。" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!currentAgent.name.trim()) {
      toast({ type: "error", description: "请先完善智能体名称后再发布。" });
      return;
    }

    setIsPublishing(true);

    try {
      let result: AgentClientModel;

      if (currentAgent.id) {
        result = await publishAgentAction({ id: currentAgent.id });
      } else {
        result = await createAgentAction({
          name: currentAgent.name.trim(),
          description: currentAgent.description,
          sourcePrompt: currentAgent.sourcePrompt,
          config: cloneConfig(currentAgent.config),
          status: "published",
        });
      }

      setAgents((prev) => upsertAgentList(prev, result));
      setSelectedAgentId(result.id);
      setCurrentAgent(mapToFormState(result));
      toast({ type: "success", description: "智能体已发布。" });
    } catch (error) {
      console.error(error);
      toast({ type: "error", description: "发布失败，请重试。" });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExport = async () => {
    if (!currentAgent.id) {
      toast({ type: "error", description: "请先保存智能体后再导出。" });
      return;
    }

    setIsExporting(true);

    try {
      const { content, fileName } = await exportAgentDslAction({
        id: currentAgent.id,
      });

      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ type: "success", description: "DSL 已导出。" });
    } catch (error) {
      console.error(error);
      toast({ type: "error", description: "导出失败，请稍后重试。" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendPreview = async (message: string) => {
    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    setIsSending(true);

    const historyPayload = conversation
      .filter((entry) => entry.role === "user" || entry.role === "assistant")
      .map((entry) => ({ role: entry.role, content: entry.content }));

    const userMessage: PreviewMessage = {
      id: generateUUID(),
      role: "user",
      content: trimmed,
    };

    setConversation((prev) => [...prev, userMessage]);
    setMessageInput("");

    try {
      const response = await fetch("/api/agent-playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: {
            name: currentAgent.name || "未命名智能体",
            description: currentAgent.description,
          },
          config: currentAgent.config,
          history: historyPayload,
          prompt: trimmed,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message ?? "预览请求失败");
      }

      const data = await response.json();
      const nextMessages: PreviewMessage[] = [];

      if (data.primary) {
        nextMessages.push({
          id: generateUUID(),
          role: "assistant",
          content: data.primary.text,
          modelId: data.primary.modelId,
          variant: "primary",
        });
      }

      if (data.comparison) {
        nextMessages.push({
          id: generateUUID(),
          role: "assistant",
          content: data.comparison.text,
          modelId: data.comparison.modelId,
          variant: "comparison",
        });
      }

      setConversation((prev) => [...prev, ...nextMessages]);
    } catch (error) {
      console.error(error);
      toast({ type: "error", description: "生成对话失败，请稍后再试。" });
    } finally {
      setIsSending(false);
    }
  };

  const handlePresetSend = (question: string) => {
    setMessageInput(question);
    handleSendPreview(question).catch((error) => {
      console.error(error);
    });
  };

  const toggleTool = (toolId: string) => {
    setCurrentAgent((prev) => {
      const nextToolIds = new Set(prev.config.toolIds);

      if (nextToolIds.has(toolId)) {
        nextToolIds.delete(toolId);
      } else {
        nextToolIds.add(toolId);
      }

      return {
        ...prev,
        config: {
          ...prev.config,
          toolIds: Array.from(nextToolIds),
        },
      };
    });
  };

  const removePresetQuestion = (index: number) => {
    setCurrentAgent((prev) => {
      const nextQuestions = prev.config.presetQuestions.filter(
        (_question, idx) => idx !== index
      );

      return {
        ...prev,
        config: {
          ...prev.config,
          presetQuestions: nextQuestions,
        },
      };
    });
  };

  const addPresetQuestion = (question: string) => {
    const trimmed = question.trim();

    if (!trimmed) {
      return;
    }

    if (currentAgent.config.presetQuestions.length >= 8) {
      toast({ type: "error", description: "最多可配置 8 个预设问题。" });
      return;
    }

    setCurrentAgent((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        presetQuestions: [...prev.config.presetQuestions, trimmed],
      },
    }));
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex h-full w-full flex-col gap-4 overflow-hidden p-4 md:flex-row">
        <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto md:w-[360px] md:flex-none md:pr-2">
          <Card>
            <CardHeader>
              <CardTitle>智能体管理</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>选择智能体</Label>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      className="flex w-full items-center justify-between"
                      type="button"
                      variant="outline"
                    >
                      <span className="line-clamp-1 text-left">
                        {selectedAgentId
                          ? currentAgent.name || "未命名智能体"
                          : "创建新的智能体"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        打开列表
                      </span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    className="flex h-full w-[320px] max-w-full flex-col gap-4 overflow-y-auto p-0"
                    side="left"
                  >
                    <SheetHeader className="px-6 pt-6 text-left">
                      <SheetTitle>智能体列表</SheetTitle>
                      <SheetDescription>
                        选择已有智能体或创建新的。
                      </SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-1 flex-col gap-3 px-6 pb-6">
                      <SheetClose asChild>
                        <Button
                          className="justify-start"
                          onClick={() => {
                            setSelectedAgentId(null);
                            setSeedText("");
                          }}
                          type="button"
                          variant="outline"
                        >
                          创建新的智能体
                        </Button>
                      </SheetClose>
                      <div className="flex flex-1 flex-col gap-2">
                        {agents.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            当前暂无智能体，请先创建一个。
                          </p>
                        ) : (
                          agents.map((agent) => (
                            <SheetClose asChild key={agent.id}>
                              <button
                                className={cn(
                                  "flex w-full flex-col gap-1 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent",
                                  selectedAgentId === agent.id &&
                                    "border-primary bg-accent"
                                )}
                                onClick={() => {
                                  setSelectedAgentId(agent.id);
                                }}
                                type="button"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">
                                    {agent.name || "未命名智能体"}
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-xs",
                                      agent.status === "published"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-amber-100 text-amber-700"
                                    )}
                                  >
                                    {agent.status === "published"
                                      ? "已发布"
                                      : "草稿"}
                                  </span>
                                </div>
                                {agent.description ? (
                                  <span className="line-clamp-2 text-muted-foreground text-xs">
                                    {agent.description}
                                  </span>
                                ) : null}
                              </button>
                            </SheetClose>
                          ))
                        )}
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seed-prompt">一句话生成</Label>
                <Textarea
                  id="seed-prompt"
                  onChange={(event) => setSeedText(event.target.value)}
                  placeholder="输入一句描述，例如：面向销售团队的分析助手"
                  value={seedText}
                />
                <div className="flex justify-end">
                  <Button
                    disabled={isGenerating}
                    onClick={handleSeedGenerate}
                    variant="secondary"
                  >
                    {isGenerating ? "生成中..." : "智能生成配置"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-name">智能体名称</Label>
                <Input
                  id="agent-name"
                  onChange={(event) =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="请输入智能体名称"
                  value={currentAgent.name}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-description">智能体简介</Label>
                <Textarea
                  id="agent-description"
                  onChange={(event) =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="用一段话描述智能体的定位、语气或能力"
                  value={currentAgent.description}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-source-prompt">系统提示词</Label>
                <Textarea
                  id="agent-source-prompt"
                  onChange={(event) =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      sourcePrompt: event.target.value,
                    }))
                  }
                  placeholder="配置智能体的系统提示词，用于约束语气与行为"
                  rows={6}
                  value={currentAgent.sourcePrompt}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>模型与参数</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>主模型</Label>
                <Select
                  onValueChange={(value) =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        primaryModelId: value,
                      },
                    }))
                  }
                  value={currentAgent.config.primaryModelId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择主模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>对比模型</Label>
                <Select
                  onValueChange={(value) =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        comparisonModelId:
                          value === NEW_AGENT_OPTION ? null : value,
                      },
                    }))
                  }
                  value={
                    currentAgent.config.comparisonModelId ?? NEW_AGENT_OPTION
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择用于对比的模型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW_AGENT_OPTION}>不设置对比</SelectItem>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">
                  温度（{currentAgent.config.temperature.toFixed(1)}）
                </Label>
                <input
                  id="temperature"
                  max={2}
                  min={0}
                  onChange={(event) =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        temperature: Number.parseFloat(event.target.value),
                      },
                    }))
                  }
                  step={0.1}
                  type="range"
                  value={currentAgent.config.temperature}
                />
              </div>

              <div className="space-y-2">
                <Label>工具调用</Label>
                <div className="space-y-1">
                  {agentToolRegistry.map((tool) => {
                    const checked = currentAgent.config.toolIds.includes(
                      tool.id
                    );
                    return (
                      <label
                        className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm"
                        key={tool.id}
                      >
                        <input
                          checked={checked}
                          className="mt-1 h-4 w-4"
                          onChange={() => toggleTool(tool.id)}
                          type="checkbox"
                        />
                        <span>
                          <span className="font-medium">{tool.name}</span>
                          <span className="block text-muted-foreground text-xs">
                            {tool.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2 pb-4 md:flex-row">
            <Button
              className="md:flex-1"
              disabled={isSaving}
              onClick={handleSave}
            >
              {isSaving ? "保存中..." : "保存草稿"}
            </Button>
            <Button
              className="md:flex-1"
              disabled={isPublishing}
              onClick={handlePublish}
              variant="secondary"
            >
              {isPublishing ? "发布中..." : "发布"}
            </Button>
          </div>
          <Button
            disabled={isExporting || !currentAgent.id}
            onClick={handleExport}
            variant="outline"
          >
            {isExporting ? "导出中..." : "导出为 DSL"}
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader>
              <CardTitle>对话体验配置</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <div className="space-y-2">
                <Label htmlFor="welcome-message">欢迎语</Label>
                <Textarea
                  id="welcome-message"
                  onChange={(event) =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        welcomeMessage: event.target.value,
                      },
                    }))
                  }
                  value={currentAgent.config.welcomeMessage}
                />
              </div>

              <div className="space-y-2">
                <Label>问题预设</Label>
                <PresetQuestionEditor
                  onAdd={addPresetQuestion}
                  onRemove={removePresetQuestion}
                  onSend={handlePresetSend}
                  questions={currentAgent.config.presetQuestions}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={currentAgent.config.enableNextStepSuggestions}
                  onChange={() =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        enableNextStepSuggestions:
                          !prev.config.enableNextStepSuggestions,
                      },
                    }))
                  }
                  type="checkbox"
                />
                是否开启下一步问题建议
              </label>
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex items-center justify-between text-muted-foreground text-sm">
                  <span>临时对话预览</span>
                  <Button
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      setConversation(
                        buildWelcomeConversation(currentAgent.config)
                      );
                      setMessageInput("");
                    }}
                    type="button"
                    variant="ghost"
                  >
                    清空对话
                  </Button>
                </div>
                <div className="flex flex-1 flex-col overflow-hidden rounded-md border">
                  <ScrollArea className="flex-1 p-4">
                    <div className="flex flex-col gap-4">
                      {conversation.map((message) => (
                        <PreviewBubble
                          key={message.id}
                          message={message}
                          modelNames={modelNamesById}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                  <form
                    className="flex flex-col gap-2 border-t p-4"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await handleSendPreview(messageInput);
                    }}
                  >
                    <Textarea
                      onChange={(event) => setMessageInput(event.target.value)}
                      placeholder="输入临时对话内容"
                      rows={3}
                      value={messageInput}
                    />
                    <div className="flex justify-end">
                      <Button disabled={isSending} type="submit">
                        {isSending ? "发送中..." : "发送"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function mapToFormState(agent: AgentClientModel): AgentFormState {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    sourcePrompt: agent.sourcePrompt,
    status: agent.status,
    config: cloneConfig(agent.config),
    publishedAt: agent.publishedAt,
  };
}

function createNewFormState(): AgentFormState {
  return {
    id: null,
    name: "",
    description: "",
    sourcePrompt: "",
    status: "draft",
    config: cloneConfig(createEmptyAgentConfig()),
    publishedAt: null,
  };
}

function cloneConfig(config: AgentConfig): AgentConfig {
  return structuredClone(config) as AgentConfig;
}

function buildWelcomeConversation(config: AgentConfig): PreviewMessage[] {
  const welcome = config.welcomeMessage?.trim();

  if (!welcome) {
    return [];
  }

  return [
    {
      id: "welcome",
      role: "assistant",
      content: welcome,
      modelId: config.primaryModelId,
      variant: "primary",
      isWelcome: true,
    },
  ];
}

function upsertAgentList(
  list: AgentClientModel[],
  entry: AgentClientModel
): AgentClientModel[] {
  const exists = list.findIndex((agent) => agent.id === entry.id);

  if (exists === -1) {
    return [...list, entry];
  }

  const next = [...list];
  next[exists] = entry;
  return next;
}

type PresetQuestionEditorProps = {
  questions: string[];
  onAdd: (question: string) => void;
  onRemove: (index: number) => void;
  onSend: (question: string) => void;
};

function PresetQuestionEditor(props: PresetQuestionEditorProps) {
  const { questions, onAdd, onRemove, onSend } = props;
  const [value, setValue] = useState("");
  const duplicateCounter = new Map<string, number>();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {questions.map((question, questionIndex) => {
          const currentCount = duplicateCounter.get(question) ?? 0;
          duplicateCounter.set(question, currentCount + 1);
          const key = `${question}-${currentCount}`;

          return (
            <div
              className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
              key={key}
            >
              <button
                className="text-primary"
                onClick={() => onSend(question)}
                type="button"
              >
                {question}
              </button>
              <button
                className="text-muted-foreground"
                onClick={() => onRemove(questionIndex)}
                type="button"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          onChange={(event) => setValue(event.target.value)}
          placeholder="添加新的预设问题"
          value={value}
        />
        <Button
          onClick={() => {
            onAdd(value);
            setValue("");
          }}
          type="button"
          variant="secondary"
        >
          添加
        </Button>
      </div>
    </div>
  );
}

type PreviewBubbleProps = {
  message: PreviewMessage;
  modelNames: Map<string, string>;
};

function PreviewBubble({ message, modelNames }: PreviewBubbleProps) {
  const isUser = message.role === "user";
  const modelName = message.modelId
    ? modelNames.get(message.modelId)
    : undefined;

  return (
    <div
      className={cn("flex flex-col gap-1", {
        "items-end": isUser,
        "items-start": !isUser,
      })}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg border px-3 py-2 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {message.content}
      </div>
      {!isUser && (
        <span className="text-muted-foreground text-xs">
          {message.variant === "comparison" ? "对比响应" : "主模型"}
          {modelName ? ` · ${modelName}` : ""}
        </span>
      )}
    </div>
  );
}
