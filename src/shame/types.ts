import { PRInfo } from "../github/types";

export enum ShameLevel {
  CLEAN = 0,
  SHAMED = 1,
}

export interface ShameReport {
  myOpenPRs: PRInfo[];
  pendingReviews: PRInfo[];
  reviewedByMe: PRInfo[];
  attentionCount: number;
  shameLevel: ShameLevel;
  updatedAt: Date;
}
