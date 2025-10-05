// src/app/dashboard/videos/VideoFormClient.tsx
"use client";

import { useFormStatus } from "react-dom";
import Dropzone from "../Dropzone";
import ToggleChip from "../ToggleChip";
import { duplicateVideos } from "../actions";

function SubmitWithProgress() {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg px-4 py-2 text-white transition ${
          pending ? "bg-gray-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500"
        }`}
      >
        {pending ? "Duplication en cours…" : "Dupliquer les vidéos"}
      </button>

      {pending && (
        <div className="w-full bg-white/10 rounded-full h-2.5 mt-3 overflow-hidden">
          <div className="h-2.5 w-3/4 rounded-full animate-pulse bg-indigo-500" />
        </div>
      )}
    </>
  );
}

export default function VideoFormClient() {
  return (
    <form action={duplicateVideos} className="space-y-6">
      <Dropzone name="files" accept="video/*" multiple maxFiles={25} />

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

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-white/90">Filtres à appliquer</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ToggleChip name="filters" value="saturation" label="Saturation" hint="±3% aléatoire" />
          <ToggleChip name="filters" value="contrast"   label="Contraste"  hint="±3% aléatoire" />
          <ToggleChip name="filters" value="gamma"      label="Gamma"      hint="±3% aléatoire" />
          <ToggleChip name="filters" value="brightness" label="Luminosité" hint="±3% aléatoire" />
          <ToggleChip name="filters" value="hue"        label="Teinte (Hue)" hint="±0.03 rad" />
          <ToggleChip name="filters" value="bitrate"    label="Débit vidéo (100–2000 kb/s)" />
          <ToggleChip name="filters" value="gop"        label="GOP (50–100)" />
          <ToggleChip name="filters" value="fps"        label="i/s (24.1–25.9)" />
          <ToggleChip name="filters" value="profile"    label="Profil/Level (H.264)" />
        </div>
      </fieldset>

      <SubmitWithProgress />
    </form>
  );
}