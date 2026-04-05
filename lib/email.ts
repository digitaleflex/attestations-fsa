import { Resend } from 'resend';

// Initialisation paresseuse pour éviter les erreurs lors du build (si la clé API est absente)
let resendInstance: Resend | null = null;

const getResend = () => {
    if (!resendInstance) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.warn("[EMAIL_SERVICE] RESEND_API_KEY is missing. Email sending will fail.");
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
              <img src="https://fsa.eurinhash.com/logo-fsa.png" alt="Ferme St André" style="width: 120px;" />
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
        `
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
  async sendExamResults(to: string, fullName: string, examTitle: string, score: number, isSuccess: boolean) {
    try {
      const resend = getResend();
      const statusText = isSuccess ? "FÉLICITATIONS ! Vous avez réussi." : "Résultats de votre examen.";
      const statusColor = isSuccess ? "#10b981" : "#475569";
      
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: isSuccess ? "Félicitations ! Votre attestation est prête" : "Résultats de votre examen - Ferme St André",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-top: 4px solid ${statusColor}; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <img src="https://fsa.eurinhash.com/logo-fsa.png" alt="Ferme St André" style="width: 120px;" />
            </div>
            <div style="padding: 32px; color: #334155; line-height: 1.6;">
              <h2 style="color: #0f172a; margin-top: 0;">Bonjour ${fullName},</h2>
              <p>Votre examen "<strong>${examTitle}</strong>" a été corrigé par nos formateurs.</p>
              
              <div style="margin: 32px 0; padding: 32px; text-align: center; background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 14px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Note Finale</p>
                <p style="margin: 8px 0; font-size: 48px; font-weight: 900; color: ${statusColor};">
                   ${score.toFixed(2)} <span style="font-size: 18px; color: #cbd5e1;">/ 20</span>
                </p>
                <p style="margin: 0; font-weight: bold; color: ${statusColor};">${statusText}</p>
              </div>

              ${isSuccess ? `
                <p>Votre attestation de réussite a été générée automatiquement. Vous pouvez la télécharger dès maintenant depuis votre tableau de bord.</p>
                <div style="text-align: center; margin-top: 32px;">
                  <a href="https://fsa.eurinhash.com/exams/results" style="display: inline-block; padding: 16px 32px; background-color: #10b981; color: white; text-decoration: none; font-weight: bold; border-radius: 12px; shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);">
                    Télécharger mon attestation
                  </a>
                </div>
              ` : `
                <p>Le seuil de réussite est fixé à <strong>12/20</strong>. Ne vous découragez pas, la persévérance est la clé du succès. Contactez votre formateur pour les modalités de rattrapage.</p>
                <div style="text-align: center; margin-top: 32px;">
                  <a href="https://fsa.eurinhash.com/exams" style="display: inline-block; padding: 16px 32px; background-color: #0f172a; color: white; text-decoration: none; font-weight: bold; border-radius: 12px;">
                    Retour au centre d'examens
                  </a>
                </div>
              `}
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} Ferme Agro-Piscicole Cité St André. Abomey-Calavi, Bénin.
            </div>
          </div>
        `
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
  async sendVerificationEmail(to: string, fullName: string, verifyLink: string) {
    try {
      const resend = getResend();
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: "Vérifiez votre adresse email - Ferme St André",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-top: 4px solid #6366f1; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <img src="https://fsa.eurinhash.com/logo-fsa.png" alt="Ferme St André" style="width: 120px;" />
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
        `
      });
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] Verification Email:", error);
      return { success: false, error };
    }
  },

  /**
   * Envoi d'une confirmation d'inscription à la liste d'attente Portfolios
   */
  async sendWaitlistConfirmation(to: string) {
    try {
      const resend = getResend();
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: "Bienvenue sur la liste d'attente Portfolios - FSA",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-top: 4px solid #3b82f6; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <img src="https://fsa.eurinhash.com/logo-fsa.png" alt="Ferme St André" style="width: 120px;" />
            </div>
            <div style="padding: 32px; color: #334155; line-height: 1.6;">
              <h2 style="color: #0f172a; margin-top: 0;">Félicitations !</h2>
              <p>Vous avez bien rejoint la liste d'attente pour le lancement des <strong>Portfolios Numériques FSA</strong>.</p>
              <p>Dès Mai 2026, vous ferez partie des premiers techniciens à disposer d'une vitrine professionnelle certifiée, reliée directement à vos résultats d'examens.</p>
              <div style="margin: 24px 0; padding: 20px; background-color: #eff6ff; border-radius: 12px; border: 1px solid #dbeafe;">
                <p style="margin: 0; color: #1e40af; font-weight: bold;">💎 Avantage Pionnier :</p>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #1e3a8a;">Votre profil sera mis en avant dans l'annuaire public dès l'ouverture officielle.</p>
              </div>
              <p>Nous vous tiendrons informé de l'avancement du déploiement par email.</p>
              <p>À bientôt !</p>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} Ferme Agro-Piscicole Cité St André.
            </div>
          </div>
        `
      });
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] Waitlist Confirmation:", error);
      return { success: false, error };
    }
  },

  /**
   * Notification Admin pour une nouvelle inscription sur la liste d'attente
   */
  async notifyAdminWaitlist(userEmail: string) {
    try {
      const resend = getResend();
      await resend.emails.send({
        from: fromEmail,
        to: "contact@net.eurinhash.com", // Email admin par défaut
        subject: "🔔 Nouvelle inscription Liste d'Attente Portfolios",
        html: `
          <div style="font-family: sans-serif; padding: 24px;">
            <h2 style="color: #0f172a;">Nouvel Intérêt Portfolios</h2>
            <p>Un utilisateur vient de rejoindre la liste d'attente pour les Portfolios Numériques :</p>
            <div style="padding: 16px; background-color: #f1f5f9; border-radius: 8px; font-weight: bold; color: #475569;">
              ${userEmail}
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Envoyé automatiquement par le système FSA.</p>
          </div>
        `
      });
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] Admin Waitlist Alert:", error);
      return { success: false, error };
    }
  },

  /**
   * Envoi d'un email de réinitialisation de mot de passe
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
              <img src="https://fsa.eurinhash.com/logo-fsa.png" alt="Ferme St André" style="width: 120px;" />
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
        `
      });
      return { success: true };
    } catch (error) {
      console.error("[EMAIL_ERROR] Password Reset:", error);
      return { success: false, error };
    }
  }
};
