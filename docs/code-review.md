# ghs コードレビュー: シニアエンジニア視点の改善提案

## 概要

本ドキュメントは `ghs`（GitHub Issue Search Helper）のコードベースを構造・設計・品質の観点からレビューし、改善提案をまとめたものです。

対象ファイル:

| ファイル | 行数 | 役割 |
|---|---|---|
| `ghs.ts` | 127行 | メインエントリポイント・CLI |
| `utils.ts` | 152行 | ビジネスロジック |
| `types.ts` | 24行 | 型定義 |
| `utils.test.ts` | 138行 | テスト |

---

## 1. アーキテクチャ / モジュール設計

### 1.1 関心の分離が不十分

**現状**: `utils.ts` に外部コマンド実行（`Deno.Command`）とビジネスロジック（ソート、バージョンマッピング）が混在している。

**問題点**: テスト時に `Deno.Command` をスタブしなければならず、テストが実装詳細に依存する。ロジックの再利用性も低い。

**改善案**: レイヤーを分離する。

```
commands/   ← 外部コマンド呼び出し（gh, npm）
  github.ts
  npm.ts
services/   ← ビジネスロジック
  version.ts
  issue.ts
types.ts
ghs.ts      ← CLI / エントリポイント
```

外部コマンド層をインターフェースで抽象化すれば、テスト時に依存注入で差し替えられる。

### 1.2 `ghs.ts` に UI ロジックとビジネスロジックが混在

**現状**: `groupIssuesByVersion()` は `ghs.ts` 内に定義されているが、純粋なデータ変換関数。

**改善案**: `utils.ts`（またはサービス層）へ移動し、テスト対象にする。現状この関数にテストがない。

---

## 2. エラーハンドリング

### 2.1 外部コマンドの失敗が暗黙的に無視される

**該当箇所**: `utils.ts:4-15` (`getReleases`), `utils.ts:18-46` (`getTags`)

```typescript
} catch {
  return [];  // エラーを握りつぶしている
}
```

**問題点**:
- `gh` コマンドが未インストール、認証切れ、レートリミットなど、原因が異なるエラーを一律で空配列にしている
- ユーザーがなぜデータが表示されないのか判断できない

**改善案**:
- 最低限 `stderr` をログに出す
- `Deno.Command` の `success` / `code` を確認し、エラー種別に応じたメッセージを出す

### 2.2 `stdout` のパース失敗が未処理

**該当箇所**: `utils.ts:11`, `utils.ts:25`, `utils.ts:119` など

`JSON.parse()` が失敗した場合（例: `gh` が HTML エラーページを返す場合）、キャッチされず例外がそのまま上位に伝搬する。

**改善案**: `JSON.parse` を try-catch で囲むか、Zod / Valibot 等で返り値をバリデーションする。

### 2.3 `パッケージ名からGitHubのOrgrepoを取得する` のエラーハンドリングがない

**該当箇所**: `utils.ts:95-109`

他の関数は try-catch があるが、この関数にはない。`npm view` が失敗した場合や空文字列を返した場合、不正な org/repo 文字列が後続処理に渡る。

---

## 3. パフォーマンス

### 3.1 タグごとに個別の API コールが発生する（N+1 問題）

**該当箇所**: `utils.ts:28-40`

```typescript
const tagDetails = await Promise.all(tags.map(async (tag) => {
  const commitCommand = new Deno.Command("gh", {
    args: ["api", `repos/${orgSlashRepo}/commits/${tag.commit.sha}`]
  });
  // ...
}));
```

**問題点**: タグが30個あれば30回の `gh api` 呼び出しが発生する。GitHub API のレートリミットにも影響する。

**改善案**:
- `gh api` の GraphQL エンドポイントで一括取得する
- または `git log --format` を使ってローカルで取得する
- 最低限、取得件数に上限を設ける（`tags` API はデフォルト30件返す）

