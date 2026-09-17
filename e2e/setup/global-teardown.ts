/**
 * `globalTeardown` Playwright : restaure `tsconfig.json`, que `next dev` a
 * réécrit pendant le run E2E (issue #139).
 *
 * S'exécute après l'arrêt du `webServer`, y compris lorsque des tests ou le
 * `globalSetup` ont échoué. Voir `tsconfig-restore.ts` pour le mécanisme.
 */
import { restoreTsconfig } from "./tsconfig-restore";

export default async function globalTeardown(): Promise<void> {
  restoreTsconfig();
}
