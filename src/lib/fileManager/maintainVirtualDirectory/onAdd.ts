import path from "path";
import { findFileInOpenAIByFilename } from "../openaiFileSyncingUtils.js";
import OpenAI from "openai";
import {
  syncFileIfMissingFromVectorStore,
  uploadFileAndAddToVectoreStore,
} from "../openaiVectorSyncingUtils.js";

export interface OnAddProps {
  filePath: string;
  openai: OpenAI;
  vectorStoreId: string;
}
const onAdd = async ({ filePath, openai, vectorStoreId }: OnAddProps) => {
  const filename = path.basename(filePath);

  // Check if the file exists in OpenAI and handle accordingly
  const existingFile = await findFileInOpenAIByFilename({ openai, filename });
  if (!existingFile) {
    await uploadFileAndAddToVectoreStore({
      openai,
      vectorStoreId,
      filePath,
    })
      .then((_) =>
        console.log(`${filename} was added to the assistant's memory.`)
      )
      .catch((err) =>
        console.log(
          `${filename} could not be added to the assistant's memory.`,
          err
        )
      );
  } else {
    await syncFileIfMissingFromVectorStore({
      openai,
      vectorStoreId,
      fileId: existingFile.id,
    });
  }
};

export default onAdd;
