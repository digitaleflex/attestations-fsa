# 🔐 Guide : Authentification à Deux Facteurs (2FA) Admin

**Date** : 9 avril 2026  
**Statut** : ✅ Implémenté et opérationnel

---

## 📋 Vue d'Ensemble

La 2FA ajoute une couche de sécurité supplémentaire pour les comptes administrateurs. Après la saisie du mot de passe, une deuxième vérification est requise.

### Méthodes de vérification disponibles

1. **Application Authenticator (TOTP)** - Recommandé
   - Google Authenticator, Authy, Microsoft Authenticator
   - Code à 6 chiffres généré toutes les 30 secondes
   - Fonctionne hors ligne

2. **Code par Email (OTP)**
   - Code à 6 chiffres envoyé par email
   - Valide 5 minutes
   - 5 essais maximum

3. **Codes de Secours**
   - 10 codes à usage unique
   - À sauvegarder dans un endroit sécurisé
   - Utilisables si vous n'avez pas accès aux autres méthodes

---

## 🚀 Activation de la 2FA

### Étape 1 : Accéder à la page de configuration
```
URL : https://votre-domaine.com/admin/2fa/setup
```

### Étape 2 : Entrer le mot de passe
- Requis pour confirmer votre identité

### Étape 3 : Choisir la méthode
- **Application Authenticator** (recommandé)
- **Code par Email**

### Étape 4 : Scanner le QR Code (si TOTP)
1. Ouvrez Google Authenticator, Authy ou une application similaire
2. Scannez le QR code affiché
3. L'application générera des codes toutes les 30 secondes

### Étape 5 : Sauvegarder les codes de secours
⚠️ **CRITIQUE** : Ces codes ne s'afficheront qu'**UNE SEULE FOIS**
- Copiez-les dans un gestionnaire de mots de passe
- Ou imprimez-les et stockez-les en sécurité

### Étape 6 : Vérifier le code
- Entrez le code à 6 chiffres de votre application
- Cliquez sur "Vérifier"
- Vous serez redirigé vers le dashboard

---

## 🔑 Connexion avec 2FA

### Flux normal
1. Allez sur `/admin/login`
2. Entrez email + mot de passe
3. **Si 2FA activée** → Redirection vers `/admin/2fa/verify`
4. Choisissez la méthode de vérification :
   - **App** : Entrez le code de votre authenticator
   - **Email** : Demandez l'envoi d'un code
   - **Secours** : Utilisez un code de secours
5. Accédez au dashboard

### Appareil de confiance
- Si vous cochez "Se souvenir de cet appareil"
- Aucune 2FA demandée pendant **30 jours**
- Réinitialisable depuis les paramètres

---

## ⚙️ Configuration Technique

### Serveur (`lib/auth.ts`)
```typescript
twoFactor({
  issuer: "Ferme Agro-Piscicole Cité St André",
  totpOptions: {
    digits: 6,
    period: 30,
  },
  otpOptions: {
    sendOTP: async ({ user, otp }) => {
      await emailService.sendTwoFactorOTP(user.email, user.name, otp);
    },
    period: 5,
    allowedAttempts: 5,
    storeOTP: "encrypted",
  },
  backupCodeOptions: {
    amount: 10,
    length: 10,
    storeBackupCodes: "encrypted",
  },
  twoFactorCookieMaxAge: 600, // 10 minutes pour compléter 2FA
  trustDeviceMaxAge: 30 * 24 * 60 * 60, // 30 jours
})
```

### Client (`lib/auth-client.ts`)
```typescript
twoFactorClient({
  onTwoFactorRedirect() {
    window.location.href = "/admin/2fa/verify";
  },
})
```

---

## 📁 Fichiers Implémentés

| Fichier | Description |
|---------|-------------|
| `lib/auth.ts` | Plugin 2FA serveur |
| `lib/auth-client.ts` | Plugin 2FA client |
| `lib/email.ts` | Méthode `sendTwoFactorOTP()` |
| `app/admin/2fa/setup/page.tsx` | Page d'activation 2FA |
| `app/admin/2fa/verify/page.tsx` | Page de vérification 2FA |
| `app/admin/login/page.tsx` | Gestion `twoFactorRedirect` |

---

## 🔒 Sécurité

### Chiffrement
- **Secrets TOTP** : Chiffrés avec le secret d'authentification
- **Codes de secours** : Chiffrés par défaut
- **OTP Email** : Chiffré en base de données

### Rate Limiting
- **3 requêtes / 10 secondes** sur tous les endpoints 2FA
- **5 essais maximum** par code OTP
- **Protection brute force** intégrée

### Session
- **Cookie temporaire 2FA** : 10 minutes pour compléter
- **Appareil de confiance** : 30 jours
- **Session finale** : 30 jours (après vérification)

---

## 🆘 Dépannage

### "Je n'ai plus accès à mon application authenticator"
- Utilisez les **codes de secours**
- Ou demandez l'envoi d'un **code par email**

### "J'ai perdu tous mes codes de secours"
- Contactez un **autre administrateur**
- Il peut désactiver la 2FA depuis `/admin/settings`

### "Je ne reçois pas le code par email"
- Vérifiez vos **spams**
- Vérifiez que `RESEND_API_KEY` est configuré
- Contactez l'administrateur système

### "La 2FA me redirige en boucle"
- Videz les **cookies** du navigateur
- Vérifiez que `/admin/2fa/verify` n'est pas bloqué
- Contactez le support technique

---

## 📊 Prochaines Améliorations

- [ ] Page de gestion 2FA dans `/admin/settings/security`
- [ ] Désactivation 2FA (requiert mot de passe)
- [ ] Régénération des codes de secours
- [ ] Liste des appareils de confiance
- [ ] Forçage 2FA pour TOUS les admins (politique)

---

**Documentation Better Auth 2FA** : https://www.better-auth.com/docs/plugins/two-factor
