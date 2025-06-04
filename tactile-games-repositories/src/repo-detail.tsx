import { Detail, getPreferenceValues, showToast, Toast, open, Icon, ActionPanel, Action } from "@raycast/api";
import { useEffect, useState } from "react";
import { Octokit } from "@octokit/rest";
import { Buffer } from "buffer";

interface Preferences {
  githubToken: string;
}

interface Repository {
  id: number;
  name: string;
  description: string;
  topics: string[];
  owner: { login: string };
  html_url: string;
}

interface LatestRelease {
  name: string;
  tag_name: string;
  published_at: string;
  body: string;
  html_url: string; // Add the URL of the latest release
}

interface PullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  user: { login: string };
  statuses_url: string;
}

const preferences = getPreferenceValues<Preferences>();
const octokit = new Octokit({ auth: preferences.githubToken });

export default function RepoDetail({ repo }: { repo: Repository }) {
  const [latestRelease, setLatestRelease] = useState<LatestRelease | null>(null);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [ciStatuses, setCiStatuses] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLatestRelease() {
      try {
        const response = await octokit.repos.getLatestRelease({
          owner: repo.owner.login,
          repo: repo.name,
        });
        setLatestRelease(response.data);
      } catch (error: any) {
        if (error.status !== 404) {
          console.error("Error fetching latest release:", error);
          showToast({
            style: Toast.Style.Failure,
            title: "Failed to fetch latest release",
            message: error.message,
          });
        }
      }
    }

    async function fetchReadme() {
      try {
        const response = await octokit.repos.getReadme({
          owner: repo.owner.login,
          repo: repo.name,
        });
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        setReadmeContent(content);
      } catch (error: any) {
        console.error("Error fetching README:", error);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch README",
          message: error.message,
        });
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchPullRequests() {
      try {
        const response = await octokit.pulls.list({
          owner: repo.owner.login,
          repo: repo.name,
          state: "open",
        });
        setPullRequests(response.data);
        fetchCiStatuses(response.data);
      } catch (error: any) {
        console.error("Error fetching pull requests:", error);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch pull requests",
          message: error.message,
        });
      }
    }

    async function fetchCiStatuses(prs: PullRequest[]) {
      const statuses: Record<number, string> = {};
      for (const pr of prs) {
        try {
          const statusResponse = await octokit.checks.listForRef({
            owner: repo.owner.login,
            repo: repo.name,
            ref: `pull/${pr.number}/head`,
          });

          const checkRuns = statusResponse.data.check_runs;
          let overallStatus = "success";
          for (const checkRun of checkRuns) {
            if (checkRun.conclusion === "failure") {
              overallStatus = "failure";
              break;
            } else if (checkRun.conclusion !== "success") {
              overallStatus = "unknown";
            }
          }

          statuses[pr.id] = overallStatus;
        } catch (error: any) {
          console.error(`Error fetching CI status for PR #${pr.number}:`, error);
          statuses[pr.id] = "unknown";
        }
      }
      setCiStatuses(statuses);
    }

    fetchLatestRelease();
    fetchReadme();
    fetchPullRequests();
  }, [repo]);

  return (
    <Detail
      isLoading={isLoading}
      markdown={readmeContent || "No README available."}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Link title="GitHub" target={repo.html_url} text="View on GitHub" />
          {latestRelease ? (
            <>
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label title="Latest Release" text={latestRelease.name} />
              <Detail.Metadata.Label title="Published At" text={new Date(latestRelease.published_at).toLocaleDateString()} />
              <Detail.Metadata.Label title="Release Notes" text={latestRelease.body || "No release notes."} />
            </>
          ) : (
            <Detail.Metadata.Label title="Latest Release" text="No release available." />
          )}
          {repo.topics.length > 0 && (
            <>
              <Detail.Metadata.Separator />
              <Detail.Metadata.TagList title="Topics">
                {repo.topics.map((topic) => (
                  <Detail.Metadata.TagList.Item key={topic} text={topic} />
                ))}
              </Detail.Metadata.TagList>
            </>
          )}

          {
            repo.description && (
              <>
                <Detail.Metadata.Separator />
                <Detail.Metadata.Label title="Description" text={repo.description} />
              </>
            )
          }

          {pullRequests.length > 0 && (
            <>
              <Detail.Metadata.Separator />
              <Detail.Metadata.TagList title="Open PRs">
                {pullRequests.map((pr) => {
                  const ciStatus = ciStatuses[pr.id] ?? "unknown";
                  return (
                    <Detail.Metadata.TagList.Item
                      key={pr.id}
                      icon={ciStatus === "success" ? Icon.CheckCircle : ciStatus === "failure" ? Icon.XMarkCircleFilled : Icon.Download}
                      color={ciStatus === "success" ? "green" : ciStatus === "failure" ? "red" : "grey"}
                      text={`${pr.title}`}
                      onAction={() => open(pr.html_url)}
                    />
                  );
                })}
              </Detail.Metadata.TagList>
            </>
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.OpenInBrowser
            title="Open GitHub Repo"
            url={repo.html_url}
            shortcut={{ modifiers: ["cmd"], key: "enter" }}
          />
        </ActionPanel>
      }
    />
  );
}