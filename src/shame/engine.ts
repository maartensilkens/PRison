import { PRInfo } from "../github/types";
import { ShameLevel, ShameReport } from "./types";

const SHAME_THRESHOLD = 1;

export function ownPRsNeedingAction(myOpenPRs: PRInfo[]): PRInfo[] {
  return myOpenPRs.filter(
    (pr) =>
      !pr.isDraft &&
      (pr.unresolvedThreads > 0 || pr.reviewState === "CHANGES_REQUESTED"),
  );
}

export function buildShameReport(
  myOpenPRs: PRInfo[],
  pendingReviews: PRInfo[],
  reviewedByMe: PRInfo[],
): ShameReport {
  const actionRequired = ownPRsNeedingAction(myOpenPRs);
  const reviewableNow = pendingReviews.filter(
    (pr) => pr.unresolvedThreads === 0,
  );
  const attentionCount = actionRequired.length + reviewableNow.length;
  const shameLevel = attentionCount >= SHAME_THRESHOLD ? ShameLevel.SHAMED : ShameLevel.CLEAN;

  return {
    myOpenPRs,
    pendingReviews,
    reviewedByMe,
    attentionCount,
    shameLevel,
    updatedAt: new Date(),
  };
}

export function shouldShowOverlay(report: ShameReport): boolean {
  return report.shameLevel >= ShameLevel.SHAMED;
}
