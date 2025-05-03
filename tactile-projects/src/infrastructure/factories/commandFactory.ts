import { FileSystemProjectRepository } from "../repositories/fileSystemProjectRepository";
import { ListProjects } from "../../core/commands/listProjects";

export class CommandFactory {
  static createListProjects(): ListProjects {
    const repo = new FileSystemProjectRepository();
    return new ListProjects(repo);
  }
}
