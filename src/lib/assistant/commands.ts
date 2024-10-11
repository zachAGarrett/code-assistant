import OpenAI from "openai";
import pLimit from "p-limit";
import {
  deleteFileFromOpenAI,
  listOpenAIFiles,
} from "../fileManager/openaiFileSyncingUtils.js";

export interface PurgeFilesProps {
  openai: OpenAI;
}
export async function purgeFiles({ openai }: PurgeFilesProps) {
  const limit = pLimit(5); // Limit to 5 concurrent requests
  const storedFiles = await listOpenAIFiles({ openai });
  await Promise.all(
    storedFiles.map(({ id }) =>
      limit(() =>
        deleteFileFromOpenAI({ openai, fileId: id }).then(
          (res) =>
            res &&
            console.log(
              res.object + res.deleted ? "was deleted" : "could not be deleted"
            )
        )
      )
    )
  );
}
