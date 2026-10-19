import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "../utils/storage.js";
import Icon from "./Icon.jsx";

function preferredTheme() {
  const saved = readStorage("cpsync.theme", null);
  return saved === "light" || saved === "dark"
    ? saved
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(preferredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#171715" : "#e2e2df");
  }, [theme]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(preferredTheme());
    const updateSystem = () => {
      const saved = readStorage("cpsync.theme", null);
      if (saved !== "light" && saved !== "dark") update();
    };
    const updateStorage = (event) => {
      if (event.key === "cpsync.theme" || event.key === null) update();
    };
    preference.addEventListener("change", updateSystem);
    window.addEventListener("storage", updateStorage);
    return () => {
      preference.removeEventListener("change", updateSystem);
      window.removeEventListener("storage", updateStorage);
    };
  }, []);

  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-label="Dark mode"
      aria-checked={theme === "dark"}
      title={`Switch to ${next} mode`}
      onClick={() => {
        writeStorage("cpsync.theme", next);
        setTheme(next);
      }}
    >
      <span className="theme-switch-track" aria-hidden="true">
        <span className="theme-switch-thumb" />
        <span className="theme-switch-option theme-switch-light">
          <Icon name="sun" size={16} />
        </span>
        <span className="theme-switch-option theme-switch-dark">
          <Icon name="moon" size={16} />
        </span>
      </span>
    </button>
  );
}
