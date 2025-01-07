#!/usr/bin/env -S deno run --allow-run --allow-read

import { Select, Input } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/mod.ts";

// 相対的な日付を計算する関数
function getRelativeTimeString(date: string) {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}年前`;
  if (months > 0) return `${months}ヶ月前`;
  if (days > 0) return `${days}日前`;
  if (hours > 0) return `${hours}時間前`;
  if (minutes > 0) return `${minutes}分前`;
  return `${seconds}秒前`;
}

async function searchPackageIssues(packageName: string, searchTerm: string) {
  try {
    const repoInfo = new TextDecoder().decode(
      await Deno.run({
        cmd: ["npm", "view", packageName, "repository.url"],
        stdout: "piped"
      }).output()
    );

    const orgSlashRepo = repoInfo
      .trim()
      .replace('git+', '')
      .replace('git://', '')
      .replace('https://', '')
      .replace('github.com/', '')
      .replace('.git', '');

    const searchCommand = new Deno.Command("gh", {
      args: ["issue", "list", "-R", orgSlashRepo, "--search", searchTerm, "--json", "number,title,createdAt,url"]
    });
    
    console.log(`検索中 issues in ${orgSlashRepo}...\n`);

    const { stdout } = await searchCommand.output();
    const issues = JSON.parse(new TextDecoder().decode(stdout));

    // 番号で降順ソート
    const sortedIssues = issues.sort((a: any, b: any) => b.number - a.number);

    // 選択肢のリストを作成（相対日付を使用）
    const selectedIssue = await Select.prompt({
      message: '開きたいissueを選択してください:',
      options: sortedIssues.map((issue: any) => ({
        name: `${issue.title} (${getRelativeTimeString(issue.createdAt)})`,
        value: issue.url
      })),
    });

    // 選択されたissueをブラウザで開く
    await new Deno.Command("gh", {
      args: ["browse", selectedIssue],
    }).output();

  } catch (error) {
    console.error(`Error searching issues for ${packageName}:`, error.message);
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
      search: true
    });

    const issueSearchTerm = await Input.prompt({
      message: 'Issueの検索キーワードを入力してください:',
      validate: (value) => value.length > 0 || '検索キーワードを入力してください'
    });

    await searchPackageIssues(selectedPackage, issueSearchTerm);

  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}