export type ProjectType = "git" | "svn";

export class Project {
  constructor(
    public name: string,
    public path: string,
    public type: ProjectType,
    public branch: string
  ) {}
}
