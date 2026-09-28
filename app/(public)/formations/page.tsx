import type { Metadata } from "next";
import { getPublicFormations } from "@/lib/data-public";
import FormationsClient from "./FormationsClient";

export const metadata: Metadata = {
  title: "Formations certifiantes",
  description:
    "Découvrez les formations en agriculture, pisciculture et élevage proposals par la Ferme Cité St André et envoyez une demande de préinscription.",
};

export default async function PublicFormationsPage() {
  const formations = await getPublicFormations();

  return <FormationsClient initialFormations={JSON.parse(JSON.stringify(formations))} />;
}
