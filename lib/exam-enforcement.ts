import { prisma } from "@/lib/prisma";

export interface EnforcementAction {
  lockAnswers: boolean;
  forceSubmit: boolean;
  warnUser: boolean;
  reason?: string;
}

/**
 * Évalue les événements de monitoring et décide des actions à prendre.
 * Appelé côté serveur après chaque report d'événements.
 */
export async function evaluateEnforcement(
  examId: string,
  userId: string,
): Promise<EnforcementAction> {
  const recentEvents = await prisma.securityLog.findMany({
    where: {
      userId,
      resourceId: examId,
      eventType: "EXAM_MONITORING",
      timestamp: { gte: new Date(Date.now() - 3600_000) },
    },
    select: { action: true, timestamp: true },
    orderBy: { timestamp: "desc" },
  });

  const tabSwitches = recentEvents.filter((e) => e.action === "VISIBILITY_CHANGE").length;
  const blurCount = recentEvents.filter((e) => e.action === "BLUR").length;
  const totalSuspicious = tabSwitches + blurCount;

  const action: EnforcementAction = {
    lockAnswers: false,
    forceSubmit: false,
    warnUser: false,
  };

  if (totalSuspicious >= 10) {
    action.lockAnswers = true;
    action.forceSubmit = true;
    action.reason = "Trop d'activités suspectes (changements d'onglet / pertes de focus). Examen verrouillé et soumis automatiquement.";
  } else if (totalSuspicious >= 5) {
    action.lockAnswers = true;
    action.warnUser = true;
    action.reason = "Attention : comportement suspect détecté. Les réponses sont verrouillées.";
  } else if (totalSuspicious >= 3) {
    action.warnUser = true;
    action.reason = "Avertissement : changement d'onglet détecté. Cela peut entraîner le verrouillage de l'examen.";
  }

  return action;
}

/**
 * Loggue une décision d'enforcement dans SecurityLog
 */
export async function logEnforcement(
  examId: string,
  userId: string,
  action: EnforcementAction,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  await prisma.securityLog.create({
    data: {
      eventType: "ENFORCEMENT_ACTION",
      userId,
      ipAddress,
      userAgent,
      resource: "exam_session",
      resourceId: examId,
      action: action.forceSubmit ? "FORCE_SUBMIT" : action.lockAnswers ? "LOCK_ANSWERS" : "WARNING",
      status: "ENFORCED",
      severity: action.forceSubmit ? "CRITICAL" : action.lockAnswers ? "HIGH" : "MEDIUM",
      details: { reason: action.reason },
    },
  });
}
