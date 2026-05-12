import { useMovies, useUsers } from "../lib/queries";

export function UsersPage() {
  const users = useUsers();
  const movies = useMovies();
  const movieLookup = new Map((movies.data ?? []).map((movie) => [movie.id, movie.title]));

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Người dùng & lịch sử xem</h2>
      <ul className="mt-3 space-y-3">
        {(users.data ?? []).map((user) => (
          <li key={user.id} className="rounded border p-3">
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-slate-600">{user.email}</p>
            <p className="mt-2 text-sm">
              Đã xem: {user.watchedMovieIds.map((id) => movieLookup.get(id) ?? id).join(", ") || "Chưa xem phim"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
