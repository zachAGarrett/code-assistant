import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Convert `import.meta.url` to a usable directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const assetsDir = path.join(__dirname, "../../../bin/assets/");

// Function to read the mapping from the JSON file
export function readFileIdMap(mappingFilePath: string): Record<string, string> {
  const data = fs.readFileSync(mappingFilePath, "utf-8");
  return JSON.parse(data);
}

// Function to write the mapping to the JSON file
export function writeFileIdMap(
  map: Record<string, string>,
  mappingFilePath: string
): void {
  fs.writeFileSync(mappingFilePath, JSON.stringify(map, null, 2));
}

// Function to add a file mapping
export function addFileMapping(
  fileName: string,
  openAIFileId: string,
  mappingFilePath: string
): void {
  const fileIdMap = readFileIdMap(mappingFilePath);
  fileIdMap[openAIFileId] = fileName;
  writeFileIdMap(fileIdMap, mappingFilePath);
}

// Function to remove a file mapping
export function removeFileMapping(
  openAIFileId: string,
  mappingFilePath: string
): void {
  const fileIdMap = readFileIdMap(mappingFilePath);
  delete fileIdMap[openAIFileId];
  writeFileIdMap(fileIdMap, mappingFilePath);
}
