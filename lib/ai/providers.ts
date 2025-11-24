import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

// 使用自定义的AI_BASE_URL和AI_API_KEY创建OpenAI兼容提供商
const customOpenAIProvider = createOpenAICompatible({
  name: "custom-openai-provider",
  baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.AI_API_KEY,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": customOpenAIProvider("deepseek-ai/DeepSeek-V3.1-Terminus"),
        "chat-model-reasoning": wrapLanguageModel({
          model: customOpenAIProvider("moonshotai/Kimi-K2-Thinking"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": customOpenAIProvider("deepseek-ai/DeepSeek-V3.1-Terminus"),
        "artifact-model": customOpenAIProvider("Qwen/Qwen3-VL-30B-A3B-Instruct"),
      },
    });
