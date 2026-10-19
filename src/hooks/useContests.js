import { useEffect, useState } from "react";
import { getContests } from "../services/contests.js";
import { errorMessage } from "../utils/format.js";

export default function useContests() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sources, setSources] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getContests(controller.signal, attempt > 0)
      .then((data) => {
        if (!controller.signal.aborted) {
          setContests(data.contests);
          setSources(data.sources);
          if (data.sources.every((source) => !source.ok))
            setError(
              "The contest feeds are unavailable. Try again or visit the official schedules below.",
            );
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  return {
    contests: contests
      .filter(
        (contest) =>
          (contest.startTimeSeconds + contest.durationSeconds) * 1000 > now,
      )
      .map((contest) => ({
        ...contest,
        phase: contest.startTimeSeconds * 1000 <= now ? "CODING" : "BEFORE",
      })),
    loading,
    error,
    sources,
    retry: () => {
      setLoading(true);
      setError("");
      setAttempt((value) => value + 1);
    },
  };
}
