#!/usr/bin/env -S deno run --allow-run --allow-read

import { Select, Input } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/mod.ts";
import { getRelativeTimeString } from "./utils.ts";

interface Issue {
  number: number;
  title: string;
  createdAt: string;
  url: string;
}

async function searchPackageIssues(packageName: string, searchTerm: string) {
  try {
    const npmCommand = new Deno.Command("npm", {
      args: ["view", packageName, "repository.url"],
    });
    const { stdout: npmStdout } = await npmCommand.output();
    const repoInfo = new TextDecoder().decode(npmStdout);

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
    const issues = JSON.parse(new TextDecoder().decode(stdout)) as Issue[];

    // 番号で降順ソート
    const sortedIssues = issues.sort((a, b) => b.number - a.number);

    // 選択肢のリストを作成（相対日付を使用）
    const selectedIssue = await Select.prompt({
      message: '開きたいissueを選択してください:',
      options: sortedIssues.map((issue) => ({
        name: `${issue.title} (${getRelativeTimeString(issue.createdAt)})`,
        value: issue.url
      })),
      maxRows: 30,
    });

    // 選択されたissueをブラウザで開く
    if (typeof selectedIssue === 'string') {
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
      validate: (value) => value.length > 0 || '検索キーワードを入力してください'
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
