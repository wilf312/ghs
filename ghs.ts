#!/usr/bin/env -S deno run --allow-run --allow-read

import { Select, Input } from "cliffy/prompt/mod.ts";
import { getRelativeTimeString, パッケージ名からGitHubのOrgrepoを取得する, GitHubのIssueを検索する } from "./utils.ts";
import type { Issue } from "./types.ts";

// issueをバージョンでグループ化する関数
function groupIssuesByVersion(issues: Issue[]): { version: string; type: string; issues: Issue[] }[] {
  const groups: { version: string; type: string; issues: Issue[] }[] = [];
  let currentGroup: Issue[] = [];
  let currentVersion: string | undefined;
  let currentType: string | undefined;

  for (const issue of issues) {
    if (issue.version?.name !== currentVersion || issue.version?.type !== currentType) {
      if (currentGroup.length > 0) {
        groups.push({
          version: currentVersion ?? "未リリース",
          type: currentType ?? "",
          issues: currentGroup
        });
      }
      currentGroup = [];
      currentVersion = issue.version?.name;
      currentType = issue.version?.type;
    }
    currentGroup.push(issue);
  }

  if (currentGroup.length > 0) {
    groups.push({
      version: currentVersion ?? "未リリース",
      type: currentType ?? "",
      issues: currentGroup
    });
  }

  return groups;
}

async function searchPackageIssues(packageName: string, searchTerm: string) {
  try {
    const orgSlashRepo = await パッケージ名からGitHubのOrgrepoを取得する(packageName);
    console.log(`検索中 issues in ${orgSlashRepo}...\n`);
    
    const sortedIssues = await GitHubのIssueを検索する(orgSlashRepo, searchTerm);
    const groupedIssues = groupIssuesByVersion(sortedIssues);

    // 選択肢のリストを作成
    const options = groupedIssues.flatMap(group => [
      {
        name: `${group.version}${group.type ? ` (${group.type})` : ''} ${group.issues[0]?.version?.publishedAt ? `- ${getRelativeTimeString(group.issues[0].version.publishedAt)}` : ''}`,
        value: "",
        disabled: true
      },
      ...group.issues.map(issue => ({
        name: `  ${issue.title} (${getRelativeTimeString(issue.createdAt)})`,
        value: issue.url
      }))
    ]);

    const selectedIssue = await Select.prompt<string>({
      message: '開きたいissueを選択してください:',
      options,
      maxRows: 30,
    });

    // 選択されたissueをブラウザで開く
    if (selectedIssue && selectedIssue !== "") {
      await new Deno.Command("open", {
        args: [selectedIssue],
      }).output();
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error searching issues for ${packageName}:`, error.message);
    } else {
      console.error(`Error searching issues for ${packageName}:`, String(error));
    }
  }
}

async function getDependencies() {
  const packageJson = JSON.parse(await Deno.readTextFile("./package.json"));
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
}

async function main() {
  try {
    const dependencies = await getDependencies();
    const packageNames = Object.keys(dependencies);

    const selectedPackage = await Select.prompt({
      message: '検索するパッケージを選択してください:',
      options: packageNames.map(name => ({
        name,
        value: name
      })),
      search: true,
      maxRows: 30,
    });

    const issueSearchTerm = await Input.prompt({
      message: 'Issueの検索キーワードを入力してください:',
      validate: (value: string) => value.length > 0 || '検索キーワードを入力してください'
    });

    if (typeof selectedPackage === 'string' && typeof issueSearchTerm === 'string') {
      await searchPackageIssues(selectedPackage, issueSearchTerm);
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error('エラーが発生しました:', error.message);
    } else {
      console.error('エラーが発生しました:', String(error));
    }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
