import ExamsContent from "./ExamsClient";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export default function AdminExamsPage() {
  return <ExamsContent />;
}
