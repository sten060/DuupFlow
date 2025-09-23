// src/app/dashboard/page.tsx
import path from "path";
import fs from "fs/promises";
import Link from "next/link";

// ⚙️ Nos Server Actions (déjà créées dans src/app/dashboard/actions.ts)
import { duplicate, deleteAll } from "./actions";

// 👉 Wrappers "use server" pour que <form action={...}> ait bien un type Promise<void>
async function handleDuplicate(formData: FormData) {
  "use server";
  // On délègue à la vraie action (qui retourne { files: string[] })
  await duplicate(formData);
}

async function handleDeleteAll() {
  "use server";
  await deleteAll();
}

// 🗂️ Lit les fichiers sortis dans /public/out (côté serveur)
async function getFiles(): Promise<string[]> {
  try {
    const OUT_DIR = path.join(process.cwd(), "public", "out");
    const entries = await fs.readdir(OUT_DIR);
    // On ne liste que quelques extensions courantes
    return entries
      .filter((n) =>
        [".mp4", ".mov", ".m4v", ".jpg", ".jpeg", ".png", ".webp"].some((ext) =>
          n.toLowerCase().endsWith(ext)
        )
      )
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const files = await getFiles();

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <h1 className="text-3xl font-bold">Content Duplicator</h1>

      {/* Barre d’actions */}
      <div className="flex gap-3">
        <Link
          href="/api/out/zip"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Télécharger tout (.zip)
        </Link>

        <form action={handleDeleteAll}>
          <button
            type="submit"
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Tout effacer
          </button>
        </form>
      </div>

      {/* Formulaire de duplication (upload + nombre) */}
      <form
        action={handleDuplicate}
        className="grid gap-4 max-w-xl"
        encType="multipart/form-data"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Choisir un fichier</label>
          <input
            type="file"
            name="file"
            required
            className="block w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre de duplications
          </label>
          <input
            type="number"
            name="count"
            min={1}
            defaultValue={3}
            className="block w-40 rounded border p-2"
          />
        </div>

        <button
          type="submit"
          className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          Dupliquer
        </button>
      </form>

      {/* Liste des fichiers générés */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Fichiers générés</h2>
        {files.length === 0 ? (
          <p className="text-sm text-neutral-500">Aucun fichier généré pour l’instant.</p>
        ) : (
          <ul className="list-disc pl-5 space-y-1">
            {files.map((f) => (
              <li key={f}>
                <Link
                  href={`/out/${encodeURIComponent(f)}`}
                  className="text-blue-600 hover:underline"
                >
                  {f}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
