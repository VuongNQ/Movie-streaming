import { FormEvent, useMemo, useState } from "react";
import { useCategories, useMovies, useSaveMovie, useTags } from "../lib/queries";
import { generateId } from "../lib/id";

export function MoviesPage() {
  const movies = useMovies();
  const categories = useCategories();
  const tags = useTags();
  const saveMovie = useSaveMovie();

  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [streamLink, setStreamLink] = useState("");

  const categoryLookup = useMemo(
    () => new Map((categories.data ?? []).map((item) => [item.id, item.name])),
    [categories.data],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !streamLink.trim() || !categoryId) {
      return;
    }

    await saveMovie.mutateAsync({
      id: generateId("m"),
      title: title.trim(),
      description: "Mô tả đang cập nhật",
      thumbnail: "https://placehold.co/300x200",
      streamLink: streamLink.trim(),
      subtitle: "vi",
      categoryId,
      tagIds: tags.data?.slice(0, 1).map((item) => item.id) ?? [],
      voiceType: "phu-de",
    });

    setTitle("");
    setStreamLink("");
  };

  return (
    <section className="space-y-4">
      <article className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Thêm phim</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={submit}>
          <input
            className="rounded border px-3 py-2"
            placeholder="Tiêu đề"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <input
            className="rounded border px-3 py-2"
            placeholder="Link stream m3u8/hls"
            value={streamLink}
            onChange={(event) => setStreamLink(event.target.value)}
          />
          <select
            className="rounded border px-3 py-2"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Chọn danh mục</option>
            {(categories.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button className="rounded bg-blue-600 px-3 py-2 text-white md:col-span-3" type="submit">
            Lưu phim
          </button>
        </form>
      </article>

      <article className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Danh sách phim</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Tên phim</th>
                <th className="p-2">Danh mục</th>
                <th className="p-2">Link stream</th>
              </tr>
            </thead>
            <tbody>
              {(movies.data ?? []).map((movie) => (
                <tr key={movie.id} className="border-b">
                  <td className="p-2">{movie.title}</td>
                  <td className="p-2">{categoryLookup.get(movie.categoryId) ?? "-"}</td>
                  <td className="p-2">{movie.streamLink}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
