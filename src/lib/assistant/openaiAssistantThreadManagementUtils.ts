import { promises as fs, readFileSync } from "fs";
import OpenAI from "openai";
import path from "path";
import { ensureDirectoryExists } from "../fileManager/manageFlatDirectory.js";
import { animate } from "./cliUtils.js";
import chalk from "chalk";
import { readFileIdMap } from "../fileManager/maintainVirtualDirectory/fileMap.js";
import {
  getInstanceTrackedDirectory,
  getMappingFilePath,
} from "../config/fileWatcher.js";
import { codeReviewInstructions } from "./instructions.js";

export async function findOrCreateAssistant(
  openai: OpenAI,
  params: OpenAI.Beta.Assistants.AssistantCreateParams
) {
  const { name, description } = params;
  // Retrieve list of assistants
  const existingAssistants = await openai.beta.assistants.list();

  // Check if the assistant already exists by name or description
  const assistant = existingAssistants.data.find(
    (asst) => asst.name === name && asst.description === description
  );

  if (assistant) {
    return assistant; // Return the existing assistant
  } else {
    return await openai.beta.assistants.create(params); // Create a new assistant if one doesn't exist
  }
}

export async function createThread(
  openai: OpenAI,
  params: OpenAI.Beta.ThreadCreateParams
) {
  const emptyThread = await openai.beta.threads.create(params);
  return emptyThread;
}

/**
 * Extracts code blocks from a given string containing markdown formatted text.
 * @param responseString The markdown formatted string containing code blocks.
 * @returns An array of code blocks extracted from the markdown.
 */
export function extractCodeBlocks(responseString: string): string[] {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = responseString.match(codeBlockRegex) || [];

  // Cleanup the code blocks by removing the triple backticks and optional language specifier
  return codeBlocks.map((block) =>
    block
      .replace(/```.*?\n?/s, "")
      .replace(/```$/, "")
      .trim()
  );
}

export interface CreateAndPollParams {
  openai: OpenAI;
  threadId: string;
  assistantId: string;
}
export async function createAndPoll({
  openai,
  threadId,
  assistantId,
}: CreateAndPollParams) {
  const pollInterval = 1000; // Poll every 5 seconds
  let run;
  do {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    const runCreateParams: OpenAI.Beta.Threads.RunCreateParamsNonStreaming = {
      assistant_id: assistantId,
      include: ["step_details.tool_calls[*].file_search.results[*].content"],
    };

    run = await openai.beta.threads.runs.createAndPoll(
      threadId,
      runCreateParams
    );
  } while (run.status !== "completed" && run.status !== "failed");

  if (run.status === "failed") {
    throw new Error(run.last_error?.message);
  }

  return run;
}

export interface GetResponseParams {
  openai: OpenAI;
  threadId: string;
  question: string;
  assistantId: string;
}
export async function getResponse({
  openai,
  threadId,
  question,
  assistantId,
}: GetResponseParams) {
  await animate(async () => {
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: question,
    });

    return await createAndPoll({
      openai,
      threadId,
      assistantId,
    });
  }, chalk.blueBright("\nWorking on it"));
  const messagesPage = await openai.beta.threads.messages.list(threadId);
  const response = messagesPage.data[0];
  return response;
}

export interface OutputCodeBlocksParams {
  outDir: string;
  response: OpenAI.Beta.Threads.Messages.Message;
  openai: OpenAI;
}
export async function outputCodeBlocks({
  outDir,
  response,
  openai,
}: OutputCodeBlocksParams) {
  const absoluteOutDir = path.resolve(outDir);

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : undefined;

  const codeBlocks =
    responseText?.value && extractCodeBlocks(responseText?.value);

  if (Array.isArray(codeBlocks)) {
    animate(async () => {
      const validatedCodeObjects = (
        await Promise.all(
          codeBlocks.map(async (code) => {
            const validationResponse = (
              await validateCodeBlock({
                openai,
                annotations: responseText?.annotations,
                code,
              })
            )?.choices[0].message.content;

            if (
              validationResponse === null ||
              validationResponse === undefined
            ) {
              return undefined;
            } else {
              try {
                const codeParts = validationResponse.split("\n");
                return [
                  codeParts[0],
                  extractCodeBlocks(codeParts.slice(1).join("\n"))[0]
                    .split("\n")
                    .slice(1)
                    .join("\n"),
                ];
              } catch (error) {
                console.error(
                  chalk.red(
                    `\nFailed to parse code from response`,
                    validationResponse,
                    "\n" + error
                  )
                );
              }
            }
          })
        )
      ).filter((code) => code !== undefined);

      const writeFilePromises = validatedCodeObjects.map(
        async ([filePath, code]) => {
          try {
            const completeFilePath = path.join(absoluteOutDir, filePath);
            await ensureDirectoryExists(path.dirname(completeFilePath));
            await fs.writeFile(completeFilePath, code);
            console.log(chalk.blue(`\nWrote generated code to ${filePath}`));
          } catch (error) {
            console.error(
              chalk.red(
                `\nFailed to output codeblock as a file.`,
                "\n" + error,
                "\n" + filePath,
                "\n" + code
              )
            );
          }
        }
      );

      await Promise.all(writeFilePromises);
    }, chalk.blue(`\nValidating ${codeBlocks.length} code blocks`));
  }
}

export interface ValidatedCodeObject {
  filePath: string;
  code: string;
}

export interface ValidateCodeBlockProps {
  code: string;
  annotations?: OpenAI.Beta.Threads.Messages.Annotation[];
  openai: OpenAI;
}
export async function validateCodeBlock({
  openai,
  annotations,
  code,
}: ValidateCodeBlockProps) {
  const citedContent =
    annotations &&
    (await Promise.all(
      annotations
        .filter((annotation) => annotation.type === "file_citation")
        .map(async ({ file_citation }) =>
          readFileSync(
            path.join(
              getInstanceTrackedDirectory(),
              readFileIdMap(getMappingFilePath())[file_citation.file_id]
            ),
            "utf-8"
          )
        )
    ));

  const referencedFileContextMessages:
    | OpenAI.ChatCompletionAssistantMessageParam[]
    | undefined = citedContent?.map((content) => ({
    role: "assistant",
    content,
  }));
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: codeReviewInstructions,
    },
    {
      role: "assistant",
      content: `Here's the code for review: \`\`\`\n${code}\`\`\``,
    },
    ...(referencedFileContextMessages || []),
  ];
  try {
    return await openai.chat.completions.create({
      model: "o1-preview",
      messages: messages,
    });
  } catch (error) {
    console.error(chalk.red(`\nFailed to validate code`, "\n" + error));
  }
}
