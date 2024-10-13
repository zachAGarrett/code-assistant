import { Config } from "./default.js";

let instanceBaseDirectory: string;
let instanceTrackedDirectory: string;
let mappingFilePath: string;
let config: Config;

export function setGlobalConfig(
  baseDir: string,
  trackedDir: string,
  mappingPath: string,
  configVars: Config
) {
  instanceBaseDirectory = baseDir;
  instanceTrackedDirectory = trackedDir;
  mappingFilePath = mappingPath;
  config = configVars;
}

export function getInstanceBaseDirectory(): string {
  return instanceBaseDirectory;
}

export function getInstanceTrackedDirectory(): string {
  return instanceTrackedDirectory;
}

export function getMappingFilePath(): string {
  return mappingFilePath;
}

export function getConfig(): Config {
  return config;
}
