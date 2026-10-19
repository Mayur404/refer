import { useEffect, useState } from "react";
import { countdown } from "../utils/format.js";
import Icon from "./Icon.jsx";

export default function Countdown({ start, label = "Starts in" }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const time = countdown(start, now);
  return (
    <span
      className="contest-countdown"
      aria-label={`${label}: ${time.days} days, ${time.hours} hours, ${time.minutes} minutes`}
    >
      <Icon name="clock" size={15} />
      {label}{" "}
      {time.started
        ? "0m"
        : time.days
          ? `${time.days}d ${time.hours}h`
          : `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}:${String(time.seconds).padStart(2, "0")}`}
    </span>
  );
}
