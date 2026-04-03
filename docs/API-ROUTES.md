# 🗺️ Inventaire des Routes API - FSA

Ce document recense l'ensemble des points de terminaison (endpoints) de l'API REST de la plateforme, classés par domaine fonctionnel.

## 🔐 Authentification & Sessions
Gère la connexion, l'inscription et la gestion sécurisée des rôles (Candidats vs Admins).
* **`/api/auth/[...all]`** : Point d'entrée du système officiel Better Auth
* **`/api/auth/login`** : Login manuel principal (système maison)
* **`/api/auth/register`** : Inscription publique
* **`/api/auth/logout`** : Déconnexion

## 🛡️ Administration (Backoffice)
Routes réservées aux administrateurs (`ADMIN`) pour la gestion opérationnelle.
* **`/api/admin`** : Récupération du profil admin connecté
* **`/api/admin/exams`** : Création d'examens et listing avec le nouveau barème global
* **`/api/admin/internships`** : Gestion et validation des listes de stage
* **`/api/admin/submissions`** : Listing des copies à corriger
* **`/api/admin/submissions/[id]`** : Détails d'une copie individuelle
* **`/api/admin/submissions/[id]/correct`** : Sauvegarde de la correction manuelle
* **`/api/admin/submissions/[id]/scans`** : Upload des copies physiques scannées

## 🎓 Espace Candidats / Utilisateurs
Routes utilisées par les candidats (`USER`) depuis leur tableau de bord personnel.
* **`/api/user/profile`** : Gestion des informations du compte candidat
* **`/api/user/exams`** : Examens accessibles/disponibles pour le candidat
* **`/api/user/results`** : Résultats finaux des passages du candidat
* **`/api/user/attestations`** : Attestations gagnées par le candidat
* **`/api/user/internships`** : Historique et statuts de ses demandes de stage
* **`/api/user/statistics`** : Statistiques personnelles affichées sur le dashboard du candidat
* **`/api/candidates/exams`** : Récupération des examens
* **`/api/candidates/exams/[id]`** : Détails d'un examen spécifique avant de le passer

## 📝 Passage & Notation des Examens
Logique métier du système d'évaluation en temps réel.
* **`/api/exams`** : Liste générique des examens (lecture simple)
* **`/api/exams/[id]`** : Chargement et distribution d'une épreuve spécifique lors du passage
* **`/api/submissions`** : Listing générique des soumissions (Copies rendues)
* **`/api/submissions/submit`** : Enregistrement à chaud des réponses au QCM/Questions de l'épreuve
* **`/api/submissions/my-result`** : Récupère le résultat immédiatement après soumission d'une copie
* **`/api/submissions/[id]`** : Donne le statut en direct de la soumission (corrigée, en attente...)
* **`/api/submissions/[id]/grade`** : Validation de la note par l'admin (inclut l'envoi d'email automatique Resend et la génération potentielle d'attestation)

## 🏢 Cœur de Métier : Formations & Attestations
Gestion de la base de données métiers.
* **`/api/formations`** : Liste et création de formations
* **`/api/formations/[id]`** : Mise à jour/Suppression d'une formation
* **`/api/attestations`** : Liste des attestations certifiées générées
* **`/api/attestations/[id]`** : Accès direct aux données d'une attestation précise

## 🌍 Accès Public (Non Authentifié) & Vérification
Routes accessibles depuis le site vitrine.
* **`/api/public/internships`** : Soumission d'une nouvelle candidature de stage avec envoi automatique d'email
* **`/api/public/alumni`** : Mur public des certifiés / Anciens diplômés de la ferme
* **`/api/public/stats`** : Chiffres clés du site public (ex: X étudiants, X certifiés)
* **`/api/verifier`** : Application scanner de QR Code pour vérifier l'authenticité d'un diplôme en live

## ⚙️ Utilitaires & Gestion Globale
* **`/api/users`** : Liste de tous les comptes pour le panel d'administration
* **`/api/users/[id]`** : Modification, réinitialisation de mot de passe ou suppression d'un utilisateur par l'Admin
* **`/api/settings`** : Modification des paramètres globaux de la plateforme (Institution, Logo, Variables d'activité, etc.)
* **`/api/signalement`** : Collecte des plaintes si un diplôme s'avère usurpé ou contient une erreur
