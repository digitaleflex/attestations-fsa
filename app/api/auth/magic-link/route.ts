// app/api/auth/magic-link/route.ts
// GET endpoint: validates magic link token, creates session, redirects
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { customAlphabet } from "nanoid";
import { cookies } from "next/headers";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const redirectPath = searchParams.get("redirect") || "/dashboard";

    if (!token || token.length < 20) {
      return NextResponse.redirect(new URL("/auth?error=invalid", request.url));
    }

    // Hash the incoming token and look it up
    const tokenHash = hashToken(token);

    const verification = await prisma.verification.findFirst({
      where: {
        identifier: { startsWith: "magic-link:" },
        value: tokenHash,
        expiresAt: { gte: new Date() },
      },
    });

    if (!verification) {
      return NextResponse.redirect(
        new URL(
          "/auth?error=Lien expiré ou invalide. Demandez un nouveau lien.",
          request.url,
        ),
      );
    }

    // Extract email from identifier
    const email = verification.identifier.replace("magic-link:", "");

    // Single use: delete immediately
    await prisma.verification.delete({ where: { id: verification.id } });

    // Find or create user (default role = "user", never admin from this flow)
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: email.split("@")[0],
          role: "user",
        },
      });
    }

    // Refuse admin login via magic link — redirect to /admin/login
    if (user.role?.toLowerCase() === "admin") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    // Create session (same pattern as fsa-login)
    const sessionToken = customAlphabet(
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      40,
    )();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
        userAgent: request.headers.get("user-agent") || null,
        ipAddress: request.headers.get("x-forwarded-for") || null,
      },
    });

    // Set session cookie
    const cookieStore = await cookies();
    const cookieName =
      process.env.NODE_ENV === "production"
        ? "__Secure-better-auth.session_token"
        : "better-auth.session_token";

    cookieStore.set(cookieName, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: session.expiresAt,
      path: "/",
    });

    // Redirect to the intended page
    const safeRedirect = redirectPath.startsWith("/")
      ? redirectPath
      : "/dashboard";
    return NextResponse.redirect(new URL(safeRedirect, request.url));
  } catch (error) {
    console.error("[MAGIC-LINK] Fatal error:", error);
    return NextResponse.redirect(
      new URL("/auth?error=Une erreur est survenue.", request.url),
    );
  }
}
