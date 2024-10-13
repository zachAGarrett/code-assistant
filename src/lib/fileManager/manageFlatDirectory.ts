import { promises as fs, statSync } from "fs";
import path from "path";
import { glob } from "glob";
import watch from "glob-watcher";
import chalk from "chalk";

function ignoreFile(filePath: string, ignorePatterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  return ignorePatterns.some((pattern) => {
    const regex = new RegExp(
      `^${pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")}(\\/.*)?$`
    );
    return regex.test(normalizedPath);
  });
}

export async function ensureDirectoryExists(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(
      chalk.red(`\nError creating directory: "\n" +${(error as any).message}`)
    );
  }
}

/**
 * Replaces path separators with '->' for flat naming in target directory
 */
export function filenameFromPath(filePath: string, baseDir: string) {
  const relativePath = path.relative(baseDir, filePath);
  return relativePath.split(path.sep).join("->");
}

/**
 * Creates a subdirectory based on the target directory's absolute path in the base directory
 */
export async function ensureInstanceSubdirectory(
  targetDir: string,
  sourceDir: string
) {
  const absoluteTargetDir = path.resolve(targetDir);
  const instanceBaseDirectory = path.join(
    path.dirname(absoluteTargetDir),
    path.basename(absoluteTargetDir),
    path.resolve(sourceDir).split(path.sep).join("--")
  );
  const instanceTrackedDirectory = path.join(instanceBaseDirectory, "/files");

  await ensureDirectoryExists(instanceTrackedDirectory);
  return { instanceBaseDirectory, instanceTrackedDirectory };
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
  const flatFileName = filenameFromPath(sourcePath, baseDir);
  const targetPath = path.join(targetDir, flatFileName);

  try {
    await fs.copyFile(sourcePath, targetPath);
  } catch (error: any) {
    console.error(
      chalk.red(`\nError copying file: ${sourcePath}. Error: ${error.message}`)
    );
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
  const flatFileName = filenameFromPath(sourcePath, baseDir);
  const targetPath = path.join(targetDir, flatFileName);

  try {
    await fs.unlink(targetPath);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.warn(
        chalk.yellow(`\nFile not found for deletion: ${targetPath}`)
      );
    } else {
      console.warn(
        chalk.red(
          `\nError deleting file: ${targetPath}. Error: ${error.message}`
        )
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
  globPattern: string,
  ignorePatterns: string[]
) {
  // First, copy all existing files into the newly created subdirectory
  const fullGlobPattern = path.join(sourceDir, globPattern).replace(/\\/g, "/");
  const files = glob
    .sync(fullGlobPattern)
    .filter(
      (file) => !ignoreFile(file.replace(sourceDir + "/", ""), ignorePatterns)
    ); // Filter ignored files

  // Copy each file
  await Promise.all(files.map((file) => copyFile(file, targetDir, sourceDir)));

  // Use glob-watcher to watch the provided pattern
  const watcher = watch(fullGlobPattern);

  watcher.on("add", (filePath: string) => {
    if (!ignoreFile(filePath.replace(sourceDir + "/", ""), ignorePatterns)) {
      copyFile(filePath, targetDir, sourceDir);
    }
  });

  watcher.on("change", (filePath: string) => {
    if (!ignoreFile(filePath.replace(sourceDir + "/", ""), ignorePatterns)) {
      copyFile(filePath, targetDir, sourceDir);
    }
  });
  watcher.on("unlink", (filePath: string) => {
    deleteFile(filePath, targetDir, sourceDir);
  });
}

// Function to count files in a directory
export async function countFilesInDirectory(
  directoryPath: string
): Promise<number> {
  try {
    // Read the contents of the directory
    const files = await fs.readdir(directoryPath);

    // Filter out directories and count only files
    const fileCount = files.filter((file) => {
      const fullPath = path.join(directoryPath, file);
      return statSync(fullPath).isFile();
    }).length;

    return fileCount;
  } catch (error) {
    console.error(
      chalk.red("\nError reading directory:", "\n" + (error as any).message)
    );
    return 0; // Return 0 or handle error appropriately
  }
}
