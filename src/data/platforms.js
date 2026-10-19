export const platforms = {
  codeforces: {
    name: "Codeforces",
    contestsUrl: "https://codeforces.com/contests",
    profileUrl: "https://codeforces.com/profile/",
    host: "codeforces.com",
  },
  leetcode: {
    name: "LeetCode",
    contestsUrl: "https://leetcode.com/contest/",
    profileUrl: "https://leetcode.com/u/",
    host: "leetcode.com",
  },
  codechef: {
    name: "CodeChef",
    contestsUrl: "https://www.codechef.com/contests",
    profileUrl: "https://www.codechef.com/users/",
    host: "www.codechef.com",
  },
};

export function isOfficialContestUrl(value, platform) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === platforms[platform]?.host &&
      !url.username &&
      !url.password &&
      url.pathname !== "/"
    );
  } catch {
    return false;
  }
}
