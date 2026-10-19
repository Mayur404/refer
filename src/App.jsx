import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import Icon from "./components/Icon.jsx";
import Navbar from "./components/Navbar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Contests from "./pages/Contests.jsx";
import Profile from "./pages/Profile.jsx";
import Compiler from "./pages/Compiler.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    const titles = new Map([
      ["/", "CPSync"],
      ["/contests", "Contests | CPSync"],
      ["/profile", "Profile | CPSync"],
      ["/compiler", "Compiler | CPSync"],
    ]);
    const path = pathname.toLowerCase().replace(/\/+$/, "") || "/";
    document.title = titles.get(path) || "Page not found | CPSync";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Navbar />
      <main
        id="main"
        className={`page-shell${pathname === "/compiler" ? " compiler-page" : ""}`}
        tabIndex={-1}
      >
        <div className="page-transition" key={pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contests" element={<Contests />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/compiler" element={<Compiler />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      <footer className="site-footer page-shell">
        <Link to="/" className="brand" aria-label="CPSync home">
          <span className="brand-symbol">
            <Icon name="code" size={23} />
          </span>
          <span className="wordmark">
            CP<span>SYNC</span>
            <span className="brand-dot">.</span>
          </span>
        </Link>
      </footer>
    </>
  );
}
