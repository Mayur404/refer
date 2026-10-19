const query = `query userFullProfile($username: String!) {
  matchedUser(username: $username) {
    username
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    userCalendar { submissionCalendar }
  }
  userContestRanking(username: $username) { rating attendedContestsCount globalRanking }
  userContestRankingHistory(username: $username) { attended rating contest { title startTime } }
}`;

export async function getOfficialLeetCodeProfile(handle, signal) {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    signal: AbortSignal.any(
      [signal, AbortSignal.timeout(10000)].filter(Boolean),
    ),
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({ query, variables: { username: handle } }),
  });
  if (!response.ok) {
    const error = new Error(
      "LeetCode is temporarily unavailable. Please try again.",
    );
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  const result = await response.json();
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new Error("LeetCode returned incomplete profile data.");
  if (
    result.data?.matchedUser === null ||
    (Array.isArray(result.errors) &&
      result.errors.some((error) =>
        /does not exist|not found/i.test(error?.message),
      ))
  ) {
    const error = new Error("LeetCode user not found. Check the handle.");
    error.status = 404;
    throw error;
  }
  if (!result.data?.matchedUser)
    throw new Error("LeetCode returned incomplete profile data.");
  return result;
}
