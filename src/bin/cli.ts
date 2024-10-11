#!/usr/bin/env node

import { runAssistantCLI } from "../lib/main.js";

// You can pass the path to the config file as an argument, or default it.
const configFilePath: string = process.argv[2] || "./assistant-config.json";

// Start the assistant CLI
runAssistantCLI(configFilePath);
