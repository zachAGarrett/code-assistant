import chalk from "chalk";
import fs from "fs";
import OpenAI from "openai";
import {
  addFileMapping,
  removeFileMapping,
} from "./maintainVirtualDirectory/fileMap.js";
import { filenameFromPath } from "./manageFlatDirectory.js";

// Upload a file to OpenAI with an additional comment containing the document path.
// The comment is only included in the uploaded file and not saved locally.
export interface UploadFileToOpenAIParams {
  filePath: string;
  purpose: OpenAI.FilePurpose;
  openai: OpenAI;
  mappingFilePath: string;
}

export async function uploadFileToOpenAI({
  filePath,
  purpose = "assistants",
  openai,
}: UploadFileToOpenAIParams) {
  // Create a readable stream from the file
  const fileStream = fs.createReadStream(filePath);

  try {
    // Upload the file to OpenAI for the specified purpose
    const file = await openai.files.create({
      file: fileStream,
      purpose: purpose,
    });

    return file.id;
  } catch (error) {
    console.error(
      chalk.red(`\nError uploading file: \n${(error as any).message}`)
    );
    throw error;
  }
}

// Delete a file from OpenAI by its ID
export interface DeleteFileFromOpenAIParams {
  fileId: string;
  openai: OpenAI;
}
export async function deleteFileFromOpenAI({
  fileId,
  openai,
}: DeleteFileFromOpenAIParams) {
  try {
    await openai.files.del(fileId);
  } catch (error: any) {
    console.error(
      chalk.red(`\nError deleting file ${fileId}: ${error.message}`)
    );
  }
}

// List all files currently uploaded to OpenAI
export interface ListOpenAIFilesParams {
  openai: OpenAI;
}
export async function listOpenAIFiles({ openai }: ListOpenAIFilesParams) {
  try {
    const fileList = await openai.files.list();
    return fileList.data;
  } catch (error: any) {
    console.error(chalk.red(`\nError listing files: ${error.message}`));
    return [];
  }
}

// Find a file in OpenAI's system by its local filename (basename)
export interface FindFileInOpenAIByFilenameParams {
  openai: OpenAI;
  filename: string;
}
export async function findFileInOpenAIByFilename({
  filename,
  openai,
}: FindFileInOpenAIByFilenameParams) {
  const files = await listOpenAIFiles({ openai });
  return files.find((file: any) => file.filename === filename);
}
