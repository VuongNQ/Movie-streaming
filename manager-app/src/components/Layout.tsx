import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

const links = [
  { to: "/", label: "Tổng quan" },
  { to: "/categories", label: "Danh mục & Tag" },
  { to: "/movies", label: "Phim" },
  { to: "/versions", label: "Phiên bản Android" },
  { to: "/users", label: "Người dùng" },
];

export function Layout() {
  const auth = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Movie Streaming Manager</h1>
          <div className="flex items-center gap-3">
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
            <button
              className="rounded bg-slate-200 px-2 py-1 text-sm"
              type="button"
              onClick={() => {
                auth.signOut();
                navigate("/login");
              }}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
