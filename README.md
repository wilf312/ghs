# ghs

GitHubのIssueを検索するためのCLIツール

## 機能

- GitHubのIssueを検索（最大200件）
- パッケージ名からGitHubのOrg/Repoを自動取得
- 相対時間表示（例：「2年前」「3ヶ月前」「5日前」）

## 必要条件

- [Deno](https://deno.land/)
- [GitHub CLI](https://cli.github.com/)
- GitHubアカウントとGitHub CLIでの認証

## インストール

```bash
# GitHub CLIのインストール（macOS）
brew install gh deno

# GitHub CLIの認証
gh auth login

# このリポジトリのクローン
git clone https://github.com/yourusername/ghs.git
cd ghs
```

## 使用方法

```bash
npm install

npm run addCli
```

## 出力例

```typescript
[
  {
    number: 123,
    title: "バグ修正のIssue",
    createdAt: "2023-01-01",
    url: "https://github.com/owner/repo/issues/123",
    version: {
      name: "v1.0.0",
      publishedAt: "2023-01-02",
      type: "release"
    },
    isCreatedAfterVersion: false
  }
]
```

## 機能の詳細

### GitHubのIssue検索

- `gh issue list` コマンドを使用してIssueを検索
- 最大200件のIssueを取得可能
- Issue番号の降順でソート
- 各Issueに対して、作成日以降の最初のバージョン情報を付加

### パッケージ名からGitHubのOrg/Repoを取得

- npmパッケージ名からGitHubのリポジトリ情報を自動取得
- リポジトリのURLから`owner/repo`形式の文字列を抽出

### 相対時間表示

以下の単位で相対時間を日本語表示：
- 年前
- ヶ月前
- 日前
- 時間前
- 分前
- 秒前

## 開発

```bash
# テストの実行
deno test

# リンターの実行
deno lint
```

## ライセンス

MIT
