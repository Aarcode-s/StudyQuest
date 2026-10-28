import { NavLink } from "react-router-dom";
import Icon from "./Icon";
import type { IconName } from "./Icon";

const TABS: { to: string; icon: IconName; label: string }[] = [
  { to: "/", icon: "focus", label: "Focus" },
  { to: "/dashboard", icon: "dash", label: "Dashboard" },
  { to: "/rooms", icon: "rooms", label: "Rooms" },
  { to: "/settings", icon: "set", label: "Settings" },
];

export default function Nav() {
  return (
    <nav className="nav" aria-label="Main">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === "/"}
          aria-label={t.label}
          className={({ isActive }) => `nv ${isActive ? "on" : ""}`}
        >
          {({ isActive }) => (
            <>
              <Icon name={t.icon} size={22} />
              {isActive && <span>{t.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
