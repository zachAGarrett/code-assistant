import OpenAI from "openai";
import pLimit from "p-limit";
import {
  findFileInOpenAIByFilename,
  listOpenAIFiles,
} from "../fileManager/openaiFileSyncingUtils.js";
import { glob } from "glob";
import path from "path";
import {
  purgeFileFromOpenAI,
  syncFileIfMissingFromVectorStore,
  uploadFileAndAddToVectoreStore,
} from "../fileManager/openaiVectorSyncingUtils.js";
import chalk from "chalk";

export interface PurgeFilesProps {
  openai: OpenAI;
  vectorStoreId: string;
}
export async function purgeFiles({ openai, vectorStoreId }: PurgeFilesProps) {
  const limit = pLimit(5); // Limit to 5 concurrent requests
  const storedFiles = await listOpenAIFiles({ openai });
  const purgeRes = await Promise.all(
    storedFiles.map(({ id }) =>
      limit(() => purgeFileFromOpenAI({ openai, vectorStoreId, fileId: id }))
    )
  );
  console.log(purgeRes.length + " files were deleted.");
}

export interface SyncFilesProps {
  openai: OpenAI;
  globPattern: string;
  vectorStoreId: string;
}
export async function syncFiles({
  openai,
  globPattern,
  vectorStoreId,
}: SyncFilesProps) {
  const limit = pLimit(5); // Limit to 5 concurrent requests

  // Initial sync: find all files in the temp directory that match the glob pattern
  const matchedFiles = await glob(globPattern);

  // Process each file found during initial sync
  console.log(`Ensuring ${matchedFiles.length} project files are synced...`);
  await Promise.all(
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
          })
            .then((_) => console.log(`${filename} successfully synced.`))
            .catch((err) =>
              console.log(`${filename} could not be synced.`, err)
            );
        } else {
          await syncFileIfMissingFromVectorStore({
            openai,
            vectorStoreId,
            fileId: existingFile.id,
          });
        }
      })
    )
  );
  console.log(`Successfully synced ${matchedFiles.length} project files.`);
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
