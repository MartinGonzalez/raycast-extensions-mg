# Tactile Projects Raycast Extension

A Raycast extension for instantly discovering and opening your Tactile projects—including those nested in subfolders—using a clean, maintainable architecture.

## Features
- **Recursive Project Discovery:** Finds all projects (with `.git` or `.svn` folders) under your root path, including those in nested folders like `BuildPlugins`.
- **Open with Windsurf:** Quickly open any project with the Windsurf CLI or app.
- **Copy Path & Open in Finder:** Handy actions for your daily workflow.
- **Clean Architecture:** Built with Interaction Driven Design (IDD) and Windsurf architecture principles.

## Installation
1. Clone or download this repository.
2. Open Raycast Preferences → Extensions → Development, and add this folder as a script command extension.
3. Install dependencies:
   ```sh
   npm install
   ```
4. Start in development mode:
   ```sh
   npm run dev
   ```

## Configuration
- Set your `projectsPath` in Raycast preferences for the extension. This should be the root folder containing all your projects and subfolders (e.g., `~/Workspace/Projects`).

## Usage
- Open Raycast and run the "List Projects" command.
- All projects with `.git` or `.svn` folders will be listed, regardless of nesting depth:

  ```
  root/
  ├── Project1/.git
  ├── Project2/.svn
  ├── BuildPlugins/
  │   ├── Project3/.git
  │   └── Project4/.svn
  └── Project5/.git
  ```
- Use the action panel to:
  - Open in Finder
  - Copy Path
  - Open with Windsurf (with custom icon)

## Developer Notes
- The extension uses a recursive search in `FileSystemProjectRepository` to find projects at any depth.
- Architecture follows IDD/Windsurf rules: commands, models, interfaces, infrastructure, and delivery layers are all separated and injected via factories.

## Example Code
```typescript
const listProjects = CommandFactory.createListProjects();
const projects = await listProjects.execute(projectsPath);
```

---

For questions or contributions, please open an issue or pull request!