### 3.2 Issue 検索のたびにリリース＋タグを全取得している

**該当箇所**: `utils.ts:122`

`GitHubのIssueを検索する` のたびに `getVersions()` が呼ばれる。同一セッションで複数回検索する場合、キャッシュがないので毎回 API を叩く。

**改善案**: バージョン情報をキャッシュする（メモリ内、または一時ファイル）。

---

## 4. 堅牢性・エッジケース

### 4.1 `open` コマンドが macOS 限定

**該当箇所**: `ghs.ts:70`

```typescript
await new Deno.Command("open", { args: [selectedIssue] }).output();
```

**問題点**: Linux では `xdg-open`、Windows では `start` が必要。CI 環境や README の `ubuntu-latest` とも矛盾する。

**改善案**: プラットフォーム判定を行うか、`Deno.build.os` を使って分岐する。

### 4.2 URL パースが文字列置換の連鎖で脆弱

**該当箇所**: `utils.ts:102-108`

```typescript
return repoInfo
  .trim()
  .replace('git+', '')
  .replace('git://', '')
  .replace('https://', '')
  .replace('github.com/', '')
  .replace('.git', '');
```

**問題点**:
- `git+ssh://` 形式に未対応
- `github.com` 以外のホスト（GitHub Enterprise 等）に対応できない
- URL 内に `.git` が含まれるリポジトリ名（例: `dotgit.git`）で誤動作する
- `replace` は最初の一致のみ置換するため、URL に `github.com` が複数回出現すると壊れる

**改善案**: `URL` API を使って正規にパースする。

```typescript
const url = new URL(repoInfo.trim().replace('git+', ''));
const [, org, repo] = url.pathname.split('/');
return `${org}/${repo.replace(/\.git$/, '')}`;
```

### 4.3 `package.json` のパスがカレントディレクトリ固定

**該当箇所**: `ghs.ts:85`

```typescript
const packageJson = JSON.parse(await Deno.readTextFile("./package.json"));
```

**問題点**: `ghs` をグローバルインストールした場合、実行時のカレントディレクトリに `package.json` がないと失敗する。

**改善案**: 引数でパスを指定可能にするか、上位ディレクトリを探索する。

---

## 5. 型安全性

### 5.1 `gh` コマンドの返り値が型検証されていない

**該当箇所**: `utils.ts:11`, `utils.ts:25`, `utils.ts:119`

`JSON.parse()` の結果を `as` でキャストしているが、実行時のバリデーションがない。

```typescript
const issues = JSON.parse(...) as Issue[];  // 実行時には何も検証されていない
```

**改善案**: Zod 等のランタイムバリデーションライブラリで外部データの型を検証する。

### 5.2 `getTags` 内のインライン型

**該当箇所**: `utils.ts:28`

```typescript
tags.map(async (tag: { name: string; commit: { sha: string } }) => {
```

**問題点**: `types.ts` に定義すべき型がインラインで書かれている。

---

## 6. テスト

### 6.1 カバレッジの不足

テストが存在しない関数:
- `groupIssuesByVersion()` — バージョン境界のグルーピングロジックはバグが出やすい箇所
- `getReleases()`, `getTags()`, `getVersions()` — 現状 export されておらずテスト不可
- `getDependencies()`
- `searchPackageIssues()`

**改善案**:
- `groupIssuesByVersion()` を export してテストする
- 外部コマンド層を分離すればロジック部分を単独でテスト可能になる

### 6.2 テストの `Deno.Command` スタブが脆弱

**該当箇所**: `utils.test.ts:9-13`, `utils.test.ts:50-68`

`Deno.Command` 全体をスタブしているため、テスト対象以外の内部呼び出しにも影響する。引数のアサーションもない。

**改善案**: コマンド実行を抽象化し、テスト時にモック実装を注入する。

### 6.3 `getRelativeTimeString` のテストがタイミング依存

**該当箇所**: `utils.test.ts:103-138`

