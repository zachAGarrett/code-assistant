import OpenAI from "openai";
import { defaultAssistantInstructions } from "../assistant/instructions.js";

export interface FileSyncConfig {
  sourceDir: string;
  globPattern: string;
}

export interface FileGenerationConfig {
  outDir: string;
}

export interface AssistantConfig {
  name: string;
  description: string;
  instructions: string;
  model: OpenAI.ChatModel;
  generateFiles?: FileGenerationConfig | false;
  ignorePatterns?: string[];
}

export interface Config {
  fileSync: FileSyncConfig;
  assistant: AssistantConfig;
}

export type PartialAssistantConfig = Partial<AssistantConfig>;
export type PartialFileSyncConfig = Partial<FileSyncConfig>;
export interface PartialConfig {
  fileSync: PartialFileSyncConfig;
  assistant?: PartialAssistantConfig;
}
const defaultConfig: Config = {
  assistant: {
    name: "programming assistant",
    description: "Expert programming assistant",
    instructions: defaultAssistantInstructions,
    model: "gpt-4o-mini" as OpenAI.ChatModel,
    generateFiles: false as false,
    ignorePatterns: [],
  },
  fileSync: {
    globPattern:
      "**/*.{c,cpp,cs,css,doc,docx,go,html,java,js,json,md,pdf,php,pptx,py,rb,sh,tex,ts,txt}",
    sourceDir: "./",
  },
};

export default defaultConfig;
