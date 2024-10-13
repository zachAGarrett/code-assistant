import OpenAI from "openai";
import pLimit from "p-limit";
import {
  findFileInOpenAIByFilename,
  listOpenAIFiles,
} from "../fileManager/openaiFileSyncingUtils.js";
import { glob } from "glob";
import path from "path";
import {
  addFileToVectorStore,
  fileIsMissingFromVectorStore,
  purgeFileFromOpenAI,
  uploadFileAndAddToVectoreStore,
} from "../fileManager/openaiVectorSyncingUtils.js";
import chalk from "chalk";
import { animate } from "./cliUtils.js";
import {
  addFileMapping,
  readFileIdMap,
} from "../fileManager/maintainVirtualDirectory/fileMap.js";

export interface PurgeFilesProps {
  openai: OpenAI;
  vectorStoreId: string;
  mappingFilePath: string;
}
export async function purgeFiles({
  openai,
  vectorStoreId,
  mappingFilePath,
}: PurgeFilesProps) {
  const storedFiles = await animate(
    () => listOpenAIFiles({ openai }),
    chalk.blue("Looking for files to purge")
  );

  if (storedFiles.length > 0) {
    const limit = pLimit(5);
    return (
      await animate(
        () =>
          Promise.all(
            storedFiles.map(({ id }) =>
              limit(() =>
                purgeFileFromOpenAI({
                  openai,
                  vectorStoreId,
                  fileId: id,
                  mappingFilePath,
                })
              )
            )
          ),
        chalk.blue(`Deleting ${storedFiles.length} project files`)
      )
    ).length;
  } else {
    return 0;
  }
}

export interface SyncFilesProps {
  openai: OpenAI;
  globPattern: string;
  vectorStoreId: string;
  mappingFilePath: string;
}
export async function syncFiles({
  openai,
  globPattern,
  vectorStoreId,
  mappingFilePath,
}: SyncFilesProps) {
  // Initial sync: find all files in the temp directory that match the glob pattern
  const matchedFiles = await animate(
    () => glob(globPattern),
    chalk.blue("Looking for files to sync.")
  );

  if (matchedFiles.length > 0) {
    // Process each file found during initial sync
    const limit = pLimit(5); // Limit to 5 concurrent requests
    await animate(
      () =>
        Promise.all(
          matchedFiles.map((filePath) =>
            limit(async () => {
              const filename = path.basename(filePath);

              // Check if the file already exists in OpenAI
              const existingFile = await findFileInOpenAIByFilename({
                openai,
                filename,
              });

              // If the file does not exist, upload it to OpenAI and add to the vector store
              if (!existingFile) {
                await uploadFileAndAddToVectoreStore({
                  openai,
                  vectorStoreId,
                  filePath,
                  mappingFilePath,
                })
                  .then((_) =>
                    console.log(
                      chalk.blue(`\n${filename} successfully synced.`)
                    )
                  )
                  .catch((err) =>
                    console.log(
                      chalk.red(
                        `\n${filename} could not be synced.`,
                        "\n" + err
                      )
                    )
                  );
              } else if (
                await fileIsMissingFromVectorStore({
                  openai,
                  vectorStoreId,
                  fileId: existingFile.id,
                })
              ) {
                await addFileToVectorStore({
                  vectorStoreId,
                  fileId: existingFile.id,
                  openai,
                });
              } else if (
                Object.hasOwn(
                  readFileIdMap(mappingFilePath),
                  existingFile.id
                ) === false
              ) {
                addFileMapping(
                  path.basename(filePath),
                  existingFile.id,
                  mappingFilePath
                );
              }
            })
          )
        ),
      chalk.blue(`Ensuring ${matchedFiles.length} project files are synced`)
    );
    return matchedFiles.length;
  } else {
    return 0;
  }
}

export function help() {
  console.log(chalk.green("Available commands:"));
  console.log(chalk.cyan("$purge - Purge all stored files from OpenAI."));
  console.log(chalk.cyan("$sync - Sync files with OpenAI."));
  console.log(
    chalk.cyan(
      "Any other input will be processed as a question to the assistant."
    )
  );
  return;
}
