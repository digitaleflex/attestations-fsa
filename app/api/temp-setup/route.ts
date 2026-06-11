import { NextResponse } from "next/server";

// This endpoint has been disabled for security reasons.
// To delete: rm -rf app/api/temp-setup
export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
