// Layout racine de la connexion affiliés — voir src/app/RootShell.tsx.
import RootShell, { appMetadata } from "@/app/RootShell";

export const dynamic = "force-dynamic";
export const metadata = appMetadata;

export default function AffiliateLoginLayout({ children }: { children: React.ReactNode }) {
  return <RootShell lang="fr">{children}</RootShell>;
}
