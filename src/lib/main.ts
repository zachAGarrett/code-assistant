import OpenAI from "openai";
import { promises as fs } from "fs";
import { createInterface } from "readline";
import dotenv from "dotenv";
import {
  createThread,
  findOrCreateAssistant,
  getResponse,
} from "./assistant/openaiAssistantThreadManagementUtils.js";
import maintainVirtualDirectory from "./fileManager/maintainVirtualDirectory.js";
import { purgeFiles } from "./assistant/commands.js";
import assistantConfig, { AssistantConfig } from "./assistant/assistantConfig.js";
dotenv.config();

export interface FileSyncConfig {
  sourceDir: string;
  globPattern: string;
}

export interface AssistantConfigOverride {
  name?: string;
  description?: string;
  instructions?: string;
  model?: OpenAI.ChatModel;
}

export interface UserConfig {
  fileSync: FileSyncConfig;
  assistant?: AssistantConfigOverride;
}

export interface CombinedConfig {
  fileSync: FileSyncConfig;
  assistant: AssistantConfig;
}

// Load configuration from JSON file
async function loadConfig(filePath: string): Promise<UserConfig> {
  try {
    const configData = await fs.readFile(filePath, "utf-8");
    return JSON.parse(configData) as UserConfig;
  } catch (error) {
    console.error("Error loading config file:", error);
    process.exit(1);
  }
}

// Merge configs, with environment variables having the highest priority
function mergeConfig(
  assistantConfig: AssistantConfig,
  userConfig: UserConfig
): CombinedConfig {
  return {
    fileSync: {
      sourceDir: userConfig.fileSync.sourceDir,
      globPattern: userConfig.fileSync.globPattern,
    },
    assistant: { ...assistantConfig, ...userConfig },
  };
}

// The main assistant logic encapsulated in a function
export async function runAssistantCLI(configFilePath: string): Promise<void> {
  // Load default configuration from JSON file
  const userConfig = await loadConfig(configFilePath);

  // Merge environment variables (if provided) with the config
  const config = mergeConfig(assistantConfig, userConfig);

  const openai = new OpenAI({
    apiKey: process.env.apiKey,
    organization: process.env.organization,
    project: process.env.project,
  });

  // Initialize synchronization and vector store from config
  const { vectorStoreId: initialVectorStoreId } =
    await maintainVirtualDirectory({
      openai,
      sourceDir: config.fileSync.sourceDir,
      globPattern: config.fileSync.globPattern,
    });

  let vectorStoreId = initialVectorStoreId;

  // Setup the assistant using the config
  const assistant = await findOrCreateAssistant(openai, {
    name: config.assistant.name,
    description: config.assistant.description,
    instructions: config.assistant.instructions,
    model: config.assistant.model,
    tools: [{ type: "file_search" }],
  });

  // Create a conversation thread
  const thread = await createThread(openai, {
    tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
  });

  // Setup readline interface for user input
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Function to handle command prompt interaction
  function promptQuestion(): void {
    rl.question("> ", async (question: string) => {
      try {
        if (question === "$purge") {
          await purgeFiles({ openai });
        } else {
          const { responseContent, codeBlocks } = await getResponse({
            openai,
            threadId: thread.id,
            question,
            assistantId: assistant.id,
          });
          console.log(responseContent);

          Array.isArray(codeBlocks) &&
            codeBlocks.map((code) => console.log(code));
        }
      } catch (error) {
        console.error("An error occurred: ", error);
      } finally {
        promptQuestion();
      }
    });
  }

  // Begin prompting the user for questions
  promptQuestion();
}
