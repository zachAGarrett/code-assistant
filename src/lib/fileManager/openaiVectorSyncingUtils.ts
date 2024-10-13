import OpenAI from "openai";
import {
  deleteFileFromOpenAI,
  uploadFileToOpenAI,
} from "./openaiFileSyncingUtils.js";
import chalk from "chalk";
import {
  addFileMapping,
  removeFileMapping,
} from "./maintainVirtualDirectory/fileMap.js";
import path from "path";
import { getMappingFilePath } from "../config/fileWatcher.js";

// Add a file to an existing vector store in OpenAI by its ID
export interface AddFileToVectorStoreParams {
  vectorStoreId: string;
  fileId: string;
  openai: OpenAI;
}
export async function addFileToVectorStore({
  vectorStoreId,
  fileId,
  openai,
}: AddFileToVectorStoreParams) {
  const vectorStoreFile = await openai.beta.vectorStores.files.create(
    vectorStoreId,
    {
      file_id: fileId,
    }
  );
  return vectorStoreFile.id;
}

// Remove a file from a vector store by file ID
export interface DeleteVectorStoreFileParams {
  vectorStoreId: string;
  fileId: string;
  openai: OpenAI;
}
export async function deleteVectorStoreFile({
  vectorStoreId,
  fileId,
  openai,
}: DeleteVectorStoreFileParams) {
  return await openai.beta.vectorStores.files.del(vectorStoreId, fileId);
}

// List all files stored in a specified vector store
export interface ListVectorStoreFilesParams {
  vectorStoreId: string;
  openai: OpenAI;
}
export async function listVectorStoreFiles({
  vectorStoreId,
  openai,
}: ListVectorStoreFilesParams) {
  return await openai.beta.vectorStores.files.list(vectorStoreId);
}

// Locate or create a new vector store in OpenAI
export interface FindOrCreateVectorStoreParams {
  vectorStoreName: string;
  openai: OpenAI;
}
export async function findOrCreateVectorStore({
  vectorStoreName,
  openai,
}: FindOrCreateVectorStoreParams) {
  try {
    // Check if the vector store already exists by name
    const existingVectorStores = await openai.beta.vectorStores.list();
    const matchedVectorStore = existingVectorStores.data.find(
      ({ name }) => name === vectorStoreName
    );

    // If found, retrieve and return the vector store
    if (matchedVectorStore) {
      return await openai.beta.vectorStores.retrieve(matchedVectorStore.id);
    }

    // Otherwise, create a new vector store with the specified name
    return await openai.beta.vectorStores.create({ name: vectorStoreName });
  } catch (error: any) {
    console.error(
      chalk.red(`\nError instantiating vector store: ${error.message}`)
    );
  }
}

export interface UploadFileAndAddToVectoreStoreParams {
  openai: OpenAI;
  vectorStoreId: string;
  filePath: string;
}
export async function uploadFileAndAddToVectoreStore({
  openai,
  filePath,
  vectorStoreId,
}: UploadFileAndAddToVectoreStoreParams) {
  const fileId = await uploadFileToOpenAI({
    filePath,
    purpose: "assistants",
    openai,
  });
  if (fileId) {
    await addFileToVectorStore({
      openai,
      vectorStoreId,
      fileId,
    });
  }
  // Add the file mapping after successful upload
  addFileMapping(path.basename(filePath), fileId, getMappingFilePath());
}

export interface SyncFileIfMissingFromVectorStoreParams {
  vectorStoreId: string;
  openai: OpenAI;
  fileId: string;
}
export async function fileIsMissingFromVectorStore({
  vectorStoreId,
  openai,
  fileId,
}: SyncFileIfMissingFromVectorStoreParams) {
  // Check if the file is already in the vector store
  const vectorStoreFiles = await listVectorStoreFiles({
    vectorStoreId,
    openai,
  });
  if (!vectorStoreFiles.data.some(({ id }) => id === fileId)) {
    return true;
  } else {
    return false;
  }
}

export interface PurgeFileFromOpenAIParams {
  vectorStoreId: string;
  openai: OpenAI;
  fileId: string;
}
export async function purgeFileFromOpenAI({
  vectorStoreId,
  openai,
  fileId,
}: PurgeFileFromOpenAIParams) {
  await deleteFileFromOpenAI({ fileId: fileId, openai });

  const vectorStoreFiles = await listVectorStoreFiles({
    vectorStoreId,
    openai,
  });
  if (vectorStoreFiles.data.some(({ id }) => id === fileId)) {
    await deleteVectorStoreFile({
      vectorStoreId,
      fileId,
      openai,
    }).catch(
      (err: OpenAI.ErrorObject) =>
        err.code === "404" &&
        console.error(chalk.red("\nFile not found in vector store"))
    );
  }

  removeFileMapping(fileId, getMappingFilePath());
}
