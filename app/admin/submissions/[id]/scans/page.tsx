import { redirect } from "next/navigation";

// Scan upload removed — Part 3 is now digital only (text input).
export default function ScansPage({ params }: { params: { id: string } }) {
  redirect(`/admin/submissions/${params.id}`);
}
