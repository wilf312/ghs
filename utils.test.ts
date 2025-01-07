import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { getRelativeTimeString } from "./utils.ts";

Deno.test("getRelativeTimeString - 年前のケース", () => {
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  assertEquals(getRelativeTimeString(twoYearsAgo.toISOString()), "2年前");
});

Deno.test("getRelativeTimeString - 月前のケース", () => {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  assertEquals(getRelativeTimeString(threeMonthsAgo.toISOString()), "3ヶ月前");
});

Deno.test("getRelativeTimeString - 日前のケース", () => {
  const now = new Date();
  const fiveDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5);
  assertEquals(getRelativeTimeString(fiveDaysAgo.toISOString()), "5日前");
});

Deno.test("getRelativeTimeString - 時間前のケース", () => {
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  assertEquals(getRelativeTimeString(sixHoursAgo.toISOString()), "6時間前");
});

Deno.test("getRelativeTimeString - 分前のケース", () => {
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  assertEquals(getRelativeTimeString(tenMinutesAgo.toISOString()), "10分前");
});

Deno.test("getRelativeTimeString - 秒前のケース", () => {
  const now = new Date();
  const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
  assertEquals(getRelativeTimeString(thirtySecondsAgo.toISOString()), "30秒前");
});
