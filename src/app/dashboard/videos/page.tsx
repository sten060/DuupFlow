import Link from "next/link";
import { duplicateVideo, clearOut, listOutVideos } from "../actions";
import ProgressSubmit from "../ProgressSubmit";
import ToggleChip from "../ToggleChip";
import path from "path";

export default async function VideosPage() {
  const files = await listOutVideos();

  return (
    <main className="p-6 space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Duplication Vidéos
      </h1>

      {/* Carte formulaire */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-indigo-950/40 p-6 shadow-2xl shadow-indigo-950/20">
        <form action={duplicateVideo} className="space-y-6">
          {/* fichier */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Choisir une vidéo</label>
            <input
              type="file"
              name="file"
              accept="video/*"
              required
              className="block w-full rounded-lg border border-white/15 bg-white/5 text-white/80 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-white hover:file:bg-indigo-500"
            />
          </div>

          {/* nombre */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Nombre de copies</label>
            <input
              type="number"
              name="count"
              min={1}
              defaultValue={1}
              className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90"
            />
          </div>

          {/* filtres : chips */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-white/90">Filtres à appliquer</legend>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ToggleChip name="filters" value="saturation" label="Saturation" hint="±3% aléatoire" />
              <ToggleChip name="filters" value="contrast"   label="Contraste"  hint="±3% aléatoire" />
              <ToggleChip name="filters" value="gamma"      label="Gamma"      hint="±3% aléatoire" />
              <ToggleChip name="filters" value="brightness" label="Luminosité" hint="±3% aléatoire" />
              <ToggleChip name="filters" value="hue"        label="Teinte (Hue)" hint="±0.03 rad" />

              <ToggleChip name="filters" value="bitrate" label="Débit vidéo (100–2000 kb/s)" />
              <ToggleChip name="filters" value="gop"     label="GOP (50–100)" />
              <ToggleChip name="filters" value="fps"     label="i/s (24.1–25.9)" />
              <ToggleChip name="filters" value="profile" label="Profil/Level (H.264)" />
            </div>
          </fieldset>

          <ProgressSubmit>Dupliquer</ProgressSubmit>
        </form>

        {/* bouton vider */}
        <form action={clearOut} className="mt-4">
          <button
            type="submit"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Vider les vidéos
          </button>
        </form>
      </section>

      {/* Liste des vidéos générées */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold mb-3">Vidéos générées</h2>
        {files.length === 0 ? (
          <p className="text-sm text-white/50">Aucune vidéo pour l’instant.</p>
        ) : (
          <ul className="list-disc pl-6 space-y-1">
            {files.map((n) => (
              <li key={n}>
                <Link href={n} className="underline" prefetch={false}>
                  {decodeURIComponent(path.basename(n))}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}