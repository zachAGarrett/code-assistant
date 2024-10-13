import chalk from "chalk";
import defaultConfig, {
  Config,
  PartialConfig,
} from "./default.js";
import { readFileSync } from "fs";
import merge from "lodash.merge";


export default function getParaConfig(userConfigFilePath: string): Config {
  try {
    const configData = readFileSync(userConfigFilePath, "utf-8");
    const userConfig = JSON.parse(configData) as PartialConfig;

    if (userConfig.fileSync.sourceDir === undefined) {
      throw new Error("fileSync.sourceDir must be defined in para-config.json");
    }

    const mergedConfig: Config = merge(
      {}, // Start with an empty object to avoid mutating defaultConfig
      defaultConfig, // Base defaults
      userConfig // User overrides
    );

    return mergedConfig;
  } catch (error) {
    console.error(chalk.red("\nError loading config file:", "\n" + error));
    process.exit(1);
  }
}
