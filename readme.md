# OpenAI File Sync Tool

This package offers a command-line interface (CLI) for synchronizing files with OpenAI's vector store. It continuously monitors a specified directory for changes and syncs relevant files with OpenAI.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Features

- Monitors directory for file changes (additions, modifications, deletions)
- Automatically syncs changes with OpenAI's API
- CLI for contextual question answering and code generation from the target directory
- Logging for synchronization processes

## Prerequisites

Make sure you have the following installed on your system:

- Node.js (version 14 or newer)
- npm (Node package manager)
- An OpenAI API key

## Installation

Follow the steps below to clone the repository and install the CLI tool:

1. **Clone the Repository**:
   `git clone`

2. **Navigate to the Project Directory**:
   `cd code_assistant`

3. **Install the Dependencies**:
   Run the following command to install necessary packages:
   `npm install`

4. **Build the repo**:
   Run the following command to install necessary packages:
   `npm run build`

5. **Set Up Your OpenAI API Environment Variables (.env)**:
   OPENAI_API_KEY
   OPENAI_ORG_ID
   OPENAI_PROJECT_ID

6. **Set Up Your Config file (assistant-config.json)**:
   {
   "fileSync": {
   "sourceDir": "./src",
   "globPattern": "\*_/_.ts"
   }
   }

7. **Install the CLI Tool Globally** (Optional):
   If you wish to use the CLI globally, install it by running:
   `npm link && chmod +x ./build/bin/cli.js`

## Usage

`para`
