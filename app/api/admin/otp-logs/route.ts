// app/api/admin/otp-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOTPLogs, clearOTPLogs } from "@/lib/otp-store";
import { isAdminAuthenticated } from "@/lib/auth";

/**
 * GET - Fetch all OTP logs
 * DELETE - Clear all OTP logs
 */
export async function GET(request: NextRequest) {
  try {
    const adminAuthed = await isAdminAuthenticated(request);
    if (!adminAuthed) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const logs = getOTPLogs();
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[OTP-LOGS] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminAuthed = await isAdminAuthenticated(request);
    if (!adminAuthed) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    clearOTPLogs();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[OTP-LOGS] DELETE error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
