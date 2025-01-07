import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { stub } from "https://deno.land/std@0.208.0/testing/mock.ts";
import { getRelativeTimeString, パッケージ名からGitHubのOrgrepoを取得する, GitHubのIssueを検索する } from "./utils.ts";

// パッケージ名からGitHubのorg/repoを取得する関数のテスト
Deno.test("パッケージ名からGitHubのOrgrepoを取得する", async (t) => {
  await t.step("正常系: GitHubのorg/repoを返す", async () => {
    // Denoのコマンド実行をスタブ化
    const commandStub = stub(Deno, "Command", () => ({
      output: () => Promise.resolve({
        stdout: new TextEncoder().encode("git+https://github.com/denoland/deno.git")
      })
    }));

    try {
      const result = await パッケージ名からGitHubのOrgrepoを取得する("deno");
      assertEquals(result, "denoland/deno");
    } finally {
      commandStub.restore();
    }
  });

  await t.step("異常系: コマンドが失敗した場合", async () => {
    // エラーを投げるスタブを作成
    const commandStub = stub(Deno, "Command", () => ({
      output: () => Promise.reject(new Error("Command failed"))
    }));

    try {
      await assertRejects(
        () => パッケージ名からGitHubのOrgrepoを取得する("invalid-package"),
        Error,
        "Command failed"
      );
    } finally {
      commandStub.restore();
    }
  });
});

Deno.test("GitHubのIssueを検索する", async (t) => {
  await t.step("正常系: issueのリストを番号順（降順）で返す", async () => {
    const mockIssues = [
      { number: 1, title: "Issue 1", createdAt: "2023-01-01", url: "url1" },
      { number: 3, title: "Issue 3", createdAt: "2023-01-03", url: "url3" },
      { number: 2, title: "Issue 2", createdAt: "2023-01-02", url: "url2" }
    ];

    // Denoのコマンド実行をスタブ化
    const commandStub = stub(Deno, "Command", () => ({
      output: () => Promise.resolve({
        stdout: new TextEncoder().encode(JSON.stringify(mockIssues))
      })
    }));

    try {
      const result = await GitHubのIssueを検索する("owner/repo", "test");
      assertEquals(result, [
        { number: 3, title: "Issue 3", createdAt: "2023-01-03", url: "url3" },
        { number: 2, title: "Issue 2", createdAt: "2023-01-02", url: "url2" },
        { number: 1, title: "Issue 1", createdAt: "2023-01-01", url: "url1" }
      ]);
    } finally {
      commandStub.restore();
    }
  });

  await t.step("異常系: コマンドが失敗した場合", async () => {
    // エラーを投げるスタブを作成
    const commandStub = stub(Deno, "Command", () => ({
      output: () => Promise.reject(new Error("Command failed"))
    }));

    try {
      await assertRejects(
        () => GitHubのIssueを検索する("owner/repo", "test"),
        Error,
        "Command failed"
      );
    } finally {
      commandStub.restore();
    }
  });
});

// 相対時間文字列を取得する関数のテスト
Deno.test("getRelativeTimeString", async (t) => {
  await t.step("年前のケース", () => {
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    assertEquals(getRelativeTimeString(twoYearsAgo.toISOString()), "2年前");
  });

  await t.step("月前のケース", () => {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    assertEquals(getRelativeTimeString(threeMonthsAgo.toISOString()), "3ヶ月前");
  });

  await t.step("日前のケース", () => {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5);
    assertEquals(getRelativeTimeString(fiveDaysAgo.toISOString()), "5日前");
  });

  await t.step("時間前のケース", () => {
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    assertEquals(getRelativeTimeString(sixHoursAgo.toISOString()), "6時間前");
  });

  await t.step("分前のケース", () => {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    assertEquals(getRelativeTimeString(tenMinutesAgo.toISOString()), "10分前");
  });

  await t.step("秒前のケース", () => {
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
    assertEquals(getRelativeTimeString(thirtySecondsAgo.toISOString()), "30秒前");
  });
});
