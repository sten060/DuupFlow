/**
 * Transactional emails for DuupFlow.
 * Sent directly via Brevo SMTP API — no automation setup required.
 *
 * Emails:
 *  1. Welcome         → on signup (onboarding complete)
 *  2. Payment success → on Stripe payment verified
 *  3. Relance J+1     → daily cron for free users who haven't paid after 24h
 */

import { sendBrevoEmail } from "@/lib/brevo";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://duupflow.com";

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DuupFlow</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111118;border:1px solid rgba(99,102,241,0.2);border-radius:16px;overflow:hidden;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(99,102,241,0.1);">
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Duup<span style="color:#6366f1;">Flow</span></span>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px;">${content}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(99,102,241,0.1);text-align:center;">
            <p style="margin:0;font-size:12px;color:#555566;">
              © ${new Date().getFullYear()} DuupFlow · <a href="${BASE_URL}" style="color:#6366f1;text-decoration:none;">duupflow.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:13px 28px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${text}</a>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#c8c8d8;">${text}</p>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${text}</h1>`;
}

// ─── Email 1 : Welcome (signup) ───────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, firstName: string) {
  const name = firstName || "là";
  await sendBrevoEmail({
    to: email,
    toName: firstName,
    subject: "Bienvenue chez DuupFlow 👋",
    htmlContent: layout(`
      ${h1(`Bienvenue ${name} !`)}
      ${p("Ton compte DuupFlow est prêt. Tu peux maintenant dupliquer du contenu entre plateformes en quelques secondes.")}
      ${p("Connecte tes plateformes, crée ton premier flux et gagne du temps dès aujourd'hui.")}
      ${btn("Accéder à mon espace", `${BASE_URL}/dashboard`)}
    `),
  });
}

// ─── Email 2 : Payment success ────────────────────────────────────────────────

export async function sendPaymentEmail(email: string, firstName: string) {
  const name = firstName || "là";
  await sendBrevoEmail({
    to: email,
    toName: firstName,
    subject: "Ton compte DuupFlow est actif ✅",
    htmlContent: layout(`
      ${h1(`C'est parti ${name} !`)}
      ${p("Ton paiement est confirmé — ton accès DuupFlow est maintenant actif.")}
      ${p("Tu peux créer autant de flux que tu veux et dupliquer ton contenu sur toutes tes plateformes connectées.")}
      ${p("Si tu as la moindre question, réponds directement à cet email — on est là.")}
      ${btn("Accéder à mon dashboard", `${BASE_URL}/dashboard`)}
    `),
  });
}

// ─── Email 3 : Relance J+1 (free users who haven't paid) ─────────────────────

export async function sendRelanceEmail(email: string, firstName: string) {
  const name = firstName || "là";
  await sendBrevoEmail({
    to: email,
    toName: firstName,
    subject: "Tu n'as pas encore lancé ton premier flux 👀",
    htmlContent: layout(`
      ${h1(`${name}, tu passes à côté de quelque chose.`)}
      ${p("Tu t'es inscrit hier sur DuupFlow mais tu n'as pas encore franchi le pas.")}
      ${p("En moins de 2 minutes, tu peux dupliquer ton contenu sur toutes tes plateformes automatiquement — sans copier-coller, sans prise de tête.")}
      ${p("Des dizaines d'agences l'utilisent déjà pour gagner plusieurs heures par semaine.")}
      ${btn("Voir les offres", `${BASE_URL}/checkout`)}
    `),
  });
}
