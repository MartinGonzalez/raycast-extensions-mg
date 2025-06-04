import { Project } from "../models/project";
import { Projects } from "../models/projects";

export class ListProjects {
  constructor(private repo: Projects) {}

  async execute(rootPath: string): Promise<Project[]> {
    return this.repo.findProjects(rootPath);
  }
}
