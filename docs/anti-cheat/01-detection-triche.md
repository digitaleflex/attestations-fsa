# Anti-Cheat (Détection de Triche)

## Description

Système de détection de comportements suspects lors des examens en ligne.

## Fonctionnalités implémentées

### 1. Analyse des réponses

- Comparaison des réponses entre candidats
- Détection des réponses identiques (100%)
- Calcul de similarité (Indice de Jaccard)

### 2. Types de détections

- IDENTICAL_ANSWERS : Réponses rigoureusement identiques
- ANSWER_PATTERN_MATCH : Similarité > 90%
- RAPID_SUBMISSION : Soumission trop rapide
- SUSPICIOUS_TIMING : Timing suspect
- STATISTICAL_ANOMALY : Anomalie statistique

### 3. Niveaux de sévérité

- LOW : A surveiller
- MEDIUM : Suspect
- HIGH : Très suspect
- CRITICAL : Très probablement triche

### 4. Journalisation

- Enregistrement dans SecurityLog
- Détails de la détection
- Score de confiance

## Niveau d'avancement

**70%** - Partiellement implémenté (analyse côté serveur)

## Fichiers clés

- `lib/anti-cheat.ts` - Logique principale
- `app/api/exams/[id]/submit/route.ts` - Intégration lors soumission

## Limitations actuelles

- Pas de détection côté client (changement de onglet)
- Pas de capture d'écran
- Pas de surveillance webcam

## Suggestions d'amélioration

1. Intégrer une librairie de détection de fraude ( ProctorU, Examity)
2. Ajouter la détection de changement de fenêtre/onglet
3. Implémenter la capture d'écran périodique
4. Ajouter un système de lock de navigateur (SecureExam Browser)
5. Surveillance webcam avec détection de présence
