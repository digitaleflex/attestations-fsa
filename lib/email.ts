import { Resend } from "resend";

// Initialisation paresseuse pour éviter les erreurs lors du build (si la clé API est absente)
let resendInstance: Resend | null = null;

const getResend = () => {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        "[EMAIL_SERVICE] RESEND_API_KEY is missing. Email sending will fail.",
      );
      // Pendant le build, on peut retourner une instance bidon pour éviter les crashs
      // Mais en production, il faut la clé.
      resendInstance = new Resend("disabled_key");
    } else {
      resendInstance = new Resend(apiKey);
    }
  }
  return resendInstance;
};

const fromEmail = "Ferme St André <contact@net.eurinhash.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export const emailService = {
  /**
   * Envoi d'une confirmation de demande de stage
   */
  async sendInternshipConfirmation(to: string, fullName: string) {
    try {
      const resend = getResend();
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: "Confirmation de votre demande de stage - Ferme St André",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-top: 4px solid #10b981; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <img src="${APP_URL}/logo-fsa.png" alt="Ferme St André" style="width: 150px;" />
            </div>
            <div style="padding: 32px; color: #334155; line-height: 1.6;">
              <h2 style="color: #0f172a; margin-top: 0;">Bonjour ${fullName},</h2>
              <p>Nous avons bien reçu votre demande de stage à la <strong>Ferme Agro-Piscicole Cité St André</strong>.</p>
              <p>Toute notre équipe vous remercie de l'intérêt porté à notre établissement. Nous allons examiner votre profil avec la plus grande attention.</p>
              <p>Vous serez recontacté prochainement par nos services pour la suite de votre processus de sélection.</p>
              <div style="margin-top: 32px; padding: 20px; background-color: #f0fdf4; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; color: #065f46;"><strong>Note :</strong> Ce message est une confirmation de réception automatique. Merci de ne pas y répondre directement.</p>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} Ferme Agro-Piscicole Cité St André. Abomey-Calavi, Bénin.
            </div>
          </div>
        `,
      });
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] Internship Confirmation:", error);
      return { success: false, error };
    }
  },

  /**
   * Envoi des résultats d'examen au candidat
   */
  async sendExamResults(
    to: string,
    fullName: string,
    examTitle: string,
    score: number,
    isSuccess: boolean,
    examType: 'OFFICIAL' | 'MOCK' = 'OFFICIAL',
  ) {
    try {
      const resend = getResend();
      const isMock = examType === 'MOCK';
      
      const statusText = isSuccess
        ? (isMock ? "OBJECTIF ATTEINT ! Bel entraînement." : "ADMIS - FÉLICITATIONS !")
        : (isMock ? "ENTRAÎNEMENT À POURSUIVRE." : "REFUSÉ - SCORE INSUFFISANT.");
      
      const statusColor = isSuccess ? "#10b981" : "#ef4444";
      
      const subject = isSuccess
        ? (isMock ? `🏆 Objectif Atteint : ${examTitle}` : `🎓 ADMIS ! Votre attestation est prête - ${examTitle}`)
        : (isMock ? `📝 Score Entraînement : ${examTitle}` : `📉 Résultat Examen : REFUSÉ - ${examTitle}`);

      await resend.emails.send({
        from: fromEmail,
        to,
        subject: subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-top: 4px solid ${statusColor}; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <img src="${APP_URL}/logo-fsa.png" alt="Ferme St André" style="width: 150px;" />
            </div>
            <div style="padding: 32px; color: #334155; line-height: 1.6;">
              <h2 style="color: #0f172a; margin-top: 0;">Bonjour ${fullName},</h2>
              <p>Votre ${isMock ? 'auto-évaluation' : 'examen'} "<strong>${examTitle}</strong>" a été corrigé.</p>

              <div style="margin: 32px 0; padding: 32px; text-align: center; background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 14px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Note Finale</p>
                 <p style="margin: 8px 0; font-size: 48px; font-weight: 900; color: ${statusColor};">
                    ${Math.round(score)} <span style="font-size: 18px; color: #cbd5e1;">/ 100</span>
                 </p>
                 <p style="margin: -10px 0 16px 0; font-size: 16px; color: #94a3b8; font-weight: 600;">
                    Soit <span style="color: ${statusColor};">${(score / 5).toFixed(2)} / 20</span>
                 </p>
                 <p style="margin: 0; font-weight: bold; color: ${statusColor}; text-transform: uppercase;">${statusText}</p>
                 ${isMock ? '<p style="margin: 8px 0 0 0; font-size: 11px; color: #6366f1; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Mode Entraînement</p>' : ''}
              </div>

              ${
                isSuccess
                  ? isMock 
                    ? `
                    <p>Bravo pour ce score ! Continuez à vous entraîner pour être prêt lors de la session officielle. Vos notes d'entraînement sont consultables sur votre relevé de notes.</p>
                    <div style="text-align: center; margin-top: 32px;">
                      <a href="${APP_URL}/transcript" style="display: inline-block; padding: 16px 32px; background-color: #6366f1; color: white; text-decoration: none; font-weight: bold; border-radius: 12px;">
                        Voir mon relevé de notes
                      </a>
                    </div>
                    `
                    : `
                    <p>Votre attestation de réussite a été générée automatiquement. Vous pouvez la télécharger dès maintenant depuis votre tableau de bord.</p>
                    <div style="text-align: center; margin-top: 32px;">
                      <a href="${APP_URL}/results" style="display: inline-block; padding: 16px 32px; background-color: #10b981; color: white; text-decoration: none; font-weight: bold; border-radius: 12px; shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);">
                        Télécharger mon attestation
                      </a>
                    </div>
                  `
                  : `
                <p>Le seuil de réussite est fixé à <strong>13/20</strong> (65%). ${isMock ? "Utilisez ce résultat pour identifier vos points d'amélioration et retentez l'entraînement pour atteindre l'excellence." : "Ne vous découragez pas, la persévérance est la clé du succès. Contactez votre formateur pour les modalités de rattrapage."}</p>
                <div style="text-align: center; margin-top: 32px;">
                  <a href="${APP_URL}/${isMock ? 'mock-exams' : 'exams'}" style="display: inline-block; padding: 16px 32px; background-color: #0f172a; color: white; text-decoration: none; font-weight: bold; border-radius: 12px;">
                    ${isMock ? "Retenter l'entraînement" : "Retour au centre d'examens"}
                  </a>
                </div>
              `
              }
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} Ferme Agro-Piscicole Cité St André. Abomey-Calavi, Bénin.
            </div>
          </div>
        `,
      });
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] Exam Results:", error);
      return { success: false, error };
    }
  },

  /**
   * Envoi d'un email de vérification d'adresse email
   */
  async sendVerificationEmail(
    to: string,
    fullName: string,
    verifyLink: string,
  ) {
    try {
      const resend = getResend();
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: "Vérifiez votre adresse email - Ferme St André",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-top: 4px solid #6366f1; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <img src="${APP_URL}/logo-fsa.png" alt="Ferme St André" style="width: 150px;" />
            </div>
            <div style="padding: 32px; color: #334155; line-height: 1.6;">
              <h2 style="color: #0f172a; margin-top: 0;">Bonjour ${fullName},</h2>
              <p>Merci de vous être inscrit sur notre plateforme. Pour finaliser votre inscription et sécuriser votre compte, merci de vérifier votre adresse email.</p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${verifyLink}" style="display: inline-block; padding: 16px 32px; background-color: #6366f1; color: white; text-decoration: none; font-weight: bold; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.3);">
                  Vérifier mon email
                </a>
              </div>

              <p style="font-size: 14px; color: #64748b;">Ou copiez-collez ce lien dans votre navigateur :</p>
              <p style="background-color: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 12px; color: #475569; word-break: break-all; text-align: center;">
                ${verifyLink}
              </p>

              <div style="margin-top: 32px; padding: 20px; background-color: #fef2f2; border-radius: 8px; border: 1px solid #fee2e2;">
                <p style="margin: 0; font-size: 13px; color: #991b1b;">⏰ <strong>Attention :</strong> Ce lien est valable pendant <strong>24 heures</strong>.</p>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} Ferme Agro-Piscicole Cité St André. Abomey-Calavi, Bénin.
            </div>
          </div>
        `,
      });
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] Verification Email:", error);
      return { success: false, error };
    }
  },

  /**
   * ⚠️ DEPRECATED - Ancien système par lien de réinitialisation
   * Remplacé par sendPasswordResetOTP() (code OTP à 6 chiffres)
   * Gardé pour compatibilité uniquement, ne plus utiliser.
   */
  async sendPasswordReset(to: string, fullName: string, resetLink: string) {
    try {
      const resend = getResend();
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: "Réinitialisation de votre mot de passe - Ferme St André",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-top: 4px solid #f59e0b; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <img src="${APP_URL}/logo-fsa.png" alt="Ferme St André" style="width: 150px;" />
            </div>
            <div style="padding: 32px; color: #334155; line-height: 1.6;">
              <h2 style="color: #0f172a; margin-top: 0;">Bonjour ${fullName},</h2>
              <p>Nous avons reçu une demande de réinitialisation de votre mot de passe pour votre compte <strong>Ferme St André</strong>.</p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}" style="display: inline-block; padding: 16px 32px; background-color: #f59e0b; color: white; text-decoration: none; font-weight: bold; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.3);">
                  Réinitialiser mon mot de passe
                </a>
              </div>

              <p style="font-size: 14px; color: #64748b;">Ou copiez-collez ce lien dans votre navigateur :</p>
              <p style="background-color: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 12px; color: #475569; word-break: break-all; text-align: center;">
                ${resetLink}
              </p>

              <div style="margin-top: 32px; padding: 20px; background-color: #fef2f2; border-radius: 8px; border: 1px solid #fee2e2;">
                <p style="margin: 0; font-size: 13px; color: #991b1b;">⚠️ <strong>Important :</strong> Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Ce lien expire dans <strong>1 heure</strong>.</p>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} Ferme Agro-Piscicole Cité St André. Abomey-Calavi, Bénin.
            </div>
          </div>
        `,
      });
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] Password Reset:", error);
      return { success: false, error };
    }
  },

  /**
   * Envoi d'un code OTP pour réinitialisation de mot de passe
   */
  async sendPasswordResetOTP(to: string, fullName: string, otp: string) {
    try {
      const resend = getResend();
      const year = new Date().getFullYear();
      const resetUrl = `${APP_URL}/reset-password`;
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: `🔐 Votre code de vérification : ${otp}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

            <!-- Wrapper -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; padding: 40px 20px;">
              <tr>
                <td align="center">

                  <!-- Card -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.08);">

                    <!-- Header with gradient -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); padding: 40px 32px; text-align: center;">
                        <div style="margin-bottom: 16px;">
                          <img src="${APP_URL}/logo-fsa.png" alt="FSA" style="width: 100px; height: 100px; border-radius: 16px; background: rgba(255,255,255,0.15); padding: 8px;" />
                        </div>
                        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                          🔐 Réinitialisation du mot de passe
                        </h1>
                        <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">
                          Ferme Agro-Piscicole Cité St André
                        </p>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding: 32px;">
                        <p style="margin: 0 0 24px 0; font-size: 16px; color: #475569; line-height: 1.6;">
                          Bonjour <strong style="color: #0f172a;">${fullName}</strong>,
                        </p>
                        <p style="margin: 0 0 32px 0; font-size: 15px; color: #64748b; line-height: 1.7;">
                          Nous avons reçu une demande de réinitialisation de votre mot de passe. Utilisez le code ci-dessous pour finaliser l'opération :
                        </p>

                        <!-- OTP Box -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 32px 0;">
                          <tr>
                            <td style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 16px; padding: 32px; text-align: center; border: 2px solid #6ee7b7;">
                              <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 600; color: #065f46; text-transform: uppercase; letter-spacing: 2px;">
                                Votre code de vérification
                              </p>
                              <p style="margin: 0; font-size: 56px; font-weight: 900; color: #059669; letter-spacing: 12px; font-family: 'Courier New', Courier, monospace; text-shadow: 0 2px 8px rgba(5, 150, 105, 0.2);">
                                ${otp}
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- Timer Warning -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                          <tr>
                            <td style="background-color: #fef3c7; border-radius: 12px; padding: 16px 20px; border-left: 4px solid #f59e0b;">
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="font-size: 20px; padding-right: 12px;">⏱️</td>
                                  <td>
                                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #92400e;">
                                      Temps limité : 10 minutes
                                    </p>
                                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #a16207;">
                                      Ce code expirera automatiquement après ce délai pour votre sécurité.
                                    </p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <!-- Security Notice -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                          <tr>
                            <td style="background-color: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
                              <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #334155;">
                                🛡️ Conseils de sécurité :
                              </p>
                              <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #64748b; line-height: 1.8;">
                                <li>Ne partagez <strong style="color: #1e293b;">jamais</strong> ce code avec quiconque</li>
                                <li>Notre équipe ne vous demandera <strong style="color: #1e293b;">jamais</strong> ce code par téléphone ou email</li>
                                <li>Si vous n'avez pas fait cette demande, <strong style="color: #1e293b;">ignorez simplement cet email</strong></li>
                              </ul>
                            </td>
                          </tr>
                        </table>

                        <!-- CTA Button -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0 0 0;">
                          <tr>
                            <td style="text-align: center;">
                              <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 12px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                                Accéder à la page de réinitialisation →
                              </a>
                            </td>
                          </tr>
                        </table>

                        <p style="margin: 24px 0 0 0; font-size: 14px; color: #94a3b8; text-align: center;">
                          Cordialement,<br>
                          <strong style="color: #64748b;">L'équipe Ferme St André</strong>
                        </p>
                      </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                      <td style="padding: 0 32px;">
                        <div style="height: 1px; background-color: #e2e8f0;"></div>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 32px; text-align: center;">
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">
                          Cet email a été envoyé à <strong style="color: #64748b;">${to}</strong>
                        </p>
                        <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                          © ${year} Ferme Agro-Piscicole Cité St André • Abomey-Calavi, Bénin
                        </p>
                        <p style="margin: 12px 0 0 0; font-size: 10px; color: #e2e8f0;">
                          Ceci est un message automatique, merci de ne pas y répondre directement.
                        </p>
                      </td>
                    </tr>

                  </table>
                  <!-- End Card -->

                </td>
              </tr>
            </table>
            <!-- End Wrapper -->

          </body>
          </html>
        `,
      });
      console.log(`[EMAIL_SERVICE] ✅ OTP code sent to ${to}: ${otp}`);
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] Password Reset OTP:", error);
      return { success: false, error };
    }
  },

  /**
   * Envoi d'un code OTP pour vérification d'email lors de l'inscription
   */
  async sendVerificationOTP(to: string, fullName: string, otp: string) {
    try {
      const resend = getResend();
      const year = new Date().getFullYear();
      const verifyUrl = `${APP_URL}/auth?verify=true`;
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: `✅ Vérifiez votre email - Code OTP`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

            <!-- Wrapper -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; padding: 40px 20px;">
              <tr>
                <td align="center">

                  <!-- Card -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.08);">

                    <!-- Header with gradient -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); padding: 40px 32px; text-align: center;">
                        <div style="margin-bottom: 16px;">
                          <img src="${APP_URL}/logo-fsa.png" alt="FSA" style="width: 100px; height: 100px; border-radius: 16px; background: rgba(255,255,255,0.15); padding: 8px;" />
                        </div>
                        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                          ✅ Vérification d'email
                        </h1>
                        <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">
                          Ferme Agro-Piscicole Cité St André
                        </p>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding: 32px;">
                        <p style="margin: 0 0 24px 0; font-size: 16px; color: #475569; line-height: 1.6;">
                          Bonjour <strong style="color: #0f172a;">${fullName}</strong>,
                        </p>
                        <p style="margin: 0 0 32px 0; font-size: 15px; color: #64748b; line-height: 1.7;">
                          Merci de vous être inscrit ! Veuillez vérifier votre adresse email en utilisant le code ci-dessous :
                        </p>

                        <!-- OTP Box -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 32px 0;">
                          <tr>
                            <td style="background-color: #f0fdf4; border-radius: 16px; padding: 24px; border: 2px solid #bbf7d0; text-align: center;">
                              <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #166534; letter-spacing: 0.5px; text-transform: uppercase;">
                                Votre code de vérification
                              </p>
                              <p style="margin: 0; font-size: 36px; font-weight: 800; color: #15803d; letter-spacing: 8px;">
                                ${otp}
                              </p>
                              <p style="margin: 16px 0 0 0; font-size: 12px; color: #86efac;">
                                ⏱️ Ce code expire dans 10 minutes
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- Security Tips -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 32px 0;">
                          <tr>
                            <td style="background-color: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
                              <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #334155;">
                                🛡️ Conseils de sécurité :
                              </p>
                              <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #64748b; line-height: 1.8;">
                                <li>Ne partagez <strong style="color: #1e293b;">jamais</strong> ce code avec quiconque</li>
                                <li>Notre équipe ne vous demandera <strong style="color: #1e293b;">jamais</strong> ce code par téléphone ou email</li>
                                <li>Si vous n'avez pas demandé ce code, <strong style="color: #1e293b;">ignorez simplement cet email</strong></li>
                              </ul>
                            </td>
                          </tr>
                        </table>

                        <p style="margin: 24px 0 0 0; font-size: 14px; color: #94a3b8; text-align: center;">
                          Cordialement,<br>
                          <strong style="color: #64748b;">L'équipe Ferme St André</strong>
                        </p>
                      </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                      <td style="padding: 0 32px;">
                        <div style="height: 1px; background-color: #e2e8f0;"></div>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 32px; text-align: center;">
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">
                          Cet email a été envoyé à <strong style="color: #64748b;">${to}</strong>
                        </p>
                        <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                          © ${year} Ferme Agro-Piscicole Cité St André • Abomey-Calavi, Bénin
                        </p>
                        <p style="margin: 12px 0 0 0; font-size: 10px; color: #e2e8f0;">
                          Ceci est un message automatique, merci de ne pas y répondre directement.
                        </p>
                      </td>
                    </tr>

                  </table>
                  <!-- End Card -->

                </td>
              </tr>
            </table>
            <!-- End Wrapper -->

          </body>
          </html>
        `,
      });
      console.log(`[EMAIL_SERVICE] ✅ Verification OTP sent to ${to}: ${otp}`);
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] Verification OTP:", error);
      return { success: false, error };
    }
  },

  /**
   * Envoi d'une notification générale personnalisée
   */
  async sendGeneralNotification(to: string, fullName: string, title: string, message: string) {
    try {
      const resend = getResend();
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: `${title} - Ferme St André`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-top: 4px solid #ef4444; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <img src="${APP_URL}/logo-fsa.png" alt="Ferme St André" style="width: 150px;" />
            </div>
            <div style="padding: 32px; color: #334155; line-height: 1.6;">
              <h2 style="color: #0f172a; margin-top: 0;">Bonjour ${fullName},</h2>
              <h3 style="color: #ef4444; margin-bottom: 16px;">${title}</h3>
              <p style="white-space: pre-wrap;">${message}</p>
              
              <div style="text-align: center; margin-top: 32px;">
                <a href="${APP_URL}/dashboard" style="display: inline-block; padding: 14px 28px; background-color: #0f172a; color: white; text-decoration: none; font-weight: bold; border-radius: 10px;">
                  Accéder à mon tableau de bord
                </a>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} Ferme Agro-Piscicole Cité St André. Abomey-Calavi, Bénin.
            </div>
          </div>
        `,
      });
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] General Notification:", error);
      return { success: false, error };
    }
  },

  /**
   * Envoi du code 2FA pour l'authentification admin
   */
  async sendTwoFactorOTP(to: string, fullName: string, otp: string) {
    try {
      const resend = getResend();
      const year = new Date().getFullYear();
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: `🔐 Code de vérification 2FA - FSA Admin`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #fef2f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%); padding: 40px 32px; text-align: center;">
                        <div style="margin-bottom: 16px;">
                          <img src="${APP_URL}/logo-fsa.png" alt="FSA" style="width: 100px; height: 100px; border-radius: 16px; background: rgba(255,255,255,0.15); padding: 8px;" />
                        </div>
                        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                          🔐 Vérification 2FA Requise
                        </h1>
                        <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">
                          Ferme Agro-Piscicole Cité St André
                        </p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding: 32px;">
                        <p style="margin: 0 0 24px 0; font-size: 16px; color: #475569; line-height: 1.6;">
                          Bonjour <strong style="color: #0f172a;">${fullName}</strong>,
                        </p>
                        <p style="margin: 0 0 32px 0; font-size: 15px; color: #64748b; line-height: 1.7;">
                          Une tentative de connexion à votre compte administrateur a été détectée. Utilisez le code suivant pour compléter la vérification en deux étapes :
                        </p>
                        
                        <!-- OTP Code -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                          <tr>
                            <td style="background-color: #fef2f2; border: 2px dashed #dc2626; border-radius: 12px; padding: 24px; text-align: center;">
                              <p style="margin: 0 0 8px 0; font-size: 14px; color: #991b1b; font-weight: 600;">
                                VOTRE CODE 2FA
                              </p>
                              <p style="margin: 0; font-size: 36px; font-weight: 800; color: #dc2626; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                ${otp}
                              </p>
                              <p style="margin: 8px 0 0 0; font-size: 12px; color: #b91c1c;">
                                Valide pendant <strong>5 minutes</strong>
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- Security Warning -->
                        <div style="margin-top: 32px; padding: 20px; background-color: #fef3c7; border-radius: 12px; border-left: 4px solid #f59e0b;">
                          <p style="margin: 0; font-size: 14px; color: #92400e;">
                            <strong>⚠️ Important :</strong> Si vous n'avez pas tenté de vous connecter, ignorez cet email et contactez immédiatement l'administrateur système.
                          </p>
                        </div>

                        <!-- Footer Info -->
                        <div style="margin-top: 32px; padding: 20px; background-color: #f8fafc; border-radius: 12px;">
                          <p style="margin: 0 0 8px 0; font-size: 14px; color: #475569;">
                            <strong>Alternative :</strong> Vous pouvez aussi utiliser votre application d'authentification (Google Authenticator, Authy, etc.) pour générer le code.
                          </p>
                        </div>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0;">&copy; ${year} Ferme Agro-Piscicole Cité St André. Abomey-Calavi, Bénin.</p>
                        <p style="margin: 8px 0 0 0;">Ceci est un message automatique sécurisé. Ne pas répondre.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] 2FA OTP:", error);
      return { success: false, error };
    }
  },

  /**
   * Envoi d'une notification officielle de résultats avec instructions de retrait
   */
  async sendOfficialTranscriptNotification(
    to: string,
    fullName: string,
    examTitle: string,
    score: number,
    isSuccess: boolean
  ) {
    try {
      const resend = getResend();
      const statusColor = isSuccess ? "#10b981" : "#ef4444";
      const subject = isSuccess 
        ? `🏆 Félicitations ! Votre relevé de notes officiel est disponible - Filtre FSA`
        : `📝 Résultat de votre examen - Filtre FSA`;

      const successContent = `
        <p>Nous avons le plaisir de vous informer que vous avez <strong>réussi</strong> votre examen "<strong>${examTitle}</strong>" avec un score de <strong>${Math.round(score)}%</strong>.</p>
        <p>Votre relevé de notes officiel est désormais disponible sur votre espace candidat.</p>
        
        <div style="margin: 24px 0; padding: 24px; background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
          <h3 style="color: #166534; margin-top: 0; font-size: 16px;">🚀 Comment récupérer mon attestation ?</h3>
          <ol style="margin: 0; padding-left: 20px; color: #166534; font-size: 14px; line-height: 1.8;">
            <li>Connectez-vous sur le portail : <a href="${APP_URL}/auth" style="color: #10b981; font-weight: bold;">Accéder au Portail</a></li>
            <li>Dans le menu à gauche, allez dans la section "<strong>Relevé de notes</strong>".</li>
            <li>Cliquez sur le bouton "<strong>Télécharger le relevé officiel</strong>".</li>
          </ol>
        </div>

        <div style="margin-top: 24px; padding: 20px; background-color: #fffbeb; border-radius: 12px; border: 2px solid #fef3c7;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>⚠️ Étape Finale importante :</strong><br />
            Une fois votre relevé téléchargé, envoyez-le par email ou déposez-le au <strong>centre d'examen</strong> pour demander l'édition et le retrait de votre <strong>Attestation de fin de formation</strong>.
          </p>
        </div>
      `;

      const failureContent = `
        <p>Votre examen "<strong>${examTitle}</strong>" a été corrigé. Vous avez obtenu un score de <strong>${Math.round(score)}%</strong>.</p>
        <p>Malheureusement, ce score est inférieur au seuil de réussite de 65%.</p>
        
        <div style="margin: 24px 0; padding: 24px; background-color: #fef2f2; border-radius: 12px; border: 1px solid #fee2e2;">
          <h3 style="color: #991b1b; margin-top: 0; font-size: 16px;">🌱 Prochaines étapes :</h3>
          <ul style="margin: 0; padding-left: 20px; color: #991b1b; font-size: 14px; line-height: 1.8;">
            <li>Vous pouvez consulter le détail de vos notes dans la section "<strong>Relevé de notes</strong>" de votre espace candidat.</li>
            <li>Contactez votre centre de formation pour connaître les modalités de rattrapage ou de renforcement de capacités.</li>
          </ul>
        </div>
        
        <p style="color: #64748b; font-style: italic;">Ne vous découragez pas, la persévérance est la clé du succès. L'équipe FSA est à votre disposition pour vous accompagner.</p>
      `;

      await resend.emails.send({
        from: fromEmail,
        to,
        subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, ${isSuccess ? '#059669' : '#1e293b'} 0%, ${isSuccess ? '#10b981' : '#334155'} 100%); padding: 40px 32px; text-align: center;">
                        <img src="${APP_URL}/logo-fsa.png" alt="FSA Logo" style="width: 80px; height: 80px; margin-bottom: 16px; border-radius: 12px; background: rgba(255,255,255,0.2); padding: 8px;" />
                        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                          Ferme Agro-Piscicole Cité St André
                        </h1>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: rgba(255,255,255,0.8); font-weight: 600; letter-spacing: 2px; text-transform: uppercase;">
                          Service des Examens et Certification
                        </p>
                      </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                      <td style="padding: 48px 32px;">
                        <h2 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 800; color: #0f172a; tracking: -0.5px;">
                          Bonjour ${fullName},
                        </h2>
                        
                        <div style="font-size: 16px; color: #475569; line-height: 1.8;">
                          ${isSuccess ? successContent : failureContent}
                        </div>

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 40px;">
                          <tr>
                            <td align="center">
                              <a href="${APP_URL}/dashboard" style="display: inline-block; padding: 18px 40px; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 16px; box-shadow: 0 10px 20px rgba(15, 23, 42, 0.2);">
                                Accéder à mon espace candidat →
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                      <td style="padding: 0 32px;">
                        <div style="height: 1px; background-color: #f1f5f9;"></div>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding: 40px 32px; background-color: #fafafa; text-align: center;">
                        <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #334155;">
                          Besoin d'aide ?
                        </p>
                        <p style="margin: 0 0 24px 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                          Contactez le support technique au <br />
                          <strong style="color: #0f172a;">support@fermestandre.com</strong> ou via votre application.
                        </p>
                        
                        <div style="margin-bottom: 24px;">
                          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #e2e8f0; margin: 0 4px;"></span>
                          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #e2e8f0; margin: 0 4px;"></span>
                          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #e2e8f0; margin: 0 4px;"></span>
                        </div>

                        <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                          &copy; ${new Date().getFullYear()} Ferme Agro-Piscicole Cité St André
                        </p>
                        <p style="margin: 4px 0 0 0; font-size: 10px; color: #cbd5e1;">
                          Abomey-Calavi. Tous droits réservés.
                        </p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] Transcript Notification:", error);
      return { success: false, error };
    }
  },

  /**
   * Envoi d'un code OTP pour connexion via code FSA
   */
  async sendFsaLoginOTP(to: string, fullName: string, otp: string) {
    try {
      const resend = getResend();
      const year = new Date().getFullYear();
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: `🔑 Votre code de connexion temporaire : ${otp}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.08);">
                    <tr style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 32px; text-align: center;">
                      <td style="padding: 40px 32px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">🔑 Connexion au Portail FSA</h1>
                        <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">Ferme Agro-Piscicole Cité St André</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 32px;">
                        <p style="margin: 0 0 24px 0; font-size: 16px; color: #475569; line-height: 1.6;">
                          Bonjour <strong style="color: #0f172a;">${fullName}</strong>,
                        </p>
                        <p style="margin: 0 0 32px 0; font-size: 15px; color: #64748b; line-height: 1.7;">
                          Vous tentez de vous connecter à votre espace candidat à l'aide de votre Code FSA. Saisissez le code de validation temporaire ci-dessous sur l'écran de connexion :
                        </p>
                        <table role="presentation" width="100%" style="margin: 0 0 32px 0;">
                          <tr>
                            <td style="background-color: #f0fdf4; border-radius: 16px; padding: 24px; border: 2px solid #bbf7d0; text-align: center;">
                              <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #166534; letter-spacing: 0.5px; text-transform: uppercase;">Code d'accès temporaire</p>
                              <p style="margin: 0; font-size: 36px; font-weight: 800; color: #15803d; letter-spacing: 8px;">${otp}</p>
                              <p style="margin: 16px 0 0 0; font-size: 12px; color: #166534; opacity: 0.7;">⏱️ Ce code expire dans 10 minutes</p>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 0 0 16px 0; font-size: 13px; color: #94a3b8; text-align: center;">Si vous n'avez pas initié cette connexion, vous pouvez ignorer cet email en toute sécurité.</p>
                      </td>
                    </tr>
                    <tr style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                      <td style="padding: 24px; text-align: center; font-size: 11px; color: #94a3b8;">
                        © ${year} Ferme Agro-Piscicole Cité St André • Abomey-Calavi, Bénin
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      });
      console.log(`[EMAIL_SERVICE] ✅ FSA Login OTP sent to ${to}`);
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] FSA Login OTP:", error);
      return { success: false, error };
    }
  },
};
