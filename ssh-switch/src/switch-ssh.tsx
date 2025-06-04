import { showToast, Toast, showHUD, List, ActionPanel, Action, popToRoot } from "@raycast/api";
import { execSync } from "child_process";
import { existsSync, copyFileSync, chmodSync } from "fs";
import { useState } from "react";

const profiles = ["work", "personal"] as const;
type Profile = typeof profiles[number];

const profileGitInfo: Record<Profile, { name: string; email: string }> = {
  work: {
    name: "Martin Gonzalez",
    email: "marting@tactile.dk",
  },
  personal: {
    name: "Martin Gonzalez",
    email: "gonzalez.martin90@gmail.com",
  },
};

import { readFileSync } from "fs";

function getCurrentProfile(): Profile | null {
  try {
    const sshList = execSync('ssh-add -l').toString();
    console.log('[ssh-add -l output]', sshList);
    for (const line of sshList.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;
      const comment = parts.slice(2).join(' ').trim().toLowerCase();
      console.log('[SSH key comment]', comment);
      if (comment === profileGitInfo.work.email.toLowerCase()) return "work";
      if (comment === profileGitInfo.personal.email.toLowerCase()) return "personal";
    }
    return null;
  } catch (err) {
    console.log('[getCurrentProfile error]', err);
    // Fallback: compare config files
    try {
      const home = process.env.HOME;
      const config = readFileSync(`${home}/.ssh/config`, "utf8");
      const configWork = readFileSync(`${home}/.ssh/config_work`, "utf8");
      const configPersonal = readFileSync(`${home}/.ssh/config_personal`, "utf8");
      if (config === configWork) return "work";
      if (config === configPersonal) return "personal";
    } catch (e) {
      console.log('[getCurrentProfile fallback error]', e);
    }
    return null;
  }
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(getCurrentProfile());
  console.log('[Command render] currentProfile:', currentProfile, 'profiles:', profiles);


  // Refresh currentProfile after switching
  function refreshCurrentProfile() {
    setCurrentProfile(getCurrentProfile());
  }

  function setGitConfig(profile: Profile) {
    try {
      execSync(`git config --global user.name "${profileGitInfo[profile].name}"`);
      execSync(`git config --global user.email "${profileGitInfo[profile].email}"`);
    } catch (err) {
      throw new Error(`Failed to set Git user info: ${String(err)}`);
    }
  }

  function switchProfile(profile: Profile) {
    // Switch SSH config and keys only
    const sshConfigFile = `${process.env.HOME}/.ssh/config_${profile}`;
    const sshKeyFile = `${process.env.HOME}/.ssh/github_${profile}`;
    const sshConfigTarget = `${process.env.HOME}/.ssh/config`;

    if (!existsSync(sshConfigFile)) {
      throw new Error(`Config file for '${profile}' not found: ${sshConfigFile}`);
    }
    if (!existsSync(sshKeyFile)) {
      throw new Error(`SSH key for '${profile}' not found: ${sshKeyFile}`);
    }

    try {
      copyFileSync(sshConfigFile, sshConfigTarget);
      chmodSync(sshConfigTarget, 0o600);
    } catch (err) {
      throw new Error(`Failed to copy SSH config: ${String(err)}`);
    }

    // No need to remove or add SSH keys. Rely on SSH config's IdentityFile for correct key usage.
  }

  async function handleSwitchProfile(profile: Profile) {
    setCurrentProfile(profile);
    setIsLoading(true);
    await showToast({
      style: Toast.Style.Animated,
      title: `Switching to profile [${profile}]`,
    });
    try {
      switchProfile(profile);
      setGitConfig(profile);
    } catch (err: any) {
      await showToast({
        style: Toast.Style.Failure,
        title: err.message || "Failed to switch profile",
      });
      setIsLoading(false);
      return;
    }

    // Test SSH connection
    let sshTestResult = "";
    try {
      sshTestResult = execSync("ssh -T git@github.com", { encoding: "utf8" });
    } catch (err: any) {
      sshTestResult = err.stdout || "";
    }

    await showHUD(`Switched to [${profile}] profile.\n${sshTestResult.trim()}`);
    setIsLoading(false);
    refreshCurrentProfile();
    popToRoot();
  }

  async function handleShowCurrentProfile() {

    const currentProfile = getCurrentProfile();

    if (!currentProfile) {
      await showToast({
        style: Toast.Style.Animated,
        title: "No SSH profile active"
      });
      return;
    }

    await showToast({
      style: Toast.Style.Animated,
      title: `Current SSH Profile: ${currentProfile}`,
      message: currentProfile,
    });
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Switch SSH Profile">
      {profiles.map((profile) => (
        <List.Item
          key={profile}
          title={profile.charAt(0).toUpperCase() + profile.slice(1)}
          subtitle={profileGitInfo[profile].email}
          icon={{ source: profile === "work" ? "briefcase.png" : "person.png", tintColor: profile === "work" ? "#0070f3" : "#e67e22" }}
          accessories={
            currentProfile === profile
              ? [
                  {
                    tag: {
                      value: "Active",
                      color: "green",
                    },
                  },
                ]
              : []
          }
          actions={
            <ActionPanel>
              <Action
                title={`Switch to ${profile.charAt(0).toUpperCase() + profile.slice(1)} Profile`}
                onAction={() => handleSwitchProfile(profile)}
              />
              <Action
                title="Show Current Profile"
                onAction={handleShowCurrentProfile}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

