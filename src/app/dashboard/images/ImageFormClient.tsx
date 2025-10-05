// src/app/dashboard/images/ImageFormClient.tsx
"use client";

import { useFormStatus } from "react-dom";
import Dropzone from "../Dropzone";
import ToggleChip from "../ToggleChip";
import { duplicateImages } from "../actions";

function SubmitWithProgress() {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg px-4 py-2 text-white transition ${
          pending ? "bg-gray-500 cursor-not-allowed" : "bg-fuchsia-600 hover:bg-fuchsia-500"
        }`}
      >
        {pending ? "Duplication en cours…" : "Dupliquer les images"}
      </button>

      {pending && (
        <div className="w-full bg-white/10 rounded-full h-2.5 mt-3 overflow-hidden">
          <div className="h-2.5 w-3/4 rounded-full animate-pulse bg-fuchsia-500" />
        </div>
      )}
    </>
  );
}

export default function ImageFormClient() {
  return (
    <form action={duplicateImages} className="space-y-6">
      <Dropzone name="files" accept="image/*" multiple maxFiles={25} />

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-white/90">Filtres</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ToggleChip name="fundamentals" value="1" label="Filtres fondamentaux" hint="taille, recompression, EXIF…" defaultChecked />
          <ToggleChip name="visuals" value="1" label="Filtres visuels" hint="luminosité, saturation, gamma, micro-bruit…" defaultChecked />
        </div>
      </fieldset>

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

      <SubmitWithProgress />
    </form>
  );
}