import type { Metadata } from "next";
import UpcomingExamsClient from "@/components/upcoming-exams-client";
import { getPublicAllExams } from "@/lib/data-public";

export const metadata: Metadata = {
  title: "Examens et sessions d’examen",
  description:
    "Consultez les dates, durées et statuts des sessions d’examen publiques de la Ferme Cité St André.",
};

export default async function ExamensPage() {
  const exams = await getPublicAllExams();

  return (
    <UpcomingExamsClient initialExams={JSON.parse(JSON.stringify(exams))} />
  );
}
