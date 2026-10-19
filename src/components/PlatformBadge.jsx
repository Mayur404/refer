import { platforms } from "../data/platforms.js";

export default function PlatformBadge({ platform }) {
  const definition = platforms[platform];
  return (
    <span className={`platform-badge platform-${platform}`}>
      {definition.name}
    </span>
  );
}
