import { FormEvent, useState } from "react";
import { useCategories, useSaveCategory, useSaveTag, useTags } from "../lib/queries";
import { generateId } from "../lib/id";

export function CategoriesPage() {
  const categories = useCategories();
  const tags = useTags();
  const saveCategory = useSaveCategory();
  const saveTag = useSaveTag();
  const [categoryName, setCategoryName] = useState("");
  const [tagName, setTagName] = useState("");

  const submitCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim()) {
      return;
    }

    await saveCategory.mutateAsync({ id: generateId("c"), name: categoryName.trim() });
    setCategoryName("");
  };

  const submitTag = async (event: FormEvent) => {
    event.preventDefault();
    if (!tagName.trim()) {
      return;
    }

    await saveTag.mutateAsync({ id: generateId("t"), name: tagName.trim() });
    setTagName("");
  };

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <article className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Quản lý danh mục</h2>
        <form className="mt-3 flex gap-2" onSubmit={submitCategory}>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Tên danh mục"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
          />
          <button className="rounded bg-blue-600 px-3 py-2 text-white" type="submit">
            Thêm
          </button>
        </form>
        <ul className="mt-3 space-y-2 text-sm">
          {(categories.data ?? []).map((item) => (
            <li key={item.id} className="rounded bg-slate-50 px-3 py-2">
              {item.name}
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Quản lý tag</h2>
        <form className="mt-3 flex gap-2" onSubmit={submitTag}>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Tên tag"
            value={tagName}
            onChange={(event) => setTagName(event.target.value)}
          />
          <button className="rounded bg-blue-600 px-3 py-2 text-white" type="submit">
            Thêm
          </button>
        </form>
        <ul className="mt-3 space-y-2 text-sm">
          {(tags.data ?? []).map((item) => (
            <li key={item.id} className="rounded bg-slate-50 px-3 py-2">
              {item.name}
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
