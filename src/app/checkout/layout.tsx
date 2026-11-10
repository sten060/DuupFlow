// Layout racine de l'application (hors pages publiques) — voir src/app/RootShell.tsx.
import RootShell, { appMetadata } from "@/app/RootShell";

export const metadata = appMetadata;

export default function AppRootLayout({ children }: { children: React.ReactNode }) {
  return <RootShell lang="en">{children}</RootShell>;
}
