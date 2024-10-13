import path from "path";
import { findFileInOpenAIByFilename } from "../openaiFileSyncingUtils.js";
import OpenAI from "openai";
import {
  addFileToVectorStore,
  fileIsMissingFromVectorStore,
  uploadFileAndAddToVectoreStore,
} from "../openaiVectorSyncingUtils.js";
import chalk from "chalk";

export interface OnAddProps {
  filePath: string;
  openai: OpenAI;
  vectorStoreId: string;
  mappingFilePath: string;
}
const onAdd = async ({
  filePath,
  openai,
  vectorStoreId,
  mappingFilePath,
}: OnAddProps) => {
  const filename = path.basename(filePath);

  // Check if the file exists in OpenAI and handle accordingly
  const existingFile = await findFileInOpenAIByFilename({ openai, filename });
  if (!existingFile) {
    await uploadFileAndAddToVectoreStore({
      openai,
      vectorStoreId,
      filePath,
      mappingFilePath,
    })
      .then((_) =>
        console.log(
          chalk.blue(`\n${filename} was added to the assistant's memory.`)
        )
      )
      .catch((err) =>
        console.error(
          chalk.red(
            `\n${filename} could not be added to the assistant's memory.`,
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
  }
};

export default onAdd;
