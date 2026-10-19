import { lazy, Suspense, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";

const OrbitScene = lazy(() => import("../components/OrbitScene.jsx"));
const shortcuts = [
  {
    path: "/contests",
    icon: "calendar",
    title: "Find your next round",
    description: "Codeforces, LeetCode, and CodeChef. One clear calendar.",
    action: "Explore contests",
  },
  {
    path: "/profile",
    icon: "user",
    title: "Follow your progress",
    description: "Connect your handles. See your ratings and results.",
    action: "View your profile",
  },
  {
    path: "/compiler",
    icon: "code",
    title: "Work through an idea",
    description: "A focused editor for Java, C++, and Python.",
    action: "Open compiler",
  },
];

export default function Dashboard() {
  const shortcutsRef = useRef(null);

  useEffect(() => {
    const section = shortcutsRef.current;
    if (
      !section ||
      !window.IntersectionObserver ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const targets = section.querySelectorAll("[data-scroll-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -48px 0px" },
    );
    targets.forEach((target) => {
      target.classList.add("scroll-reveal-ready");
      observer.observe(target);
    });
    return () => {
      observer.disconnect();
      targets.forEach((target) =>
        target.classList.remove("scroll-reveal-ready", "is-revealed"),
      );
    };
  }, []);

  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <h1 id="hero-heading">
            THINK.
            <br />
            <span className="accent">CODE.</span>
            <br />
            REPEAT.
          </h1>
          <p className="eyebrow">FOR THE LOVE OF FIGURING IT OUT.</p>
        </div>
        <Suspense fallback={<div className="orbit-art" aria-hidden="true" />}>
          <OrbitScene />
        </Suspense>
      </section>
      <div className="dashboard-tools" ref={shortcutsRef}>
        <div className="dashboard-section-label" data-scroll-reveal>
          <span>PICK YOUR NEXT MOVE</span>
        </div>
        <section className="workspace-strip" aria-label="Workspace shortcuts">
          {shortcuts.map((shortcut, index) => (
            <Link
              to={shortcut.path}
              key={shortcut.path}
              data-scroll-reveal
              style={{
                "--reveal-delay": `${index * 110}ms`,
                "--reveal-tilt": `${(index - 1) * 3}deg`,
              }}
            >
              <div className="shortcut-top">
                <span className="shortcut-icon">
                  <Icon name={shortcut.icon} size={23} />
                </span>
                <span className="shortcut-number mono">0{index + 1}</span>
              </div>
              <h2>{shortcut.title}</h2>
              <p>{shortcut.description}</p>
              <span className="shortcut-action">
                {shortcut.action}
                <Icon name="arrow" size={16} />
              </span>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
