import { runAssistantCLI } from "./lib/main.js";

// You can pass the path to the config file as an argument, or default it.
const configFilePath: string = process.argv[2] || "./assistant-config.json";

// Main function to start the CLI
function main() {
  runAssistantCLI(configFilePath);
}

main();
