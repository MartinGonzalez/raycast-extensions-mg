import { Project } from "./project";

export interface Projects {
  findProjects(rootPath: string): Promise<Project[]>;
}
