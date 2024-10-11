import path from "path";
import { findFileInOpenAIByFilename } from "../openaiFileSyncingUtils.js";
import OpenAI from "openai";
import {
  purgeFileFromOpenAI,
  uploadFileAndAddToVectoreStore,
} from "../openaiVectorSyncingUtils.js";

export interface OnChangeProps {
  filePath: string;
  openai: OpenAI;
  vectorStoreId: string;
}
const onChange = async ({ filePath, openai, vectorStoreId }: OnChangeProps) => {
  const filename = path.basename(filePath);

  // If file exists, delete old version and upload new version
  const existingFile = await findFileInOpenAIByFilename({ openai, filename });
  if (existingFile) {
    await purgeFileFromOpenAI({
      openai,
      fileId: existingFile.id,
      vectorStoreId,
    });
  }

  await uploadFileAndAddToVectoreStore({
    openai,
    vectorStoreId,
    filePath,
  })
    .then((_) => console.log(`Memory updated with latest ${filename}.`))
    .catch((err) =>
      console.log(
        `${filename} could not be added to the assistant's memory.`,
        err
      )
    );
};

export default onChange;
