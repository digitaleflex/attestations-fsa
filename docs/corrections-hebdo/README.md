# 🛠️ Guide de Correction Hebdomadaire (Dev Guide)

Bienvenue dans l'espace de suivi des corrections d'examens. Ce dossier est dédié aux développeurs pour documenter les ajustements, correctifs de bugs et optimisations apportés au module d'examen chaque semaine.

## 📌 Objectifs
- Assurer la traçabilité des modifications sur le moteur d'examen.
- Documenter les cas particuliers rencontrés (bugs de timer, erreurs de soumission).
- Fournir un historique clair pour les audits de sécurité.

## 📂 Structure du Dossier
Chaque semaine doit faire l'objet d'un fichier séparé suivant le format : `YYYY-WW-corrections.md` (WW = numéro de semaine).

### Modèle de Rapport Hebdomadaire
Chaque rapport devrait inclure :
1. **Période** : Semaine du X au Y 2026.
2. **Problèmes Identifiés** : Liste des erreurs signalées par les admins/étudiants.
3. **Correctifs Appliqués** : Détails techniques des modifications de code.
4. **Validation** : Tests effectués pour confirmer la résolution.

---

## 🚀 Semaine en cours : Avril 2026 - Semaine 15
*Dernière mise à jour : 10 avril 2026*

### ✅ Corrections prioritaires
- [x] Unification du typage `getAdminUser()` pour les routes de correction.
- [x] Ajout de logs d'audit sur la modification des notes par les admins.
- [ ] *En cours* : Résolution du décalage de timer lors du passage en mode économie d'énergie sur mobile.

---

> [!NOTE]
> Avant de modifier une logique de score, veuillez toujours créer un test d'intégration dans `tests/api/exams` pour valider que le barème est respecté.
