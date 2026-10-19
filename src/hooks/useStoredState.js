import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "../utils/storage.js";

// Keep small UI preferences across navigation and browser restarts.
export default function useStoredState(key, fallback, validate) {
  const [value, setValue] = useState(() => {
    const saved = readStorage(key, fallback);
    return validate(saved) ? saved : fallback;
  });
  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);
  return [value, setValue];
}
