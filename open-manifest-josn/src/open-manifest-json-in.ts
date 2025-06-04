import { showToast, Toast, getPreferenceValues, open, showHUD, LaunchType, launchCommand } from "@raycast/api";
import { execSync } from "child_process";
import { homedir } from "os";
import { join } from "path";
import fs from "fs";

interface Preferences {
  editor: string;
  customEditorPath?: string;
}

export default async function Command() {
  try {
    const projects = getProjects();
    
    if (projects.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No projects found",
        message: "No Unity projects found in ~/Workspace/Tactile/Projects",
      });
      return;
    }

    // Launch the search command to filter and select a project
    await launchCommand({
      name: "search-projects",
      type: LaunchType.UserInitiated,
      context: { projects },
    });
  } catch (error) {
    console.error("Error:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Error",
      message: String(error),
    });
  }
}

function getProjects(): string[] {
  try {
    const projectsPath = join(homedir(), "Workspace/Tactile/Projects");
    
    // Check if directory exists
    if (!fs.existsSync(projectsPath)) {
      throw new Error(`Projects directory not found: ${projectsPath}`);
    }
    
    // Get list of directories in the projects folder
    const output = execSync(`ls -la "${projectsPath}" | grep '^d' | awk '{print $NF}' | grep -v '\\.'`).toString();
    const projects = output.split('\n').filter(Boolean);
    
    // Filter to only include directories that have the Unity/Packages/manifest.json structure
    return projects.filter((project: string) => {
      const manifestPath = join(projectsPath, project, "Unity/Packages/manifest.json");
      return fs.existsSync(manifestPath);
    });
  } catch (error) {
    console.error("Error getting projects:", error);
    return [];
  }
}

export function openManifestFile(projectName: string) {
  try {
    const projectsPath = join(homedir(), "Workspace/Tactile/Projects");
    const manifestPath = join(projectsPath, projectName, "Unity/Packages/manifest.json");
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest file not found: ${manifestPath}`);
    }
    
    const { editor, customEditorPath } = getPreferenceValues<Preferences>();
    
    let editorPath = "";
    if (editor === "custom" && customEditorPath) {
      editorPath = customEditorPath;
    } else if (editor === "windsurf") {
      editorPath = "/Applications/Windsurf.app";
    } else {
      // Default to VS Code if not specified
      editorPath = "/Applications/Visual Studio Code.app";
    }
    
    open(manifestPath, editorPath);
    showHUD(`Opening manifest.json for ${projectName}`);
  } catch (error) {
    console.error("Error opening manifest file:", error);
    showToast({
      style: Toast.Style.Failure,
      title: "Error opening manifest file",
      message: String(error),
    });
  }
}