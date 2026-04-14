import { PRInfo, RepoConfig } from "./types";

const BASE_URL = "https://api.github.com";
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(): void {
  cache.clear();
}

async function ghFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "PRison-VSCode-Extension",
    },
  });
  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText} for ${path}`,
    );
  }
  return response.json() as Promise<T>;
}

export async function getMyOpenPRs(
  repo: RepoConfig,
  username: string,
  token: string,
): Promise<PRInfo[]> {
  const key = `open-prs:${repo.owner}/${repo.repo}:${username}`;
  const cached = getCached<PRInfo[]>(key);
  if (cached) return cached;

  interface GhPR {
    number: number;
    title: string;
    html_url: string;
    user: { login: string };
    created_at: string;
    draft: boolean;
  }

  const prs = await ghFetch<GhPR[]>(
    `/repos/${repo.owner}/${repo.repo}/pulls?state=open&per_page=100`,
    token,
  );

  const myPRs = prs.filter((pr) => pr.user.login === username);

  const prInfos: PRInfo[] = await Promise.all(
    myPRs.map(async (pr) => {
      const threads = await getUnresolvedThreadCount(repo, pr.number, token);
      const reviewState = await getMyPRReviewState(repo, pr.number, token);
      return {
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        author: pr.user.login,
        createdAt: new Date(pr.created_at),
        repo: `${repo.owner}/${repo.repo}`,
        unresolvedThreads: threads,
        isDraft: pr.draft,
        reviewState,
      };
    }),
  );

  setCached(key, prInfos);
  return prInfos;
}

export async function getMyPendingReviews(
  repo: RepoConfig,
  username: string,
  token: string,
): Promise<PRInfo[]> {
  const key = `pending-reviews:${repo.owner}/${repo.repo}:${username}`;
  const cached = getCached<PRInfo[]>(key);
  if (cached) return cached;

  interface GhPR {
    number: number;
    title: string;
    html_url: string;
    user: { login: string };
    created_at: string;
    draft: boolean;
    requested_reviewers: { login: string }[];
  }

  const prs = await ghFetch<GhPR[]>(
    `/repos/${repo.owner}/${repo.repo}/pulls?state=open&per_page=100`,
    token,
  );

  const reviewRequested = prs.filter(
    (pr) =>
      pr.user.login !== username &&
      pr.requested_reviewers.some((r) => r.login === username),
  );

  const prInfos: PRInfo[] = reviewRequested.map((pr) => ({
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    author: pr.user.login,
    createdAt: new Date(pr.created_at),
    repo: `${repo.owner}/${repo.repo}`,
    unresolvedThreads: 0,
    isDraft: pr.draft,
  }));

  setCached(key, prInfos);
  return prInfos;
}

async function getUnresolvedThreadCount(
  repo: RepoConfig,
  prNumber: number,
  token: string,
): Promise<number> {
  const key = `threads:${repo.owner}/${repo.repo}:${prNumber}`;
  const cached = getCached<number>(key);
  if (cached !== null) return cached;

  try {
    interface GhReviewComment {
      in_reply_to_id?: number;
      pull_request_review_id: number | null;
    }
    const comments = await ghFetch<GhReviewComment[]>(
      `/repos/${repo.owner}/${repo.repo}/pulls/${prNumber}/comments?per_page=100`,
      token,
    );
    // Count top-level comments (no in_reply_to_id) as thread starts.
    // Approximation — GitHub's review thread resolution isn't in REST v3.
    const topLevel = comments.filter((c) => !c.in_reply_to_id).length;
    setCached(key, topLevel);
    return topLevel;
  } catch {
    return 0;
  }
}

async function getMyPRReviewState(
  repo: RepoConfig,
  prNumber: number,
  token: string,
): Promise<"APPROVED" | "CHANGES_REQUESTED" | "PENDING"> {
  try {
    interface GhReview {
      state: string;
      submitted_at: string;
    }
    const reviews = await ghFetch<GhReview[]>(
      `/repos/${repo.owner}/${repo.repo}/pulls/${prNumber}/reviews?per_page=100`,
      token,
    );
    if (reviews.length === 0) return "PENDING";
    const latest = reviews[reviews.length - 1];
    if (latest.state === "APPROVED") return "APPROVED";
    if (latest.state === "CHANGES_REQUESTED") return "CHANGES_REQUESTED";
    return "PENDING";
  } catch {
    return "PENDING";
  }
}

export function getPRAgeDays(pr: PRInfo): number {
  return Math.floor(
    (Date.now() - pr.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );
}
