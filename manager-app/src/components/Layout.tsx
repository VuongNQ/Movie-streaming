import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Tổng quan" },
  { to: "/categories", label: "Danh mục & Tag" },
  { to: "/movies", label: "Phim" },
  { to: "/versions", label: "Phiên bản Android" },
  { to: "/users", label: "Người dùng" },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Movie Streaming Manager</h1>
          <nav className="flex gap-3 text-sm">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded px-2 py-1 ${isActive ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-200"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
