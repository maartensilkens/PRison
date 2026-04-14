import { PRInfo } from "../github/types";

export enum ShameLevel {
  CLEAN = 0,
  MILD = 1,
  MODERATE = 2,
  SEVERE = 3,
  CRITICAL = 4,
}

export interface ShameReport {
  myOpenPRs: PRInfo[];
  pendingReviews: PRInfo[];
  totalUnresolvedThreads: number;
  oldestPRAgeDays: number;
  shameLevel: ShameLevel;
  updatedAt: Date;
}
