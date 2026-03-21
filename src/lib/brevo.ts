/**
 * Brevo contact & list management.
 *
 * Required env vars:
 *   BREVO_API_KEY
 *   BREVO_LIST_FREE_USERS      (integer list ID)
 *   BREVO_LIST_ACTIVE_CLIENTS  (integer list ID)
 *   BREVO_LIST_CHURNED         (integer list ID)
 *
 * Create the three lists in Brevo → Contacts → Lists, then set the IDs above.
 * Attach one Automation workflow to each list:
 *   trigger = "Contact added to list", then schedule the email sequence.
 */

const BASE = "https://api.brevo.com/v3";

function key(): string {
  const k = process.env.BREVO_API_KEY;
  if (!k) throw new Error("BREVO_API_KEY is not set");
  return k;
}

function listIds() {
  return {
    freeUsers:     parseInt(process.env.BREVO_LIST_FREE_USERS      ?? "0"),
    activeClients: parseInt(process.env.BREVO_LIST_ACTIVE_CLIENTS  ?? "0"),
    churned:       parseInt(process.env.BREVO_LIST_CHURNED         ?? "0"),
  };
}

async function post(path: string, body: unknown): Promise<boolean> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": key(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[brevo] POST ${path} →`, res.status, text);
  }
  return res.ok;
}

/** Create or update a Brevo contact with attributes. */
async function upsertContact(
  email: string,
  attributes: Record<string, string | number | boolean> = {}
) {
  await post("/contacts", { email, attributes, updateEnabled: true });
}

async function addToList(email: string, listId: number) {
  if (!listId) return;
  await post(`/contacts/lists/${listId}/contacts/add`, { emails: [email] });
}

async function removeFromList(email: string, listId: number) {
  if (!listId) return;
  await post(`/contacts/lists/${listId}/contacts/remove`, { emails: [email] });
}

// ─── Transactional email ─────────────────────────────────────────────────────

export async function sendBrevoEmail({
  to,
  toName = "",
  subject,
  htmlContent,
}: {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
}): Promise<boolean> {
  return post("/smtp/email", {
    sender: { name: "DuupFlow", email: "hello@duupflow.com" },
    to: [{ email: to, name: toName }],
    subject,
    htmlContent,
  });
}

// ─── Public helpers ──────────────────────────────────────────────────────────

/** Called when a new regular (non-guest) user completes onboarding. */
export async function moveToFreeUser(email: string, firstName = "") {
  const { freeUsers, activeClients, churned } = listIds();
  await upsertContact(email, { FIRSTNAME: firstName, USER_TYPE: "free" });
  await Promise.all([
    removeFromList(email, activeClients),
    removeFromList(email, churned),
  ]);
  await addToList(email, freeUsers);
}

/** Called when a user's Stripe payment succeeds. */
export async function moveToActiveClient(email: string, firstName = "") {
  const { freeUsers, activeClients, churned } = listIds();
  await upsertContact(email, { FIRSTNAME: firstName, USER_TYPE: "active" });
  await Promise.all([
    removeFromList(email, freeUsers),
    removeFromList(email, churned),
  ]);
  await addToList(email, activeClients);
}

/** Called when a user's Stripe subscription is deleted (churned). */
export async function moveToChurned(email: string, firstName = "") {
  const { freeUsers, activeClients, churned } = listIds();
  await upsertContact(email, { FIRSTNAME: firstName, USER_TYPE: "churned" });
  await Promise.all([
    removeFromList(email, freeUsers),
    removeFromList(email, activeClients),
  ]);
  await addToList(email, churned);
}
