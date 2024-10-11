import path from "path";
import OpenAI from "openai";
import watch from "glob-watcher";
import { glob } from "glob";
import pLimit from "p-limit";
import {
  addFileToVectorStore,
  deleteVectorStoreFile,
  findOrCreateVectorStore,
  listVectorStoreFiles,
} from "./openaiVectorSyncingUtils.js";
import manageFlatDirectory from "./manageFlatDirectory.js";
import {
  deleteFileFromOpenAI,
  findFileInOpenAIByFilename,
  uploadFileToOpenAI,
} from "./openaiFileSyncingUtils.js";
import { fileURLToPath } from "url";

// Convert `import.meta.url` to a usable directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Watch files in the specified directory and sync with OpenAI.
// Handles additions, changes, and deletions of files in real-time.
export interface WatchAndSyncFilesParams {
  openai: OpenAI;
  sourceDir: string;
  globPattern: string;
  vectorStoreName?: string;
  tempDir?: string;
}
export default async function maintainVirtualDirectory({
  openai,
  sourceDir,
  globPattern,
  vectorStoreName = "Programming Assistant Vector Store",
  tempDir = __dirname + "/files",
}: WatchAndSyncFilesParams) {
  // Start the source watcher
  await manageFlatDirectory(sourceDir, tempDir, globPattern);

  // Resolve full path pattern for files to watch
  const fullGlobPattern = path.join(tempDir, globPattern).replace(/\\/g, "/");

  // Find or create a vector store to store files
  const vectorStore = await findOrCreateVectorStore({
    openai,
    vectorStoreName,
  });
  if (!vectorStore) throw new Error("Vector store was not instantiated");

  // Map to track synced files (local file ID -> vector store file ID)
  const files: Map<string, string> = new Map();

  // Initial sync: find all files in the temp directory that match the glob pattern
  const matchedFiles = await glob(fullGlobPattern);

  const limit = pLimit(5); // Limit to 5 concurrent requests
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
          console.log(`${filename} was new`);
          const fileId = await uploadFileToOpenAI({
            filePath,
            purpose: "assistants",
            openai,
          });
          if (fileId) {
            const vectorFileId = await addFileToVectorStore({
              vectorStoreId: vectorStore.id,
              fileId,
              openai,
            });
            files.set(fileId, vectorFileId);
            console.log(`${filename} successfully synced.`);
          }
        } else {
          // Check if the file is already in the vector store
          const vectorStoreFiles = await listVectorStoreFiles({
            vectorStoreId: vectorStore.id,
            openai,
          });
          if (!vectorStoreFiles.data.some(({ id }) => id === existingFile.id)) {
            const vectorFileId = await addFileToVectorStore({
              vectorStoreId: vectorStore.id,
              fileId: existingFile.id,
              openai,
            });
            files.set(existingFile.id, vectorFileId);
          }
        }
      })
    )
  );
  console.log(`Successfully synced ${matchedFiles.length} project files.`);

  // Initialize file watcher to detect additions, changes, and deletions
  const watcher = watch(fullGlobPattern);

  // Watcher event: file addition
  watcher.on("add", async (filePath: string) => {
    console.log(`File added: ${filePath}`);
    const filename = path.basename(filePath);

    // Check if the file exists in OpenAI and handle accordingly
    const existingFile = await findFileInOpenAIByFilename({ openai, filename });
    if (!existingFile) {
      const fileId = await uploadFileToOpenAI({
        filePath,
        purpose: "assistants",
        openai,
      });
      if (fileId) {
        const vectorFileId = await addFileToVectorStore({
          openai,
          vectorStoreId: vectorStore.id,
          fileId,
        });
        files.set(fileId, vectorFileId);
        console.log(`${filename} was updated in the assistant's memory.`);
      }
    } else {
      const vectorStoreFiles = await listVectorStoreFiles({
        vectorStoreId: vectorStore.id,
        openai,
      });
      if (!vectorStoreFiles.data.some(({ id }) => id === existingFile.id)) {
        const vectorFileId = await addFileToVectorStore({
          vectorStoreId: vectorStore.id,
          fileId: existingFile.id,
          openai,
        });
        files.set(existingFile.id, vectorFileId);
      }
    }
  });

  // Watcher event: file change
  watcher.on("change", async (filePath: string) => {
    console.log(`${filePath} was modified.`);
    const filename = path.basename(filePath);

    // If file exists, delete old version and upload new version
    const existingFile = await findFileInOpenAIByFilename({ openai, filename });
    if (existingFile) {
      await deleteFileFromOpenAI({ fileId: existingFile.id, openai });

      const vectorStoreFiles = await listVectorStoreFiles({
        openai,
        vectorStoreId: vectorStore.id,
      });
      if (vectorStoreFiles.data.some(({ id }) => id === existingFile.id)) {
        await deleteVectorStoreFile({
          vectorStoreId: vectorStore.id,
          fileId: existingFile.id,
          openai,
        });
      }
    }

    const fileId = await uploadFileToOpenAI({
      openai,
      filePath,
      purpose: "assistants",
    });
    if (fileId) {
      const vectorFileId = await addFileToVectorStore({
        vectorStoreId: vectorStore.id,
        fileId,
        openai,
      });
      files.set(fileId, vectorFileId);
      console.log(`Memory updated with latest ${filename}.`);
    }
  });

  // Watcher event: file deletion
  watcher.on("unlink", async (filePath: string) => {
    console.log(`${filePath} was removed`);
    const filename = path.basename(filePath);

    // If the file exists, remove it from OpenAI and the vector store
    const existingFile = await findFileInOpenAIByFilename({ filename, openai });
    if (existingFile) {
      await deleteFileFromOpenAI({ fileId: existingFile.id, openai });

      const vectorStoreFiles = await listVectorStoreFiles({
        vectorStoreId: vectorStore.id,
        openai,
      });
      if (vectorStoreFiles.data.some(({ id }) => id === existingFile.id)) {
        await deleteVectorStoreFile({
          vectorStoreId: vectorStore.id,
          fileId: existingFile.id,
          openai,
        });
      }

      files.delete(existingFile.id);
    }
  });

  console.log(`Watching files matching: ${fullGlobPattern}`);

  return { watcher, vectorStoreId: vectorStore.id };
}
