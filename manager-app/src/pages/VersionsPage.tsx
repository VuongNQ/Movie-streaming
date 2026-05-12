import { FormEvent, useState } from "react";
import { useSaveVersionPolicy, useVersionPolicy } from "../lib/queries";

export function VersionsPage() {
  const versionPolicy = useVersionPolicy();
  const saveVersionPolicy = useSaveVersionPolicy();
  const [latestVersion, setLatestVersion] = useState("");
  const [forceVersion, setForceVersion] = useState("");
  const [highlightMessage, setHighlightMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await saveVersionPolicy.mutateAsync({
      latestVersion: latestVersion || versionPolicy.data?.latestVersion || "",
      forceVersion: forceVersion || versionPolicy.data?.forceVersion || "",
      highlightMessage: highlightMessage || versionPolicy.data?.highlightMessage || "",
    });
    setLatestVersion("");
    setForceVersion("");
    setHighlightMessage("");
  };

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Quản lý phiên bản Android</h2>
      <p className="mt-2 text-sm text-slate-600">
        Phiên bản hiện tại: {versionPolicy.data?.latestVersion ?? "-"} | Force update: {versionPolicy.data?.forceVersion ?? "-"}
      </p>
      <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={submit}>
        <input
          className="rounded border px-3 py-2"
          placeholder="Latest version"
          value={latestVersion}
          onChange={(event) => setLatestVersion(event.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="Force version"
          value={forceVersion}
          onChange={(event) => setForceVersion(event.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="Thông báo highlight"
          value={highlightMessage}
          onChange={(event) => setHighlightMessage(event.target.value)}
        />
        <button className="rounded bg-blue-600 px-3 py-2 text-white md:col-span-3" type="submit">
          Cập nhật chính sách phiên bản
        </button>
      </form>
    </section>
  );
}
