import chalk from "chalk";
import defaultConfig, {
  Config,
  DefaultConfig,
  PartialConfig,
} from "./defaultConfig.js";
import { readFileSync } from "fs";
import merge from "lodash.merge";

// Load configuration from JSON file
function loadConfig(filePath: string): PartialConfig {
  try {
    const configData = readFileSync(filePath, "utf-8");
    return JSON.parse(configData) as PartialConfig;
  } catch (error) {
    console.error(chalk.red("\nError loading config file:", "\n" + error));
    process.exit(1);
  }
}

function mergeConfig(
  defaultConfig: DefaultConfig,
  userConfig: PartialConfig
): Config {
  if (userConfig.fileSync.sourceDir === undefined) {
    throw new Error("fileSync.sourceDir must be defined in para-config.json");
  }

  const mergedConfig: Config = merge(
    {}, // Start with an empty object to avoid mutating defaultConfig
    defaultConfig, // Base defaults
    userConfig // User overrides
  );

  return mergedConfig;
}

export default function getConfig(userConfigFilePath: string): Config {
  // Load default configuration from JSON file
  const userConfig = loadConfig(userConfigFilePath);

  // Merge environment variables (if provided) with the config
  const config = mergeConfig(defaultConfig, userConfig);

  return config;
}
