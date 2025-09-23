// src/app/dashboard/page.tsx
import path from "path";
import fs from "fs/promises";
import Link from "next/link";
import { duplicate, deleteAll } from "./actions";

const OUT_DIR = path.join(process.cwd(), "public", "out");

export default async function DashboardPage() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = (await fs.readdir(OUT_DIR))
    .filter((f) => !f.startsWith("."))
    .sort((a, b) => a.localeCompare(b));

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Content Duplicator</h1>

      {/* Formulaire de duplication (upload + nombre) */}
      <form action={duplicate} className="grid gap-4 max-w-xl" encType="multipart/form-data">
        <div>
          <label className="block text-sm font-medium mb-1">Choisir un fichier</label>
          <input type="file" name="file" required className="block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nombre de duplications</label>
          <input
            type="number"
            name="count"
            min={1}
            defaultValue={3}
            className="block w-32"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-indigo-600 text-white py-2 font-semibold"
        >
          Dupliquer
        </button>
      </form>

      {/* Boutons d’actions globales */}
      <div className="flex gap-3">
        <a
          href="/api/out/zip"
          className="rounded-md bg-blue-600 text-white px-4 py-2 font-semibold"
        >
          Télécharger tout (.zip)
        </a>

        <form
          action={async () => {
            "use server";
            await deleteAll();
          }}
        >
          <button
            type="submit"
            className="rounded-md bg-red-600 text-white px-4 py-2 font-semibold"
          >
            Tout effacer
          </button>
        </form>
      </div>

      {/* Liste des fichiers générés */}
      <section className="space-y-2">
        {files.length === 0 ? (
          <p className="text-gray-500">Aucun fichier généré pour l’instant.</p>
        ) : (
          files.map((file) => (
            <div key={file}>
              <Link href={`/out/${file}`} className="text-blue-500 hover:underline">
                {file}
              </Link>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
