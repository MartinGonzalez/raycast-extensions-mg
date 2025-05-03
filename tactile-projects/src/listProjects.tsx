import { List, ActionPanel, Action, getPreferenceValues, open, showHUD, Clipboard, Color, closeMainWindow, showInFinder } from '@raycast/api';
import { showFailureToast } from '@raycast/utils';
import { useState, useEffect } from 'react';
import { CommandFactory } from './infrastructure/factories/commandFactory';
import { Project } from './core/models/project';
import path from 'path';

function getAppPath(appToOpen: any): string {
  // Handles both string and object forms from Raycast App Picker
  if (typeof appToOpen === 'string') return appToOpen;
  if (typeof appToOpen === 'object' && appToOpen?.path) return appToOpen.path;
  return '';
}

function getAppName(appToOpen: any): string {
  const appPath = getAppPath(appToOpen);
  return path.basename(appPath, path.extname(appPath));
}

export default function Command() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const preferences = getPreferenceValues<{ projectsPath: string; textEditorApp: string; terminalApp: string }>();

  useEffect(() => {
    async function fetchProjects() {
      try {
        if (!preferences.projectsPath) {
          setIsLoading(false);
          return;
        }
        const listProjects = CommandFactory.createListProjects();
        const foundProjects = await listProjects.execute(preferences.projectsPath);
        setProjects(foundProjects);
      } catch (error) {
        console.error('Error loading projects:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProjects();
  }, [preferences.projectsPath]);

  return (
    <List isLoading={isLoading}>
      {projects.map((project) => (
        <List.Item
          key={project.path}
          title={project.name}
          subtitle={project.path}
          accessories={[
            {
              tag: { value: project.branch, color: Color.Orange },
            },
          ]}
          actions={
            <ActionPanel>
              <Action
                title="Open in Finder"
                onAction={async() => await showInFinder(project.path)}
              />
              <Action
                title="Copy Path"
                onAction={() => copyPath(project.path)}
              />
              <Action
                title={`Open with ${getAppName(preferences.textEditorApp)}`}
                icon={{ fileIcon: getAppPath(preferences.textEditorApp) }}
                onAction={() => openWithApp(getAppPath(preferences.textEditorApp), project.path)}
              />
              <Action
                title={`Open with ${getAppName(preferences.terminalApp)}`}
                icon={{ fileIcon: getAppPath(preferences.terminalApp) }}
                onAction={() => openWithApp(getAppPath(preferences.terminalApp), project.path)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

async function copyPath(filePath: string) {
  await Clipboard.copy(filePath);
  await showHUD("Path copied to clipboard");
}

async function openWithApp(appPath: string, projectPath: string) {
  const { exec } = await import("child_process");
  const isAppBundle = appPath.endsWith(".app");
  const command = isAppBundle
    ? `open -a "${appPath}" "${projectPath}"`
    : `${appPath} "${projectPath}"`;
  exec(command, (error) => {
    if (error) {
      showFailureToast("Failed to open project");
    } else {
      closeMainWindow();
    }
  });
}
