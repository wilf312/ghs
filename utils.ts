import type { Issue, Release, Tag, VersionInfo } from "./types.ts";

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

// タグ情報を取得する関数
async function getTags(orgSlashRepo: string): Promise<Tag[]> {
  try {
    const tagsCommand = new Deno.Command("gh", {
      args: ["api", `repos/${orgSlashRepo}/tags`]
    });
    
    const { stdout } = await tagsCommand.output();
    const tags = JSON.parse(new TextDecoder().decode(stdout));
    
    // タグの詳細情報（コミット日時）を取得
    const tagDetails = await Promise.all(tags.map(async (tag: { name: string; commit: { sha: string } }) => {
      const commitCommand = new Deno.Command("gh", {
        args: ["api", `repos/${orgSlashRepo}/commits/${tag.commit.sha}`]
      });
      
      const { stdout } = await commitCommand.output();
      const commit = JSON.parse(new TextDecoder().decode(stdout));
      
      return {
        name: tag.name,
        publishedAt: commit.commit.author.date
      };
    }));
    
    return tagDetails;
  } catch {
    return [];
  }
}

// バージョン情報を組み合わせて取得する関数
async function getVersions(orgSlashRepo: string): Promise<VersionInfo[]> {
  const [releases, tags] = await Promise.all([
    getReleases(orgSlashRepo),
    getTags(orgSlashRepo)
  ]);

  const versions: VersionInfo[] = [
    ...releases.map(release => ({
      name: release.tagName,
      publishedAt: release.publishedAt,
      type: 'release' as const
    })),
    ...tags.map(tag => ({
      name: tag.name,
      publishedAt: tag.publishedAt,
      type: 'tag' as const
    }))
  ];

  // 日付でソート
  return versions.sort((a, b) => 
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
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

  console.log(issues)

  // バージョン情報を取得
  const versions = await getVersions(orgSlashRepo);

  // 各issueに対応するバージョン情報とフラグを追加
  const issuesWithVersion = issues.map(issue => {
    // issueの作成日以降の最初のバージョンを見つける
    const nextVersion = versions.find(version => 
      new Date(version.publishedAt) < new Date(issue.createdAt)
    );
    
    // バージョンがない場合は最新のissueとして扱う
    if (!nextVersion) {
      return {
        ...issue,
        version: nextVersion,
        isCreatedAfterVersion: true
      };
    }

    // issueの作成日とバージョン日を比較
    const isCreatedAfterVersion = new Date(issue.createdAt) > new Date(nextVersion.publishedAt);
    
    return {
      ...issue,
      version: nextVersion,
      isCreatedAfterVersion
    };
  });

  // 番号で降順ソート
  return issuesWithVersion.sort((a, b) => b.number - a.number);
}
