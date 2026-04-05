import { getPublicUpcomingExams } from "@/lib/data-public";
import UpcomingExamsClient from "./upcoming-exams-client";

export async function UpcomingExams() {
  // Fetch from the high-performance data layer (Server-side)
  // Data is cached via "use cache" in getPublicUpcomingExams
  const exams = await getPublicUpcomingExams();

  // Pass to the interactive client component for countdowns
  return <UpcomingExamsClient initialExams={JSON.parse(JSON.stringify(exams))} />;
}
