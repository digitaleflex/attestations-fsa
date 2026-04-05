import { getPublicResources } from "@/lib/data-public";
import ResourcesClient from "./ResourcesClient";

export default async function RessourcesPage() {
  const resources = await getPublicResources();

  return <ResourcesClient initialResources={JSON.parse(JSON.stringify(resources))} />;
}
