import { PRInfo } from "../github/types";
import { ShameLevel, ShameReport } from "./types";
import { getPRAgeDays } from "../github/api";

export function buildShameReport(
  myOpenPRs: PRInfo[],
  pendingReviews: PRInfo[],
): ShameReport {
  const nonDraftPRs = myOpenPRs.filter((pr) => !pr.isDraft);
  const totalUnresolvedThreads = nonDraftPRs.reduce(
    (sum, pr) => sum + pr.unresolvedThreads,
    0,
  );
  const oldestPRAgeDays =
    nonDraftPRs.length > 0 ? Math.max(...nonDraftPRs.map(getPRAgeDays)) : 0;

  const shameLevel = calculateShameLevel(
    nonDraftPRs.length,
    pendingReviews.length,
    totalUnresolvedThreads,
    oldestPRAgeDays,
  );

  return {
    myOpenPRs,
    pendingReviews,
    totalUnresolvedThreads,
    oldestPRAgeDays,
    shameLevel,
    updatedAt: new Date(),
  };
}

function calculateShameLevel(
  openPRs: number,
  pendingReviews: number,
  unresolvedThreads: number,
  oldestDays: number,
): ShameLevel {
  let score = 0;

  score += openPRs * 2;
  score += pendingReviews * 3;
  // Unresolved threads carry high weight — you left people hanging
  score += unresolvedThreads * 4;

  if (oldestDays >= 7) score += 10;
  else if (oldestDays >= 3) score += 5;
  else if (oldestDays >= 1) score += 2;

  if (score === 0) return ShameLevel.CLEAN;
  if (score <= 5) return ShameLevel.MILD;
  if (score <= 15) return ShameLevel.MODERATE;
  if (score <= 30) return ShameLevel.SEVERE;
  return ShameLevel.CRITICAL;
}

export function shameLevelToThreshold(level: ShameLevel): string {
  switch (level) {
    case ShameLevel.CLEAN:
      return "clean";
    case ShameLevel.MILD:
      return "mild";
    case ShameLevel.MODERATE:
      return "moderate";
    case ShameLevel.SEVERE:
      return "severe";
    case ShameLevel.CRITICAL:
      return "critical";
  }
}

export function shouldShowOverlay(
  report: ShameReport,
  configThreshold: string,
): boolean {
  const thresholdLevel = thresholdToShameLevel(configThreshold);
  return report.shameLevel >= thresholdLevel;
}

function thresholdToShameLevel(threshold: string): ShameLevel {
  switch (threshold) {
    case "mild":
      return ShameLevel.MILD;
    case "moderate":
      return ShameLevel.MODERATE;
    case "severe":
      return ShameLevel.SEVERE;
    default:
      return ShameLevel.MILD;
  }
}
