import { Action, ActionPanel, List } from "@raycast/api";
import { useState } from "react";
import { openManifestFile } from "./open-manifest-json-in";

interface SearchProjectsProps {
  launchContext?: {
    projects: string[];
  };
}

export default function SearchProjects(props: SearchProjectsProps) {
  const { launchContext } = props;
  const projects = launchContext?.projects || [];
  const [searchText, setSearchText] = useState("");
  
  // Filter projects based on search text
  const filteredProjects = projects.filter((project) => 
    project.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <List
      isLoading={projects.length === 0}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Unity projects..."
      throttle
    >
      {filteredProjects.map((project) => (
        <List.Item
          key={project}
          title={project}
          actions={
            <ActionPanel>
              <Action
                title="Open manifest.json"
                onAction={() => openManifestFile(project)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
