-- #255 — Immuabilité du code FSA : défense en profondeur côté base.
--
-- `Attestation.code` est FIGE. Il est imprimé sur un document officiel, cité
-- par le QR public et vérifiable par un tiers : le modifier, le régénérer ou le
-- renuméroter rendrait un document probant faux.
--
-- La présente migration est :
--   * ADDITIVE et IDEMPOTENTE (IF NOT EXISTS sur la fonction ET le trigger) ;
--   * NON DESTRUCTIVE : aucune ligne n'est lue ni modifiée — elle n'instancie
--     aucun garde sur les 40 attestations historiques, elle leur applique
--     simplement la règle à l'avenir ;
--   * SANS RUPTURE : seuls les UPDATE qui MODIFIENT `code` sont refusés. Les
--     mises à jour de statut, de sceau, de PDF ou de liens restent possibles.
--
-- Le message d'erreur contient le nom de l'exception applicative et NON la
-- valeur du code : ni journal, ni réponse HTTP ne peut divulguer un code.
--
-- Note de périmètre : la SUPPRESSION d'une attestation reste autorisée ici.
-- Elle est traitée au niveau applicatif (route admin auditée) car les
-- harnais de test (unitaires, e2e) suppriment les attestations qu'ils
-- créent ; un trigger bloquant toute suppression rendrait le nettoyage de
-- fixtures impossible sans contournement, ce qui serait un garde de moins.

CREATE OR REPLACE FUNCTION fsa_attestation_code_is_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."code" IS DISTINCT FROM OLD."code" THEN
        RAISE EXCEPTION
            'ATTESTATION_CODE_IMMUTABLE: Attestation.code est immuable (tentative de modification refusée)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "attestation_code_immutability" ON "Attestation";

CREATE TRIGGER "attestation_code_immutability"
    BEFORE UPDATE ON "Attestation"
    FOR EACH ROW
    EXECUTE FUNCTION fsa_attestation_code_is_immutable();

COMMENT ON TRIGGER "attestation_code_immutability" ON "Attestation" IS
    '#255 — Attestation.code est immuable : toute UPDATE modifiant le code est refusée par le serveur.';
