import { getPublicFormations } from "@/lib/data-public";
import FormInscription from "./FormInscription";

export default async function InscriptionPage() {
  const formations = await getPublicFormations();
  return <FormInscription formations={formations} />;
}
