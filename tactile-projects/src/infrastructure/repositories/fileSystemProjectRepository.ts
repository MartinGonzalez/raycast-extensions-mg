import { Project } from "../../core/models/project";
import { Projects } from "../../core/models/projects";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export class FileSystemProjectRepository implements Projects {
  async findProjects(rootPath: string): Promise<Project[]> {
    const projects: Project[] = [];
    try {
      const entries = fs.readdirSync(rootPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const folderPath = path.join(rootPath, entry.name);
          const gitPath = path.join(folderPath, ".git");
          const svnPath = path.join(folderPath, ".svn");
          
          if (fs.existsSync(gitPath)) {
            const branch = getGitBranch(folderPath);
            projects.push(new Project(entry.name, folderPath, "git", branch));
            
          } else if (fs.existsSync(svnPath)) {
            const branch = getSvnBranch(folderPath);
            projects.push(new Project(entry.name, folderPath, "svn", branch));
            
          } else {
            
            const nestedProjects = await this.findProjects(folderPath);
            projects.push(...nestedProjects);
          }
        }
      }
    } catch (error) {
      console.error("Error finding projects:", error);
    }
    return projects;
  }
}

function getGitBranch(projectPath: string): string {
  try {
    const output = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: projectPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return output.trim();
  } catch {
    return "unknown";
  }
}

function getSvnBranch(projectPath: string): string {
  try {
    const output = execSync("svn info --show-item url", {
      cwd: projectPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const url = output.trim();
    const branchMatch = url.match(/\/(?:branches|tags)\/([^/]+)/);
    if (branchMatch && branchMatch[1]) {
      return branchMatch[1];
    } else if (url.includes("/trunk/") || url.endsWith("/trunk")) {
      return "trunk";
    } else {
      return "unknown";
    }
  } catch {
    return "unknown";
  }
}
