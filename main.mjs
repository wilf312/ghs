#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { select, input } from '@inquirer/prompts';
import { readFileSync } from 'node:fs';

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

    const searchCommand = `gh issue list -R ${orgSlashRepo} --search "${searchTerm}"`;
    console.log(`検索中 issues in ${orgSlashRepo}...\n`);

    const result = execSync(searchCommand, { encoding: 'utf8' });

    if (typeof result === 'string' && result.length === 0) {
      console.log('検索結果 0件');
      return;
    }
    console.log(result);
  } catch (error) {
    console.error(`Error searching issues for ${packageName}:`, error.message);
  }
}

async function getDependencies() {
  const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
}

async function main() {
  try {
    const dependencies = await getDependencies();
    const packageNames = Object.keys(dependencies);

    const selectedPackage = await select({
      message: '検索するパッケージを選択してください:',
      choices: packageNames.map(name => ({
        name: name,
        value: name
      })),
      pageSize: 10,
      loop: true,
      filter: (input) => {
        return packageNames.filter(name => 
          name.toLowerCase().includes(input.toLowerCase())
        );
      }
    });

    const issueSearchTerm = await input({
      message: 'Issueの検索キーワードを入力してください:',
      validate: (value) => value.length > 0 || '検索キーワードを入力してください'
    });

    await searchPackageIssues(selectedPackage, issueSearchTerm);

  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();