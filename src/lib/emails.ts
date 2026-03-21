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

function layout(previewText: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>DuupFlow</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#09090f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090f;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">

        <!-- Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px;background-color:#0f0f1a;border:1px solid #1e1e35;border-radius:20px;overflow:hidden;">

          <!-- Header gradient bar -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Logo area -->
          <tr>
            <td style="padding:36px 48px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:18px;font-weight:800;line-height:36px;display:block;">D</span>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;">Duup<span style="color:#818cf8;">Flow</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background:linear-gradient(to right,#1e1e35,#2d2d50,#1e1e35);font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding:40px 48px 48px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 48px 36px;">
              <div style="height:1px;background:linear-gradient(to right,#1e1e35,#2d2d50,#1e1e35);font-size:0;line-height:0;margin-bottom:28px;">&nbsp;</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:12px;color:#3d3d5c;line-height:1.8;">
                      Tu reçois cet email car tu as créé un compte sur <a href="${BASE_URL}" style="color:#6366f1;text-decoration:none;">DuupFlow</a>.<br/>
                      © ${new Date().getFullYear()} DuupFlow — Tous droits réservés.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- / Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Email 1 : Welcome (signup) ───────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, firstName: string) {
  const name = firstName || "là";

  const content = `
    <!-- Greeting -->
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.6px;line-height:1.2;">
      Bienvenue sur DuupFlow, ${name} 👋
    </h1>
    <p style="margin:0 0 32px;font-size:16px;color:#6b6b8f;line-height:1.7;">
      Ton compte est prêt. Tu peux dès maintenant dupliquer ton contenu entre toutes tes plateformes, automatiquement.
    </p>

    <!-- Steps -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">

      <tr>
        <td style="padding-bottom:16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#13131f;border:1px solid #1e1e35;border-radius:12px;width:100%;">
            <tr>
              <td style="padding:18px 20px;vertical-align:top;width:40px;">
                <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:8px;width:32px;height:32px;text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#ffffff;">1</div>
              </td>
              <td style="padding:18px 20px 18px 4px;vertical-align:middle;">
                <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#e2e2f0;">Connecte tes plateformes</p>
                <p style="margin:0;font-size:13px;color:#6b6b8f;line-height:1.5;">Instagram, TikTok, YouTube, LinkedIn — tout en un endroit.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding-bottom:16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#13131f;border:1px solid #1e1e35;border-radius:12px;width:100%;">
            <tr>
              <td style="padding:18px 20px;vertical-align:top;width:40px;">
                <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:8px;width:32px;height:32px;text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#ffffff;">2</div>
              </td>
              <td style="padding:18px 20px 18px 4px;vertical-align:middle;">
                <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#e2e2f0;">Crée ton premier flux</p>
                <p style="margin:0;font-size:13px;color:#6b6b8f;line-height:1.5;">Choisis une source et les destinations. C'est tout.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td>
          <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#13131f;border:1px solid #1e1e35;border-radius:12px;width:100%;">
            <tr>
              <td style="padding:18px 20px;vertical-align:top;width:40px;">
                <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:8px;width:32px;height:32px;text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#ffffff;">3</div>
              </td>
              <td style="padding:18px 20px 18px 4px;vertical-align:middle;">
                <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#e2e2f0;">Gagne du temps, chaque semaine</p>
                <p style="margin:0;font-size:13px;color:#6b6b8f;line-height:1.5;">Ton contenu se duplique automatiquement. Zéro copier-coller.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:10px;">
          <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
            Accéder à mon espace →
          </a>
        </td>
      </tr>
    </table>

    <!-- Sign off -->
    <p style="margin:36px 0 0;font-size:14px;color:#6b6b8f;line-height:1.7;">
      Une question ? Réponds directement à cet email — on te répond sous 24h.<br/>
      <span style="color:#4d4d6b;">— L'équipe DuupFlow</span>
    </p>
  `;

  await sendBrevoEmail({
    to: email,
    toName: firstName,
    subject: `Bienvenue sur DuupFlow, ${name} 🎉`,
    htmlContent: layout("Ton compte est prêt. Découvre comment dupliquer ton contenu en quelques secondes.", content),
  });
}

// ─── Email 2 : Payment success ────────────────────────────────────────────────

