# Open manifest.json Raycast Extension

This extension allows you to quickly open Unity project manifest.json files in your preferred editor. It's designed for projects located in `~/Workspace/Tactile/Projects` with the structure `Root/Unity/Packages/manifest.json`.

## Features

- Lists all Unity projects from your Tactile Projects directory
- Allows searching/filtering projects by name
- Opens the selected project's manifest.json file in your preferred editor
- Configurable editor choice (Windsurf, VS Code, or custom editor)

## Usage

1. Run the "Open manifest.json in" command in Raycast
2. The extension will list all valid Unity projects
3. Search for a specific project if needed
4. Select a project to open its manifest.json file

## Configuration

In the extension preferences, you can configure:

- **Editor**: Choose between Windsurf, VS Code, or a custom editor
- **Custom Editor Path**: If you selected "Custom", provide the full path to your preferred editor

## Installation

1. Make sure you have [Raycast](https://raycast.com/) installed
2. Install the Raycast CLI: `npm install -g @raycast/cli`
3. Clone this repository
4. Run `npm install` in the project directory
5. Run `npm run dev` to start developing or `npm run build` to build the extension

## Requirements

- macOS
- Raycast
- Node.js and npm