import { NavLink } from "react-router-dom";
import Icon from "./Icon.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const navigation = [
  { path: "/", label: "Dashboard", icon: "grid" },
  { path: "/contests", label: "Contests", icon: "trophy" },
  { path: "/profile", label: "Profile", icon: "user" },
  { path: "/compiler", label: "Compiler", icon: "code" },
];

export default function Navbar() {
  return (
    <header className="site-header">
      <div className="header-inner page-shell">
        <NavLink to="/" className="brand" aria-label="CPSync home">
          <span className="brand-symbol">
            <Icon name="code" size={23} />
          </span>
          <span className="wordmark">
            CP<span>SYNC</span>
            <span className="brand-dot">.</span>
          </span>
        </NavLink>
        <nav aria-label="Main navigation">
          {navigation.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              <Icon name={icon} size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
