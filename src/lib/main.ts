import OpenAI from "openai";
import { createInterface } from "readline";
import dotenv from "dotenv";
import {
  createThread,
  extractCodeBlocks,
  findOrCreateAssistant,
  getFileExtensionFromOpenAICodeBlock,
  getFileExtensionFromType,
  getResponse,
  outputCodeBlocks,
} from "./assistant/openaiAssistantThreadManagementUtils.js";
import maintainVirtualDirectory from "./fileManager/maintainVirtualDirectory/index.js";
import { purgeFiles, syncFiles } from "./assistant/commands.js";
import getConfig from "./assistant/getConfig.js";
import manageFlatDirectory, {
  countFilesInDirectory,
  createSubdirectoryForSourceInTarget,
  ensureDirectoryExists,
} from "./fileManager/manageFlatDirectory.js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Convert `import.meta.url` to a usable directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

// The main assistant logic encapsulated in a function
export async function runAssistantCLI(configFilePath: string): Promise<void> {
  // Get configuration
  const config = await getConfig(configFilePath);
  const openaiConfig = {
    apiKey: process.env.apiKey,
    organization: process.env.organization,
    project: process.env.project,
  };

  const openai = new OpenAI(openaiConfig);

  const flatDir = await createSubdirectoryForSourceInTarget(
    __dirname + "/files",
    config.fileSync.sourceDir
  );

  // Start the source watcher
  await manageFlatDirectory(
    config.fileSync.sourceDir,
    flatDir,
    config.fileSync.globPattern
  );

  const fullGlobPattern = path
    .join(flatDir, config.fileSync.globPattern)
    .replace(/\\/g, "/");
  // Initialize synchronization and vector store from config
  const { vectorStoreId } = await maintainVirtualDirectory({
    openai,
    sourceDir: config.fileSync.sourceDir,
    globPattern: fullGlobPattern,
  });

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
          await purgeFiles({ openai, vectorStoreId });
        } else if (question === "$sync") {
          await syncFiles({
            openai,
            vectorStoreId: vectorStoreId,
            globPattern: fullGlobPattern,
          });
        } else {
          const response = await getResponse({
            openai,
            threadId: thread.id,
            question,
            assistantId: assistant.id,
          });
          const lastMessage = response.content[0];
          const lastMessageContent =
            lastMessage.type === "text" ? lastMessage.text.value : undefined;
          console.log(lastMessageContent);

          if (
            config.assistant.generateFiles !== undefined &&
            config.assistant.generateFiles !== false
          ) {
            await outputCodeBlocks({
              outDir: config.assistant.generateFiles.outDir,
              lastMessageContent,
              runId: response.run_id,
            });
          }
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
