import OpenAI from "openai";
import defaultConfig, { DefaultConfig } from "./defaultConfig.js";
import { promises as fs } from "fs";
import merge from "lodash.merge";

export interface FileSyncConfig {
  sourceDir: string;
  globPattern: string;
}

export interface fileGenerationConfig {
  outDir: string;
}

export interface AssistantConfig {
  name: string;
  description: string;
  instructions: string;
  model: OpenAI.ChatModel;
  generateFiles?: fileGenerationConfig | false;
}

export interface Config {
  fileSync: FileSyncConfig;
  assistant: AssistantConfig;
}

export interface PartialFileSyncConfig {
  sourceDir: string;
  globPattern?: string;
}
export type PartialAssistantConfig = Partial<AssistantConfig>;
export interface PartialConfig {
  fileSync: PartialFileSyncConfig;
  assistant?: PartialAssistantConfig;
}

// Load configuration from JSON file
export async function loadConfig(filePath: string): Promise<PartialConfig> {
  try {
    const configData = await fs.readFile(filePath, "utf-8");
    return JSON.parse(configData) as PartialConfig;
  } catch (error) {
    console.error("Error loading config file:", error);
    process.exit(1);
  }
}

export function mergeConfig(
  defaultConfig: DefaultConfig,
  userConfig: PartialConfig
): Config {
  if (userConfig.fileSync.sourceDir === undefined) {
    throw new Error(
      "fileSync.sourceDir must be defined in assistant-config.json"
    );
  }

  const mergedConfig: Config = merge(
    {}, // Start with an empty object to avoid mutating defaultConfig
    defaultConfig, // Base defaults
    userConfig // User overrides
  );

  return mergedConfig;
}

export default async function getConfig(
  userConfigFilePath: string
): Promise<Config> {
  // Load default configuration from JSON file
  const userConfig = await loadConfig(userConfigFilePath);

  // Merge environment variables (if provided) with the config
  const config = mergeConfig(defaultConfig, userConfig);

  return config;
}
