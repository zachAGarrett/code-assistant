import { promises as fs } from "fs";
import path from "path";
import { glob } from "glob";
import watch from "glob-watcher";

async function ensureDirectoryExists(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory: ${(error as any).message}`);
  }
}

/**
 * Replaces path separators with '->' for flat naming in target directory
 */
function flattenFilePath(filePath: string, baseDir: string) {
  const relativePath = path.relative(baseDir, filePath);
  return relativePath.split(path.sep).join("->");
}

/**
 * Creates a subdirectory based on the target directory's absolute path in the base directory
 */
async function createSubdirectoryForTarget(targetDir: string) {
  const absoluteTargetDir = path.resolve(targetDir);
  const subdirectory = path.join(
    path.dirname(absoluteTargetDir),
    path.basename(absoluteTargetDir)
  );

  await ensureDirectoryExists(subdirectory);
  return subdirectory;
}

/**
 * Copies a single file to the target directory
 */
async function copyFile(
  sourcePath: string,
  targetDir: string,
  baseDir: string
) {
  await ensureDirectoryExists(targetDir);
  const flatFileName = flattenFilePath(sourcePath, baseDir);
  const targetPath = path.join(targetDir, flatFileName);

  try {
    await fs.copyFile(sourcePath, targetPath);
  } catch (error: any) {
    console.error(`Error copying file: ${sourcePath}. Error: ${error.message}`);
  }
}

/**
 * Deletes a single file from the target directory
 */
async function deleteFile(
  sourcePath: string,
  targetDir: string,
  baseDir: string
) {
  const flatFileName = flattenFilePath(sourcePath, baseDir);
  const targetPath = path.join(targetDir, flatFileName);

  try {
    await fs.unlink(targetPath);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.warn(`File not found for deletion: ${targetPath}`);
    } else {
      console.error(
        `Error deleting file: ${targetPath}. Error: ${error.message}`
      );
    }
  }
}

/**
 * Main function to manage flat file directory
 */
export default async function manageFlatDirectory(
  sourceDir: string,
  targetDir: string,
  globPattern: string
) {
  const newTargetDir = await createSubdirectoryForTarget(targetDir);

  // First, copy all existing files into the newly created subdirectory
  const fullGlobPattern = path.join(sourceDir, globPattern).replace(/\\/g, "/");
  const files = glob.sync(fullGlobPattern);

  // Copy each file
  await Promise.all(
    files.map((file) => copyFile(file, newTargetDir, sourceDir))
  );

  // Use glob-watcher to watch the provided pattern
  const watcher = watch(fullGlobPattern);

  watcher.on("add", (filePath: string) => {
    copyFile(filePath, newTargetDir, sourceDir);
  });

  watcher.on("change", (filePath: string) => {
    copyFile(filePath, newTargetDir, sourceDir);
  });

  watcher.on("unlink", (filePath: string) => {
    deleteFile(filePath, newTargetDir, sourceDir);
  });
}
