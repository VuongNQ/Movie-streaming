import { useCategories, useMovies, useUsers, useVersionPolicy } from "../lib/queries";

export function DashboardPage() {
  const categories = useCategories();
  const movies = useMovies();
  const users = useUsers();
  const version = useVersionPolicy();

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <InfoCard title="Danh mục" value={categories.data?.length ?? 0} />
      <InfoCard title="Phim" value={movies.data?.length ?? 0} />
      <InfoCard title="Người dùng" value={users.data?.length ?? 0} />
      <InfoCard title="Force update" value={version.data?.forceVersion ?? "-"} />
    </section>
  );
}

function InfoCard({ title, value }: { title: string; value: string | number }) {
  return (
    <article className="rounded-lg bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}
