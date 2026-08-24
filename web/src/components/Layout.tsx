import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LINKS: Record<string, { to: string; label: string }[]> = {
  CUSTOMER: [
    { to: "/orders", label: "My Orders" },
    { to: "/orders/new", label: "New Order" },
  ],
  AGENT: [{ to: "/agent", label: "My Deliveries" }],
  ADMIN: [
    { to: "/admin", label: "Dashboard" },
    { to: "/admin/orders", label: "All Orders" },
    { to: "/orders/new", label: "New Order" },
    { to: "/admin/zones", label: "Zones & Areas" },
    { to: "/admin/rate-cards", label: "Rate Cards" },
    { to: "/admin/agents", label: "Agents" },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const links = LINKS[user.role] ?? [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Last<span>Mile</span>
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/admin"}
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
          >
            {l.label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <div style={{ fontWeight: 600, color: "var(--text)" }}>{user.name}</div>
          <div>{user.role}</div>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 10, width: "100%" }} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
