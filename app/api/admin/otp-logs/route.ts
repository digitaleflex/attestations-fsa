// app/api/admin/otp-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOTPLogs, clearOTPLogs } from "@/lib/otp-store";
import { getAdminUser } from "@/lib/auth";

/**
 * GET - Fetch all OTP logs
 * DELETE - Clear all OTP logs
 */
export async function GET(request: NextRequest) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const logs = getOTPLogs().map(log => ({
      ...log,
      otp: log.otp.substring(0, 2) + "****" // Masquer pour sécurité
    }));
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[OTP-LOGS] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    clearOTPLogs();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[OTP-LOGS] DELETE error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
