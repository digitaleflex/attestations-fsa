/**
 * Test script for email service - OTP password reset
 * Usage: npx tsx test-email.ts
 */

// Load env - load both .env and .env.local
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { emailService } from "./lib/email";

const TEST_EMAIL = process.env.TEST_EMAIL || "";
const TEST_NAME = "Utilisateur Test";
const TEST_OTP = "482916";

async function main() {
  if (!TEST_EMAIL) {
    console.error("❌ TEST_EMAIL not set in .env.local");
    console.log("\n💡 Add this to your .env.local:");
    console.log('TEST_EMAIL="your-email@example.com"');
    process.exit(1);
  }

  console.log("🧪 Testing email service...");
  console.log(`🔑 RESEND_API_KEY: ${process.env.RESEND_API_KEY?.substring(0, 8)}***`);
  console.log(`📧 To: ${TEST_EMAIL}`);
  console.log(`👤 Name: ${TEST_NAME}`);
  console.log(`🔢 OTP: ${TEST_OTP}`);
  console.log("");

  const result = await emailService.sendPasswordResetOTP(
    TEST_EMAIL,
    TEST_NAME,
    TEST_OTP
  );

  // Also log to otp-store
  if (result.success) {
    try {
      const { logOTP } = await import("./lib/otp-store");
      logOTP(TEST_EMAIL, TEST_OTP, "forget-password");
    } catch {}
  }

  if (result.success) {
    console.log("✅ Email sent successfully!");
    console.log("📬 Check your inbox (and spam folder)");
  } else {
    console.log("❌ Email failed to send");
    console.log("Error:", result.error);
  }
}

main().catch((err) => {
  console.error("💥 Unhandled error:", err);
  process.exit(1);
});
