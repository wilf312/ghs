import type { Issue, Release } from "./types.ts";

// リリース情報を取得する関数
async function getReleases(orgSlashRepo: string): Promise<Release[]> {
  try {
    const releaseCommand = new Deno.Command("gh", {
      args: ["release", "list", "-R", orgSlashRepo, "--json", "tagName,publishedAt"]
    });
    
    const { stdout } = await releaseCommand.output();
    return JSON.parse(new TextDecoder().decode(stdout));
  } catch {
    return [];
  }
}

// 相対的な日付を計算する関数
export function getRelativeTimeString(date: string) {
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

// パッケージ名からGitHubのorg/repoを取得する関数
export async function パッケージ名からGitHubのOrgrepoを取得する(packageName: string): Promise<string> {
  const npmCommand = new Deno.Command("npm", {
    args: ["view", packageName, "repository.url"],
  });
  const { stdout: npmStdout } = await npmCommand.output();
  const repoInfo = new TextDecoder().decode(npmStdout);

  return repoInfo
    .trim()
    .replace('git+', '')
    .replace('git://', '')
    .replace('https://', '')
    .replace('github.com/', '')
    .replace('.git', '');
}

// GitHubのissueを検索する関数
export async function GitHubのIssueを検索する(orgSlashRepo: string, searchTerm: string): Promise<Issue[]> {
  const searchCommand = new Deno.Command("gh", {
    args: ["issue", "list", "-R", orgSlashRepo, "--search", searchTerm, "--json", "number,title,createdAt,url"]
  });
  
  const { stdout } = await searchCommand.output();
  const issues = JSON.parse(new TextDecoder().decode(stdout)) as Issue[];

  // リリース情報を取得
  const releases = await getReleases(orgSlashRepo);

  // 各issueに対応するリリース情報とフラグを追加
  const issuesWithRelease = issues.map(issue => {
    // issueの作成日以降の最初のリリースを見つける
    const nextRelease = releases.find(release => 
      new Date(release.publishedAt) < new Date(issue.createdAt)
    );
    
    // リリースがない場合は最新のissueとして扱う
    if (!nextRelease) {
      return {
        ...issue,
        release: nextRelease,
        isCreatedAfterRelease: true
      };
    }

    // issueの作成日とリリース日を比較
    const isCreatedAfterRelease = new Date(issue.createdAt) > new Date(nextRelease.publishedAt);
    
    return {
      ...issue,
      release: nextRelease,
      isCreatedAfterRelease
    };
  });

  // 番号で降順ソート
  return issuesWithRelease.sort((a, b) => b.number - a.number);
}
