export interface PRInfo {
  number: number;
  title: string;
  url: string;
  author: string;
  createdAt: Date;
  repo: string;
  unresolvedThreads: number;
  isDraft: boolean;
  reviewState?: "APPROVED" | "CHANGES_REQUESTED" | "PENDING";
  myReviewState?: "APPROVED" | "CHANGES_REQUESTED";
  approvals: number;
}

export interface ReviewRequest {
  pr: PRInfo;
  requestedAt: Date;
}

export interface RepoConfig {
  owner: string;
  repo: string;
}

export function parseRepo(repoString: string): RepoConfig | null {
  const parts = repoString.split("/");
  if (parts.length !== 2) return null;
  return { owner: parts[0], repo: parts[1] };
}
