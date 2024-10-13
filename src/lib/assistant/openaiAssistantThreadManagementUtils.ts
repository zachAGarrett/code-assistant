import { promises as fs } from "fs";
import OpenAI from "openai";
import path from "path";
import {
  countFilesInDirectory,
  ensureDirectoryExists,
} from "../fileManager/manageFlatDirectory.js";
import { animate } from "./cliUtils.js";
import chalk from "chalk";

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
  const run = await animate(async () => {
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: question,
    });

    return await createAndPoll({
      openai,
      threadId,
      assistantId,
    });
  }, "Generating response");
  const messagesPage = await openai.beta.threads.messages.list(threadId);
  const response = messagesPage.data[0];
  return { run, response };
}

export function getFileExtensionFromType(fileType: string) {
  // Map of MIME types to their corresponding extensions
  const typeToExtension: Record<string, string> = {
    "x-c": ".c",
    "x-c++": ".cpp",
    "x-csharp": ".cs",
    css: ".css",
    msword: ".doc",
    "vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "x-golang": ".go",
    html: ".html",
    "x-java": ".java",
    javascript: ".js",
    json: ".json",
    markdown: ".md",
    pdf: ".pdf",
    "x-php": ".php",
    "vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "x-python": ".py",
    "x-ruby": ".rb",
    "x-sh": ".sh",
    "x-tex": ".tex",
    typescript: ".ts",
    plain: ".txt",
    plaintext: ".txt",
  };

  // Return the corresponding file extension or .txt if not found
  return typeToExtension[fileType] || ".txt";
}

export function getFileExtensionFromOpenAICodeBlock(openAICodeBlock: string) {
  const lines = openAICodeBlock.split("\n");

  if (lines.length >= 1) {
    return getFileExtensionFromType(lines[0]);
  } else {
    throw "\nCode block did not have any lines";
  }
}

export interface OutputCodeBlocksParams {
  outDir: string;
  run: OpenAI.Beta.Threads.Runs.Run;
  response: OpenAI.Beta.Threads.Messages.Message;
  openai: OpenAI;
}
export async function outputCodeBlocks({
  outDir,
  response,
  run,
  // openai,
}: OutputCodeBlocksParams) {
  const absoluteOutDir = path.resolve(outDir);

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : undefined;

  const codeBlocks =
    responseText?.value && extractCodeBlocks(responseText?.value);

  if (Array.isArray(codeBlocks)) {
    await Promise.all(
      codeBlocks.map(async (code, i) => {
        try {
          // await validateCodeBlock({
          //   openai,
          //   annotations: responseText?.annotations,
          //   code,
          // });
          await ensureDirectoryExists(absoluteOutDir);
          const filesInOutDir = await countFilesInDirectory(absoluteOutDir);
          const fileExtension = getFileExtensionFromOpenAICodeBlock(code);
          const targetPath = path.join(
            absoluteOutDir,
            `generated--${filesInOutDir}--${run.id}--${i}.${fileExtension}`
          );

          // create the file with the code block, less the file type declaration
          await fs.writeFile(targetPath, code.split("\n").slice(1).join("\n"));
        } catch (error) {
          console.error(
            chalk.red(`\nFailed to output codeblock as a file.`, "\n" + error)
          );
        }
      })
    );
  }
}

// export interface ValidateCodeBlockProps {
//   code: string;
//   annotations?: OpenAI.Beta.Threads.Messages.Annotation[];
//   openai: OpenAI;
// }
// export async function validateCodeBlock({
//   openai,
//   annotations,
// }: // code,
// ValidateCodeBlockProps) {
//   console.log(JSON.stringify(annotations, undefined, 2));
//   const citedContent =
//     annotations &&
//     (await Promise.all(
//       annotations
//         .filter((annotation) => annotation.type === "file_citation")
//         .map(async ({ file_citation }) => {
//           file_citation.file_id
//         })
//     ));

//   console.log(JSON.stringify(citedContent, undefined, 2));
// }
