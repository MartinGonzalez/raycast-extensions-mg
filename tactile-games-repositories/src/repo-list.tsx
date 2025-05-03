import { ActionPanel, Action, List, getPreferenceValues, showToast, Toast, useNavigation, Cache } from "@raycast/api";
import { useEffect, useState } from "react";
import { Octokit } from "@octokit/rest";
import RepoDetail from "./repo-detail";

interface Preferences {
  githubToken: string;
  organizationName: string;
}

interface Repository {
  id: number;
  name: string;
  description: string;
  topics: string[];
  owner: { login: string };
  html_url: string;
}

const preferences: Preferences = getPreferenceValues();
const octokit = new Octokit({ auth: preferences.githubToken });

const cache = new Cache();
const CACHE_KEY = "tactile.repos";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export default function RepoList() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  async function fetchRepos(useCache = true) {
    const cachedData = cache.get(CACHE_KEY);
    const now = Date.now();

    if (cachedData && useCache) {
      const { timestamp, repos } = JSON.parse(cachedData);
      if (now - timestamp < CACHE_TTL) {
        setRepos(repos);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);

    try {
      let page = 1;
      const allRepos: Repository[] = [];
      while (true) {
        const response = await octokit.repos.listForOrg({
          org: preferences.organizationName,
          type: "all",
          per_page: 100,
          page: page,
        });
        allRepos.push(...response.data);
        if (response.data.length < 100) break; // If fewer than 100 repos, we've fetched all
        page++;
      }
      cache.set(CACHE_KEY, JSON.stringify({ timestamp: now, repos: allRepos }));
      setRepos(allRepos);
    } catch (error: any) {
      console.error("Error fetching repositories:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to fetch repositories",
        message: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRepos();
  }, []);

  const filteredRepos = selectedTopic
    ? repos.filter((repo) => repo.topics.includes(selectedTopic))
    : repos;

  const topics = Array.from(new Set(repos.flatMap((repo) => repo.topics)));

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search repositories..."
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by Topic"
          storeValue
          onChange={setSelectedTopic}>
          <List.Dropdown.Item title="All Topics" value="" />
          {topics.map((topic) => (<List.Dropdown.Item key={topic} title={topic} value={topic} />))}
        </List.Dropdown>
      }>
      {isLoading ? (
        <List.Item title="Fetching Repositories..." />
      ) : (
        filteredRepos.length > 0 ? (
          filteredRepos.map((repo) => (
            <RepoListItem key={repo.id} repo={repo} refresh={() => fetchRepos(false)} />
          ))
        ) : (
          <List.EmptyView title="No repositories found" />
        )
      )}
    </List>
  );
}

function RepoListItem({ repo, refresh }: { repo: Repository, refresh: () => void }) {
  const { push } = useNavigation();

  const handlePress = () => {
    push(<RepoDetail repo={repo} />);
  };

  const accessories = repo.topics.map((topic) => ({ text: topic }));
  let icon: object | undefined;
  if (repo.topics.includes("build-plugins")) {
    icon = { source: "../assets/branch_icon.png" };
  }

  return (
    <List.Item
      title={repo.name}
      subtitle={repo.description}
      icon={icon}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action title="View Details" onAction={handlePress} />
          <Action title="Refresh" onAction={() => refresh()} />
        </ActionPanel>
      }
    />
  );
}