// GET /api/v1/me — "whoami" endpoint. Validates the API key and returns the
// authenticated account. Lets a developer confirm their key works before
// calling the real endpoints:
//   curl -H "Authorization: Bearer dflw_live_…" https://duupflow.com/api/v1/me
import { authenticateApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;
  return Response.json({
    user_id: auth.actor.userId,
    plan: auth.actor.plan,
    api_version: "v1",
  });
}
