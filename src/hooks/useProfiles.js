import { useEffect, useRef, useState } from "react";
import { platforms } from "../data/platforms.js";
import {
  getPlatformProfile,
  validatePlatformHandle,
} from "../services/profiles.js";
import { readStorage } from "../utils/storage.js";
import { errorMessage } from "../utils/format.js";
import { readSavedProfile } from "../utils/profileCache.js";

export function readSavedHandles() {
  const old = readStorage("cpsync-handles", {});
  return Object.fromEntries(
    Object.keys(platforms).map((platform) => {
      const saved = readStorage(
        `cpsync.handle.${platform}`,
        old?.[platform] ||
          (platform === "codeforces" ? readStorage("cpsync.handle", "") : ""),
      );
      return [
        platform,
        typeof saved === "string" && !validatePlatformHandle(saved, platform)
          ? saved.trim()
          : "",
      ];
    }),
  );
}

function pendingStates(handles, previous = {}) {
  return Object.fromEntries(
    Object.keys(platforms).map((platform) => {
      const handle = handles[platform];
      const current =
        previous[platform]?.handle === handle ? previous[platform] : null;
      const saved =
        handle && !current?.data ? readSavedProfile(platform, handle) : null;
      const data = handle ? current?.data || saved?.profile || null : null;
      return [
        platform,
        {
          status: data ? "ready" : handle ? "loading" : "idle",
          data,
          savedAt: current?.savedAt ?? saved?.time,
          refreshing: Boolean(handle),
          error: "",
          handle,
        },
      ];
    }),
  );
}

export default function useProfiles() {
  const [request, setRequest] = useState(() => ({
    handles: readSavedHandles(),
    revision: 0,
  }));
  const [states, setStates] = useState(() => pendingStates(request.handles));
  const pending = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    pending.current = controller;
    for (const platform of Object.keys(platforms)) {
      const handle = request.handles[platform];
      if (!handle) continue;
      getPlatformProfile(
        platform,
        handle,
        controller.signal,
        request.revision > 0,
      )
        .then((data) => {
          if (!controller.signal.aborted)
            setStates((current) => ({
              ...current,
              [platform]: {
                status: "ready",
                data,
                error: "",
                handle,
                savedAt: readSavedProfile(platform, handle)?.time || Date.now(),
              },
            }));
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setStates((current) => ({
              ...current,
              [platform]: {
                ...current[platform],
                status: current[platform]?.data ? "ready" : "error",
                refreshing: false,
                error: errorMessage(error),
              },
            }));
        });
    }
    return () => controller.abort();
  }, [request]);

  return {
    handles: request.handles,
    states,
    loading: Object.values(states).some(
      (state) => state.status === "loading" || state.refreshing,
    ),
    sync: (handles) => {
      pending.current?.abort();
      setStates((current) => pendingStates(handles, current));
      setRequest((current) => ({ handles, revision: current.revision + 1 }));
    },
  };
}
