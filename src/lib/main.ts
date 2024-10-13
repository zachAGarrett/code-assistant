import OpenAI from "openai";
import { createInterface } from "readline";
import dotenv from "dotenv";
import chalk from "chalk";
import {
  createThread,
  getResponse,
  findOrCreateAssistant,
  outputCodeBlocks,
} from "./assistant/openaiAssistantThreadManagementUtils.js";
import maintainVirtualDirectory from "./fileManager/maintainVirtualDirectory/index.js";
import path from "path";
import getConfig from "./assistant/getConfig.js";
import manageFlatDirectory, {
  ensureInstanceSubdirectory,
} from "./fileManager/manageFlatDirectory.js";
import { help, purgeFiles, syncFiles } from "./assistant/commands.js";
import {
  animate,
  startLoadingAnimation,
  stopLoadingAnimation,
} from "./assistant/cliUtils.js";
import { assetsDir } from "./fileManager/maintainVirtualDirectory/fileMap.js";
import fs from "fs";

// Load environment variables
dotenv.config();

// Main CLI function
export async function runAssistantCLI(configFilePath: string): Promise<void> {
  const openai = new OpenAI({
    apiKey: process.env.apiKey,
    organization: process.env.organization,
    project: process.env.project,
  });
  const config = getConfig(configFilePath);

  const timeout = startLoadingAnimation(
    chalk.blue("Virtualizing watched files")
  );

  const { instanceBaseDirectory, instanceTrackedDirectory } =
    await ensureInstanceSubdirectory(assetsDir, config.fileSync.sourceDir);

  // Define the path for the persistent store (JSON file) in the bin directory
  const mappingFilePath = path.join(instanceBaseDirectory, "/fileMap.json");

  // Initialize store with an empty object if it doesn't exist
  if (!fs.existsSync(mappingFilePath)) {
    fs.writeFileSync(mappingFilePath, JSON.stringify({}));
  }

  await manageFlatDirectory(
    config.fileSync.sourceDir,
    instanceTrackedDirectory,
    config.fileSync.globPattern,
    config.assistant.ignorePatterns || []
  );
  const { vectorStoreId } = await maintainVirtualDirectory({
    openai,
    globPattern: path
      .join(instanceTrackedDirectory, config.fileSync.globPattern)
      .replace(/\\/g, "/"),
    mappingFilePath,
  });
  stopLoadingAnimation(timeout);

  const { assistant, thread } = await animate(async () => {
    const assistant = await findOrCreateAssistant(openai, config.assistant);
    const thread = await createThread(openai, {
      tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
    });

    return { assistant, thread };
  }, chalk.blue("Setting up your assistant"));

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
            await purgeFiles({ openai, vectorStoreId, mappingFilePath }).then(
              (count) =>
                console.log(chalk.blue(`\n${count} files purged successfully.`))
            );
          } else if (question === "$sync") {
            await syncFiles({
              openai,
              vectorStoreId,
              globPattern: path.join(
                instanceTrackedDirectory,
                config.fileSync.globPattern
              ),
              mappingFilePath,
            }).then((count) =>
              console.log(
                chalk.blue(`\n${count} files synchronized successfully.`)
              )
            );
          } else {
            const { run, response } = await getResponse({
              openai,
              threadId: thread.id,
              question,
              assistantId: assistant.id,
            });

            response.content[0].type === "text" &&
              console.log(chalk.magenta("\n" + response.content[0].text.value));

            if (
              config.assistant.generateFiles !== undefined &&
              config.assistant.generateFiles !== false
            ) {
              await outputCodeBlocks({
                outDir: config.assistant.generateFiles.outDir,
                run,
                response,
                openai,
              });
            }
          }
        } catch (error) {
          console.error(chalk.red("\nAn error occurred: ", "\n" + error));
        } finally {
          promptQuestion();
        }
      }
    );
  }

  promptQuestion(); // Start the interaction
}
