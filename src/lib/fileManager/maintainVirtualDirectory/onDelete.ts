import path from "path";
import { findFileInOpenAIByFilename } from "../openaiFileSyncingUtils.js";
import OpenAI from "openai";
import { purgeFileFromOpenAI } from "../openaiVectorSyncingUtils.js";
import chalk from "chalk";

export interface OnDeleteProps {
  filePath: string;
  openai: OpenAI;
  vectorStoreId: string;
  mappingFilePath: string;
}
const onDelete = async ({
  filePath,
  openai,
  vectorStoreId,
  mappingFilePath,
}: OnDeleteProps) => {
  const filename = path.basename(filePath);

  // If the file exists, remove it from OpenAI and the vector store
  const existingFile = await findFileInOpenAIByFilename({ filename, openai });
  if (existingFile) {
    await purgeFileFromOpenAI({
      openai,
      fileId: existingFile.id,
      vectorStoreId,
      mappingFilePath,
    });
    console.log(chalk.blue(`\n${filePath} was removed`));
  }
};

export default onDelete;
