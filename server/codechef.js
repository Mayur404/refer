import { isCalendarDate } from "../shared/dates.js";

const base = "https://www.codechef.com";

async function official(path, signal, json = false) {
  const response = await fetch(`${base}${path}`, {
    signal: AbortSignal.any(
      [signal, AbortSignal.timeout(12000)].filter(Boolean),
    ),
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: json ? "application/json" : "text/html",
    },
  });
  if (!response.ok) {
    const error = new Error(
      response.status === 429
        ? "CodeChef is rate limiting requests. Please try again later."
        : `CodeChef returned HTTP ${response.status}. Please try again.`,
    );
    error.status = [404, 429].includes(response.status) ? response.status : 502;
    throw error;
  }
  return json ? response.json() : response.text();
}

function number(value) {
  if (value == null || !String(value).trim()) return null;
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseProfile(html, handle) {
  if (/User not found|Could not find page/i.test(html)) {
    const error = new Error("CodeChef user not found. Check the handle.");
    error.status = 404;
    throw error;
  }
  if (!/User profile of/i.test(html))
    throw new Error("CodeChef returned an unreadable profile.");
  const rating = number(
    html.match(/class=["']rating-number["'][^>]*>\s*(\d+)/i)?.[1],
  );
  const maxRating = number(html.match(/Highest Rating\s*:?\s*(\d+)/i)?.[1]);
  const text = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const totalSolved = number(
    text.match(/Total Problems Solved\s*:?\s*(\d+)/i)?.[1] ??
      text.match(/Fully Solved\s*\(\s*(\d+)\s*\)/i)?.[1],
  );
  const starBlock =
    html.match(/class=["']rating-star["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  const starCount = (starBlock.match(/&#9733;|★/g) || []).length;
  const rawHistory = html.match(
    /(?:var\s+all_rating|date_versus_rating)\s*=\s*(\[[\s\S]*?\]);/,
  );
  let history = null;
  try {
    const parsed = rawHistory ? JSON.parse(rawHistory[1]) : null;
    if (Array.isArray(parsed)) history = parsed;
  } catch {
    /* A missing chart must not hide valid profile statistics. */
  }
  const ratingHistory = (history || [])
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const date =
        (typeof entry.end_date === "string"
          ? entry.end_date.split(" ")[0]
          : "") ||
        `${entry.getyear}-${String(entry.getmonth).padStart(2, "0")}-${String(entry.getday).padStart(2, "0")}`;
      const rating = number(entry.rating);
      return isCalendarDate(date) && rating !== null
        ? [
            {
              date,
              rating,
              contest:
                typeof entry.name === "string"
                  ? entry.name
                  : typeof entry.code === "string"
                    ? entry.code
                    : "CodeChef contest",
            },
          ]
        : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const historyComplete =
    history !== null && history.length === ratingHistory.length;
  return {
    handle,
    rating,
    ratingStatus:
      rating !== null
        ? "available"
        : /Unrated/i.test(text)
          ? "unrated"
          : "unavailable",
    maxRating,
    stars: starCount ? `${starCount}★` : "",
    totalSolved,
    attendedContests: historyComplete ? ratingHistory.length : null,
    ratingHistory,
    heatmap: null,
    url: `${base}/users/${encodeURIComponent(handle)}`,
    warning: [
      totalSolved === null && "Solved count unavailable.",
      !historyComplete && "Rating history is incomplete or unavailable.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function parseRecentActivity(content) {
  const days = {};
  // Count each submission row once; CodeChef repeats dates in title and tooltip.
  for (const row of content.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const match = row[1].match(/(\d{2})\/(\d{2})\/(\d{2})(?!\d)/);
    if (!match) continue;
    const date = `20${match[3]}-${match[2]}-${match[1]}`;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      continue;
    days[date] = (days[date] || 0) + 1;
  }
  return days;
}

export async function getCodeChefProfile(handle, signal) {
  const activitySignal = AbortSignal.any(
    [signal, AbortSignal.timeout(45000)].filter(Boolean),
  );
  const profile = parseProfile(
    await official(`/users/${encodeURIComponent(handle)}`, signal),
    handle,
  );
  const days = {};
  let pages = 0;
  let complete = false;
  try {
    for (let page = 0; page < 4; page++) {
      const data = await official(
        `/recent/user?page=${page}&user_handle=${encodeURIComponent(handle)}`,
        activitySignal,
        true,
      );
      if (typeof data.content !== "string")
        throw new Error("Invalid activity response");
      const activity = parseRecentActivity(data.content);
      for (const [date, count] of Object.entries(activity))
        days[date] = (days[date] || 0) + count;
      pages++;
      if (!Object.keys(activity).length || page >= Number(data.max_page)) {
        complete = true;
        break;
      }
    }
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  profile.heatmap = pages ? days : null;
  profile.warning = [
    profile.warning,
    !pages
      ? "Submission activity unavailable."
      : !complete
        ? "Activity covers only the latest retrieved submissions (up to four pages)."
        : "",
  ]
    .filter(Boolean)
    .join(" ");
  return profile;
}

export function parseContests(data) {
  if (
    !Array.isArray(data?.present_contests) ||
    !Array.isArray(data?.future_contests)
  )
    throw new Error("CodeChef returned an invalid contest list.");
  const items = [...data.present_contests, ...data.future_contests];
  const contests = items.flatMap((contest) => {
    if (
      !contest ||
      typeof contest.contest_code !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(contest.contest_code)
    )
      return [];
    const start = Date.parse(contest.contest_start_date_iso) / 1000;
    const end = Date.parse(contest.contest_end_date_iso) / 1000;
    const duration = Number.parseFloat(contest.contest_duration) * 60;
    return [
      {
        name: contest.contest_name,
        url: `${base}/${contest.contest_code}`,
        startTimeSeconds: start,
        durationSeconds:
          end > start ? end - start : duration > 0 ? duration : NaN,
      },
    ];
  });
  if (items.length && !contests.length)
    throw new Error("CodeChef returned an invalid contest list.");
  return contests;
}

export async function getCodeChefContests(signal) {
  return parseContests(
    await official(
      "/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=premium",
      signal,
      true,
    ),
  );
}
