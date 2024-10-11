import OpenAI from "openai";
import watch from "glob-watcher";
import { findOrCreateVectorStore } from "../openaiVectorSyncingUtils.js";
import { syncFiles } from "../../assistant/commands.js";
import onDelete from "./onDelete.js";
import onChange from "./onChange.js";
import onAdd from "./onAdd.js";

// Watch files in the specified directory and sync with OpenAI.
// Handles additions, changes, and deletions of files in real-time.
export interface WatchAndSyncFilesParams {
  openai: OpenAI;
  sourceDir: string;
  globPattern: string;
  vectorStoreName?: string;
}
export default async function maintainVirtualDirectory({
  openai,
  sourceDir,
  globPattern,
  vectorStoreName = "Programming Assistant Vector Store",
}: WatchAndSyncFilesParams) {
  // Find or create a vector store to store files
  const vectorStore = await findOrCreateVectorStore({
    openai,
    vectorStoreName,
  });
  if (!vectorStore) throw new Error("Vector store was not instantiated");

  // Initial sync: find all files in the temp directory that match the glob pattern
  await syncFiles({
    openai,
    vectorStoreId: vectorStore.id,
    globPattern,
  });

  // Initialize file watcher to detect additions, changes, and deletions
  const watcher = watch(globPattern);

  // Watcher event: file addition
  watcher.on("add", async (filePath: string) =>
    onAdd({ filePath, openai, vectorStoreId: vectorStore.id })
  );

  // Watcher event: file change
  watcher.on("change", async (filePath: string) =>
    onChange({ filePath, openai, vectorStoreId: vectorStore.id })
  );

  // Watcher event: file deletion
  watcher.on("unlink", (filePath: string) =>
    onDelete({ filePath, openai, vectorStoreId: vectorStore.id })
  );

  console.log(`Watching files matching ${globPattern} in ${sourceDir}`);

  return { watcher, vectorStoreId: vectorStore.id };
}