export async function sendPaymentEmail(email: string, firstName: string) {
  const name = firstName || "là";

  const content = `
    <!-- Badge -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:#0d2d1a;border:1px solid #1a4a2e;border-radius:20px;padding:6px 14px;">
          <span style="font-size:12px;font-weight:600;color:#34d399;letter-spacing:0.3px;">✦ &nbsp;ACCÈS ACTIVÉ</span>
        </td>
      </tr>
    </table>

    <!-- Greeting -->
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.6px;line-height:1.2;">
      C'est confirmé, ${name} !
    </h1>
    <p style="margin:0 0 32px;font-size:16px;color:#6b6b8f;line-height:1.7;">
      Ton paiement a bien été reçu. Ton accès DuupFlow est maintenant pleinement actif — profite de toutes les fonctionnalités sans limite.
    </p>

    <!-- What's included -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d1a0d;border:1px solid #1a3320;border-radius:14px;margin-bottom:32px;">
      <tr>
        <td style="padding:24px 28px;">
          <p style="margin:0 0 18px;font-size:13px;font-weight:600;color:#6b6b8f;letter-spacing:0.8px;text-transform:uppercase;">Ce qui est inclus</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:7px 0;font-size:14px;color:#d1fae5;line-height:1.5;"><span style="color:#34d399;margin-right:10px;">✓</span>Duplication automatique sur toutes tes plateformes</td></tr>
            <tr><td style="padding:7px 0;font-size:14px;color:#d1fae5;line-height:1.5;"><span style="color:#34d399;margin-right:10px;">✓</span>Flux illimités, publications illimitées</td></tr>
            <tr><td style="padding:7px 0;font-size:14px;color:#d1fae5;line-height:1.5;"><span style="color:#34d399;margin-right:10px;">✓</span>Support prioritaire par email</td></tr>
            <tr><td style="padding:7px 0;font-size:14px;color:#d1fae5;line-height:1.5;"><span style="color:#34d399;margin-right:10px;">✓</span>Accès aux nouvelles fonctionnalités en avant-première</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:10px;">
          <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
            Accéder à mon dashboard →
          </a>
        </td>
      </tr>
    </table>

    <!-- Sign off -->
    <p style="margin:36px 0 0;font-size:14px;color:#6b6b8f;line-height:1.7;">
      Merci de nous faire confiance. Si tu as la moindre question ou besoin d'aide pour bien démarrer, réponds directement à cet email.<br/>
      <span style="color:#4d4d6b;">— L'équipe DuupFlow</span>
    </p>
  `;

  await sendBrevoEmail({
    to: email,
    toName: firstName,
    subject: `Ton accès DuupFlow est actif, ${name} ✨`,
    htmlContent: layout("Ton paiement est confirmé. Bienvenue dans l'aventure DuupFlow.", content),
  });
}

// ─── Email 3 : Relance J+1 (free users who haven't paid) ─────────────────────

export async function sendRelanceEmail(email: string, firstName: string) {
  const name = firstName || "là";

  const content = `
    <!-- Greeting -->
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.6px;line-height:1.2;">
      ${name}, tu passes à côté de quelque chose.
    </h1>
    <p style="margin:0 0 32px;font-size:16px;color:#6b6b8f;line-height:1.7;">
      Tu t'es inscrit sur DuupFlow hier, mais tu n'as pas encore activé ton accès. On voulait juste te rappeler ce que tu peux gagner.
    </p>

    <!-- Value props -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">

      <tr>
        <td style="padding-bottom:12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#13131f;border:1px solid #1e1e35;border-radius:12px;">
            <tr>
              <td style="padding:18px 22px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#e2e2f0;">⏱ &nbsp;2 heures gagnées par semaine</p>
                <p style="margin:0;font-size:13px;color:#6b6b8f;line-height:1.5;">Fini le copier-coller entre plateformes. DuupFlow s'en charge à ta place.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding-bottom:12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#13131f;border:1px solid #1e1e35;border-radius:12px;">
            <tr>
              <td style="padding:18px 22px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#e2e2f0;">🔗 &nbsp;Toutes tes plateformes synchronisées</p>
                <p style="margin:0;font-size:13px;color:#6b6b8f;line-height:1.5;">Un seul endroit pour gérer Instagram, TikTok, YouTube et plus encore.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#13131f;border:1px solid #1e1e35;border-radius:12px;">
            <tr>
              <td style="padding:18px 22px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#e2e2f0;">🚀 &nbsp;Actif en moins de 2 minutes</p>
                <p style="margin:0;font-size:13px;color:#6b6b8f;line-height:1.5;">Connecte tes comptes, crée ton flux, et c'est tout. Vraiment.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:10px;">
          <a href="${BASE_URL}/checkout" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
            Activer mon accès →
          </a>
        </td>
      </tr>
    </table>

    <!-- Sign off -->
    <p style="margin:36px 0 0;font-size:14px;color:#6b6b8f;line-height:1.7;">
      Tu as une question avant de te lancer ? Réponds à cet email, on t'explique tout en quelques minutes.<br/>
      <span style="color:#4d4d6b;">— L'équipe DuupFlow</span>
    </p>
  `;

  await sendBrevoEmail({
    to: email,
    toName: firstName,
    subject: `${name}, tu n'as pas encore activé ton accès 👀`,
    htmlContent: layout("Découvre ce que tu peux gagner avec DuupFlow en moins de 2 minutes.", content),
  });
}
