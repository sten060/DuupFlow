import Link from "next/link";
import { duplicateImage, listOutImages } from "../actions";
import { SubmitButton } from "../FormPending";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ImagesPage() {
  const files = await listOutImages();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Duplication Images</h1>

      <form action={duplicateImage} className="grid gap-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium mb-1 text-white">
            Choisir une image
          </label>
          <input
            type="file"
            name="file"
            accept="image/*"
            required
            className="block w-full text-sm text-gray-300
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-md file:border-0
                       file:text-sm file:font-semibold
                       file:bg-indigo-600 file:text-white
                       hover:file:bg-indigo-700
                       border border-gray-500 rounded-md px-2 py-2
                       cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-white">
            Nombre de copies
          </label>
          <input
            type="number"
            name="count"
            min={1}
            defaultValue={1}
            className="block w-full text-white bg-transparent border border-gray-500 rounded-md px-2 py-1"
          />
        </div>

        <SubmitButton>Dupliquer</SubmitButton>
      </form>
      
      <section className="mt-6">
        <h2 className="font-semibold mb-2">Images générées</h2>
        {files.length === 0 ? (
          <p className="text-sm opacity-70">Aucune image pour l’instant.</p>
        ) : (
          <ul className="list-disc pl-5 space-y-1">
            {files.map((n) => (
              <li key={n}>
                <Link href={`/out/${encodeURIComponent(n)}`} className="underline" prefetch={false}>
                  {n}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="mt-4">
  <a
    href="/api/out/zip?type=images"
    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
  >
    Télécharger toutes les images (ZIP)
  </a>
</div>
    </div>

  );
}