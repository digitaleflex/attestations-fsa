# Gestion des Ressources

> ## ⚠️ Module retiré du produit — documentation conservée à titre d'historique
>
> Le module **Ressources pédagogiques** a été **retiré de la plateforme le
> 2026-06-22** par le commit **`960852f`** (suppression des modules Portfolio, Chat,
> Ressources pédagogiques, Waitlist et Annuaire — 44 fichiers, 5 348 lignes).
>
> État vérifié dans le code (réalignement du 2026-09-16, issue #86) :
>
> - **0 modèle Prisma** `Resource` (`prisma/schema.prisma` contient 22 modèles ;
>   les colonnes `resource`/`resourceId` visibles dans le schéma appartiennent à
>   `SecurityLog` et `AuditLog` et désignent une cible d'audit, pas des ressources
>   pédagogiques) ;
> - **0 route API** : `app/api/resources/` et `app/api/admin/resources/` n'existent
>   pas ;
> - **0 page** : `app/admin/resources/` et `app/(public)/ressources/` n'existent pas.
>
> L'ancienne version de ce document (qui annonçait des ressources « 75 % — en
> production » avec quatre fichiers clés « implémentés ») était **intégralement
> fausse** vis-à-vis du code actuel et a été retirée. Elle reste consultable dans
> l'historique Git (`git log --follow -- docs/resources-management/01-ressources.md`).
>
> La suppression définitive de ce fichier est suspendue à l'arbitrage **#159**, qui
> n'est pas encore validé par un humain.
