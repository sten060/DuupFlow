import { redirect } from "next/navigation";

// The tokens module was merged into the unified "Plan & token" page
// (/dashboard/abonnement). Keep this route as a permanent redirect so old
// bookmarks and any in-flight Stripe return links still resolve.
export default function TokensPage() {
  redirect("/dashboard/abonnement");
}
