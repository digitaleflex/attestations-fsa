/**
 * In-memory store for OTP tracking (dev/admin only)
 */

type OTPRecord = {
  id: string;
  email: string;
  otp: string;
  type: "forget-password" | "email-verification" | "sign-in";
  sentAt: Date;
  delivered: boolean;
};

// In-memory store (resets on server restart)
const otpLogs: OTPRecord[] = [];

export function logOTP(
  email: string,
  otp: string,
  type: "forget-password" | "email-verification" | "sign-in" = "forget-password"
) {
  const record: OTPRecord = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    email,
    otp,
    type,
    sentAt: new Date(),
    delivered: true,
  };

  otpLogs.push(record);

  // Keep only last 100 entries
  if (otpLogs.length > 100) {
    otpLogs.splice(0, otpLogs.length - 100);
  }

  return record;
}

export function getOTPLogs(): OTPRecord[] {
  return [...otpLogs].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
}

export function clearOTPLogs() {
  otpLogs.length = 0;
}
