import { getPublicFormations } from "@/lib/data-public";
import FormationsClient from "./FormationsClient";

export default async function PublicFormationsPage() {
  const formations = await getPublicFormations();

  return <FormationsClient initialFormations={JSON.parse(JSON.stringify(formations))} />;
}
