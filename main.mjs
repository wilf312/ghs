#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { select, input } from '@inquirer/prompts';
import { readFileSync } from 'node:fs';

// 相対的な日付を計算する関数
function getRelativeTimeString(date) {
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

async function searchPackageIssues(packageName, searchTerm) {
  try {
    const repoInfo = execSync(`npm view ${packageName} repository.url`, { encoding: 'utf8' });
    console.log(repoInfo);

    const orgSlashRepo = repoInfo
      .trim()
      .replace('git+', '')
      .replace('git://', '')
      .replace('https://', '')
      .replace('github.com/', '')
      .replace('.git', '');

    const searchCommand = `gh issue list -R ${orgSlashRepo} --search "${searchTerm}" --json number,title,createdAt,url`;
    console.log(`検索中 issues in ${orgSlashRepo}...\n`);

    const result = execSync(searchCommand, { encoding: 'utf8' });
    const issues = JSON.parse(result);

    // 番号で降順ソート
    const sortedIssues = issues.sort((a, b) => b.number - a.number);

    // 選択肢のリストを作成（相対日付を使用）
    const selectedIssue = await select({
      message: '開きたいissueを選択してください:',
      choices: sortedIssues.map(issue => ({
        name: `${issue.title} (${getRelativeTimeString(issue.createdAt)})`,
        value: issue.url
      })),
      pageSize: 50
    });

    // 選択されたissueをブラウザで開く
    execSync(`open ${selectedIssue}`);

  } catch (error) {
    console.error(`Error searching issues for ${packageName}:`, error.message);
  }
}

async function getDependencies() {
  const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
}

async function main() {
  try {
    const dependencies = await getDependencies();
    const packageNames = Object.keys(dependencies);

    const selectedPackage = await select({
      message: '検索するパッケージを選択してください:',
      choices: packageNames.map((name) => ({
        name: name,
        value: name,
      })),
      pageSize: 10,
      loop: true,
      filter: (input) => {
        return packageNames.filter((name) => name.toLowerCase().includes(input.toLowerCase()));
      },
    });

    const issueSearchTerm = await input({
      message: 'Issueの検索キーワードを入力してください:',
      validate: (value) => value.length > 0 || '検索キーワードを入力してください',
    });

    await searchPackageIssues(selectedPackage, issueSearchTerm);
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();
