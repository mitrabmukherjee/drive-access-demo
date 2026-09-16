"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function roleLabel(role) {
  return role === "writer" ? "Editor" : "Viewer";
}

export default function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [live, setLive] = useState("connecting");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [assignDraft, setAssignDraft] = useState({});
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/files");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load files");
      return;
    }
    setData(json);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setLive("live");
    es.onerror = () => setLive("reconnecting");
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === "assignment") load();
      } catch {
        // ignore malformed frames
      }
    };
    return () => {
      es.close();
      setLive("off");
    };
  }, [load]);

  async function addFile(e) {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not add file");
      setUrl("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function assign(fileId) {
    const draft = assignDraft[fileId] ?? {};
    const email = String(draft.email ?? "").trim();
    const role = draft.role === "writer" ? "writer" : "reader";
    setBusyId(fileId);
    setError("");
    try {
      const res = await fetch(`/api/files/${fileId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not assign");
      setAssignDraft((prev) => ({ ...prev, [fileId]: { email: "", role: "reader" } }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function unassign(fileId, email) {
    setBusyId(`${fileId}:${email}`);
    setError("");
    try {
      const res = await fetch(`/api/files/${fileId}/assign`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not unassign");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <GoogleMark />
            <div>
              <p className="text-sm font-semibold">Drive access demo</p>
              <p className="text-xs text-zinc-500">
                @steorasystems.com
                <span
                  className={`ml-2 ${
                    live === "live" ? "text-emerald-600" : "text-zinc-400"
                  }`}
                >
                  {live === "live" ? "Live" : live === "reconnecting" ? "Reconnecting" : "Connecting"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="h-8 w-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-zinc-500">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        {data && !data.hasDriveToken ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            Drive refresh token is missing. Sign out and sign in again, and accept Google
            Drive access so this app can share files as you.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold">Add a file you own</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Paste a Restricted Drive / Docs link. On assign, Google will share it with
            that person using <em>your</em> Drive permission.
          </p>
          <form onSubmit={addFile} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="submit"
              disabled={adding}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {adding ? "Adding…" : "Add file"}
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Files I own
          </h2>
          {!data ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : data.owned.length === 0 ? (
            <p className="text-sm text-zinc-500">No files yet.</p>
          ) : (
            data.owned.map((file) => {
              const draft = assignDraft[file.id] ?? { email: "", role: "reader" };
              return (
                <article
                  key={file.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{file.title || file.driveFileId}</p>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Open in Drive
                      </a>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1">
                    {file.assignments.length === 0 ? (
                      <li className="text-sm text-zinc-500">Nobody assigned yet.</li>
                    ) : (
                      file.assignments.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950"
                        >
                          <span>
                            {a.assigneeEmail}{" "}
                            <span className="text-zinc-500">
                              ({roleLabel(a.role)})
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={busyId === `${file.id}:${a.assigneeEmail}`}
                            onClick={() => unassign(file.id, a.assigneeEmail)}
                            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                          >
                            Unassign
                          </button>
                        </li>
                      ))
                    )}
                  </ul>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={draft.email}
                      onChange={(e) =>
                        setAssignDraft((prev) => ({
                          ...prev,
                          [file.id]: { ...draft, email: e.target.value },
                        }))
                      }
                      placeholder="colleague@steorasystems.com"
                      className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                    />
                    <select
                      value={draft.role}
                      onChange={(e) =>
                        setAssignDraft((prev) => ({
                          ...prev,
                          [file.id]: { ...draft, role: e.target.value },
                        }))
                      }
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      <option value="reader">Viewer</option>
                      <option value="writer">Editor</option>
                    </select>
                    <button
                      type="button"
                      disabled={busyId === file.id}
                      onClick={() => assign(file.id)}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {busyId === file.id ? "Sharing…" : "Assign"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Assigned to me
          </h2>
          {!data ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : data.assignedToMe.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing assigned to you yet.</p>
          ) : (
            data.assignedToMe.map((file) => (
              <article
                key={file.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="font-medium">{file.title || file.driveFileId}</p>
                <p className="text-xs text-zinc-500">
                  Owner: {file.owner?.name || file.owner?.email}
                </p>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                >
                  Open in Drive
                </a>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
