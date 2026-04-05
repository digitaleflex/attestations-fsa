/**
 * Direct Resend API test - uses the real key from .env
 */
import * as fs from "fs";
import * as path from "path";

// Parse .env manually
const envPath = path.join(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const resendKeyMatch = envContent.match(/^RESEND_API_KEY=(.+)$/m);
const RESEND_API_KEY = resendKeyMatch ? resendKeyMatch[1].trim().replace(/"/g, "") : "";

const TEST_EMAIL = "eflexcloud@gmail.com";
const OTP = Math.floor(100000 + Math.random() * 900000).toString();

async function main() {
  if (!RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY not found in .env");
    process.exit(1);
  }

  console.log("🧪 Direct Resend API Test");
  console.log(`🔑 Key: ${RESEND_API_KEY.substring(0, 10)}***`);
  console.log(`📧 To: ${TEST_EMAIL}`);
  console.log(`🔢 OTP: ${OTP}`);
  console.log("");

  const body = JSON.stringify({
    from: "Ferme St André <contact@net.eurinhash.com>",
    to: [TEST_EMAIL],
    subject: `🔐 Votre code de vérification : ${OTP}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; padding: 40px 20px;">
          <tr><td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.08);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); padding: 40px 32px; text-align: center;">
                  <div style="margin-bottom: 16px;">
                    <img src="https://fsa.eurinhash.com/logo-fsa.png" alt="FSA" style="width: 80px; height: 80px; border-radius: 16px; background: rgba(255,255,255,0.15); padding: 8px;" />
                  </div>
                  <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">🔐 Réinitialisation du mot de passe</h1>
                  <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">Ferme Agro-Piscicole Cité St André</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 32px;">
                  <p style="margin: 0 0 24px 0; font-size: 16px; color: #475569; line-height: 1.6;">Bonjour <strong style="color: #0f172a;">Utilisateur Test</strong>,</p>
                  <p style="margin: 0 0 32px 0; font-size: 15px; color: #64748b; line-height: 1.7;">Nous avons reçu une demande de réinitialisation de votre mot de passe. Utilisez le code ci-dessous pour finaliser l'opération :</p>
                  <!-- OTP Box -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 32px 0;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 16px; padding: 32px; text-align: center; border: 2px solid #6ee7b7;">
                        <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 600; color: #065f46; text-transform: uppercase; letter-spacing: 2px;">Votre code de vérification</p>
                        <p style="margin: 0; font-size: 56px; font-weight: 900; color: #059669; letter-spacing: 12px; font-family: 'Courier New', Courier, monospace;">${OTP}</p>
                      </td>
                    </tr>
                  </table>
                  <!-- Timer -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 12px; padding: 16px 20px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #92400e;">⏱️ Temps limité : 10 minutes</p>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #a16207;">Ce code expirera automatiquement après ce délai pour votre sécurité.</p>
                      </td>
                    </tr>
                  </table>
                  <!-- Security -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background-color: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
                        <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #334155;">🛡️ Conseils de sécurité :</p>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #64748b; line-height: 1.8;">
                          <li>Ne partagez <strong style="color: #1e293b;">jamais</strong> ce code avec quiconque</li>
                          <li>Notre équipe ne vous demandera <strong style="color: #1e293b;">jamais</strong> ce code par téléphone ou email</li>
                          <li>Si vous n'avez pas fait cette demande, <strong style="color: #1e293b;">ignorez simplement cet email</strong></li>
                        </ul>
                      </td>
                    </tr>
                  </table>
                  <!-- CTA -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0 0 0;">
                    <tr>
                      <td style="text-align: center;">
                        <a href="https://verifier.fermestandre.com/reset-password" target="_blank" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 12px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">Accéder à la page de réinitialisation →</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 24px 0 0 0; font-size: 14px; color: #94a3b8; text-align: center;">Cordialement,<br><strong style="color: #64748b;">L'équipe Ferme St André</strong></p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 0 32px;"><div style="height: 1px; background-color: #e2e8f0;"></div></td>
              </tr>
              <tr>
                <td style="padding: 24px 32px; text-align: center;">
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">Cet email a été envoyé à <strong style="color: #64748b;">${TEST_EMAIL}</strong></p>
                  <p style="margin: 0; font-size: 11px; color: #cbd5e1;">© ${new Date().getFullYear()} Ferme Agro-Piscicole Cité St André • Abomey-Calavi, Bénin</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body,
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Email envoyé avec succès !");
      console.log(`📬 ID Resend: ${data.id}`);

      // Log to otp-store
      try {
        const { logOTP } = await import("./lib/otp-store");
        logOTP(TEST_EMAIL, OTP, "forget-password");
        console.log("📝 OTP logged to admin store");
      } catch {}

      console.log("📧 Vérifie ta boîte de réception (et les spams)");
    } else {
      console.log("❌ Échec de l'envoi");
      console.log(`📡 Status: ${response.status}`);
      console.log("📄 Response:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("💥 Erreur réseau:", error);
  }
}

main();
