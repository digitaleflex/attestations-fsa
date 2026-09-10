import { getPublicAllExams } from "@/lib/data-public";
import UpcomingExamsClient from "@/components/upcoming-exams-client";

export default async function ExamensPage() {
  const exams = await getPublicAllExams();
  return <UpcomingExamsClient initialExams={JSON.parse(JSON.stringify(exams))} />;
}