テスト内で `new Date()` を呼び、テスト対象関数内でも `new Date()` を呼ぶため、実行タイミングによって微妙にずれる可能性がある（特に月境界）。

**改善案**: 現在時刻を引数で注入可能にする。

```typescript
export function getRelativeTimeString(date: string, now = new Date()) {
```

---

## 7. コーディング規約・保守性

### 7.1 命名言語の不統一

プロジェクト内で英語と日本語の関数名が混在している。

| 日本語 | 英語相当 |
|---|---|
| `パッケージ名からGitHubのOrgrepoを取得する` | `getGitHubRepoFromPackageName` |
| `GitHubのIssueを検索する` | `searchGitHubIssues` |
| コメント（日本語） | 変数名（英語） |

**問題点**: 外部コントリビューターの参入障壁になる。IDE のオートコンプリートで日本語入力切替が必要。

**改善案**: 関数名・変数名は英語に統一し、コメントは日本語を維持する（チーム方針として明文化）。

### 7.2 `package.json` の不整合

**問題点**:
- `"main": "index.js"` — 存在しないファイルを指している
- `"description": ""` — 空のまま
- `dependencies` に `@inquirer/prompts` と `inquirer-autocomplete-prompt` があるが、実際のコードでは未使用（Deno + cliffy を使用）
- `"license": "ISC"` だが README では `MIT` と記載

### 7.3 `deno.jsonc` で `deno.land/x` の URL インポートを使用

**該当箇所**: `deno.jsonc:8`

```jsonc
"cliffy/": "https://deno.land/x/cliffy@v1.0.0-rc.3/"
```

**問題点**: Deno 2.x では `jsr:` が推奨。`deno.land/x` は非推奨の方向。また RC バージョンを本番利用している。

---

## 8. セキュリティ

### 8.1 コマンドインジェクションのリスク

**該当箇所**: `utils.ts:97`, `utils.ts:114-115`

ユーザー入力（`packageName`, `searchTerm`）がそのまま `Deno.Command` の引数に渡されている。

```typescript
const npmCommand = new Deno.Command("npm", {
  args: ["view", packageName, "repository.url"],
});
```

**考察**: `Deno.Command` は引数を配列で受け取るため、シェルインジェクションのリスクは低い。ただし、意図しない引数（`--` で始まるパッケージ名など）によるオプションインジェクションの可能性はある。

**改善案**: 入力値のバリデーション（npm パッケージ名の形式チェック等）を追加する。

---

## 9. CI/CD

### 9.1 lint がCIに含まれていない

**該当箇所**: `.github/workflows/test.yml`

README では `deno lint` に言及しているが、CI ワークフローではテストのみ実行。

**改善案**: `deno lint` と `deno fmt --check` もCIに追加する。

### 9.2 Deno のバージョンが `v2.x` と幅広い

**改善案**: マイナーバージョンまで固定する（例: `v2.1.x`）。

---

## 10. 優先度マトリクス

| 優先度 | 項目 | 理由 |
|---|---|---|
| **高** | 2.1 エラーの握りつぶし | ユーザーが問題の原因を特定できない |
| **高** | 4.2 URL パースの脆弱さ | 一部パッケージで動作しない |
| **高** | 7.2 package.json の不整合 | ライセンス表記の矛盾、未使用依存 |
| **中** | 3.1 N+1 API コール | パフォーマンスとレートリミット |
| **中** | 4.1 macOS 限定の `open` | クロスプラットフォーム対応 |
| **中** | 6.1 テストカバレッジ不足 | リグレッション検知の欠如 |
| **中** | 1.1 関心の分離 | 長期的な保守性 |
| **低** | 7.1 命名言語の不統一 | コントリビューション障壁 |
| **低** | 5.1 ランタイム型検証 | 防御的プログラミング |
| **低** | 9.1 CI に lint 追加 | コード品質の自動担保 |
