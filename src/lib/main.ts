import OpenAI from "openai";
import { createInterface } from "readline";
import dotenv from "dotenv";
import chalk from "chalk";
import {
  createThread,
  getResponse,
  findOrCreateAssistant,
} from "./assistant/openaiAssistantThreadManagementUtils.js";
import maintainVirtualDirectory from "./fileManager/maintainVirtualDirectory/index.js";
import path from "path";
import getConfig from "./assistant/getConfig.js";
import manageFlatDirectory, {
  createSubdirectoryForSourceInTarget,
} from "./fileManager/manageFlatDirectory.js";
import { help, purgeFiles, syncFiles } from "./assistant/commands.js";
import { fileURLToPath } from "url";

// Convert `import.meta.url` to a usable directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Main CLI function
export async function runAssistantCLI(configFilePath: string): Promise<void> {
  const config = await getConfig(configFilePath);
  const openai = new OpenAI({
    apiKey: process.env.apiKey,
    organization: process.env.organization,
    project: process.env.project,
  });

  // Setup the file watching and openAI integrations
  const flatDir = await createSubdirectoryForSourceInTarget(
    __dirname + "/files",
    config.fileSync.sourceDir
  );
  await manageFlatDirectory(
    config.fileSync.sourceDir,
    flatDir,
    config.fileSync.globPattern
  );
  const { vectorStoreId } = await maintainVirtualDirectory({
    openai,
    sourceDir: config.fileSync.sourceDir,
    globPattern: path
      .join(flatDir, config.fileSync.globPattern)
      .replace(/\\/g, "/"),
  });

  // Initialize assistant
  const assistant = await findOrCreateAssistant(openai, config.assistant);
  const thread = await createThread(openai, {
    tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
  });

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // Prompting the user with enhanced styling
  function promptQuestion(): void {
    rl.question(
      chalk.blue(">>> ") +
        chalk.yellow("Ask your question or type `$help` to see commands: "),
      async (question: string) => {
        try {
          if (question === "$help") {
            help();
            promptQuestion();
            return;
          }

          if (question === "$purge") {
            await purgeFiles({ openai, vectorStoreId });
            console.log(chalk.green("All files purged successfully."));
          } else if (question === "$sync") {
            await syncFiles({
              openai,
              vectorStoreId,
              globPattern: path.join(flatDir, config.fileSync.globPattern),
            });
            console.log(chalk.green("Files synchronized successfully."));
          } else {
            const response = await getResponse({
              openai,
              threadId: thread.id,
              question,
              assistantId: assistant.id,
            });
            const lastMessage = response.content[0];
            const lastMessageContent =
              lastMessage.type === "text" && lastMessage.text.value;
            console.log(chalk.magenta(lastMessageContent));
          }
        } catch (error) {
          console.error(chalk.red("An error occurred: "), error);
        } finally {
          promptQuestion();
        }
      }
    );
  }

  promptQuestion(); // Start the interaction
}
