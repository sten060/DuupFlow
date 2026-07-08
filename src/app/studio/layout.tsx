import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./studio.css";

// Police du studio — Inter 300/400/500 comme sur les maquettes.
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500"] });

export const metadata: Metadata = {
  title: "Studio — DuupFlow",
  description:
    "Génère plusieurs variantes de reels prêtes à publier à partir de ton contenu brut.",
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${inter.className} studio`}>{children}</div>;
}
