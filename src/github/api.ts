import { PRInfo, RepoConfig } from "./types";

const BASE_URL = "https://api.github.com";
const GRAPHQL_URL = "https://api.github.com/graphql";
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

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
  inFlight.clear();
}

async function deduped<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, promise as Promise<unknown>);
  return promise;
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

async function ghGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "PRison-VSCode-Extension",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(
      `GitHub GraphQL error: ${response.status} ${response.statusText}`,
    );
  }
  const json = (await response.json()) as { data: T; errors?: unknown[] };
  if (json.errors) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

interface PRGraphQLData {
  unresolvedThreads: number;
  approvals: number;
  reviewState: "APPROVED" | "CHANGES_REQUESTED" | "PENDING";
  reviews: Array<{ reviewer: string; state: string }>;
}

const GRAPHQL_PR_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes { isResolved }
        }
        reviews(first: 100) {
          nodes {
            state
            submittedAt
            author { login }
          }
        }
      }
    }
  }
`;

async function getPRGraphQLData(
  repo: RepoConfig,
  prNumber: number,
  token: string,
): Promise<PRGraphQLData> {
  const key = `graphql:${repo.owner}/${repo.repo}:${prNumber}`;
  const cached = getCached<PRGraphQLData>(key);
  if (cached !== null) return cached;

  return deduped(key, async () => {
    try {
      interface GQLResponse {
        repository: {
          pullRequest: {
            reviewThreads: { nodes: { isResolved: boolean }[] };
            reviews: {
              nodes: Array<{
                state: string;
                submittedAt: string;
                author: { login: string } | null;
              }>;
            };
          };
        };
      }

      const data = await ghGraphQL<GQLResponse>(
        GRAPHQL_PR_QUERY,
        { owner: repo.owner, repo: repo.repo, number: prNumber },
        token,
      );

      const pr = data.repository.pullRequest;
      const unresolvedThreads = pr.reviewThreads.nodes.filter(
        (t) => !t.isResolved,
      ).length;

      // Sort by submission time ascending, then compute latest decision per reviewer
      const sorted = [...pr.reviews.nodes].sort(
        (a, b) =>
          new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
      );

      const latestByUser = new Map<string, string>();
      for (const review of sorted) {
        if (!review.author) continue; // deleted account
        const login = review.author.login;
        switch (review.state) {
          case "APPROVED":
          case "CHANGES_REQUESTED":
            latestByUser.set(login, review.state);
            break;
          case "DISMISSED":
            latestByUser.delete(login); // dismissed clears the decision
            break;
          // COMMENTED: no change to reviewer's decision state
        }
      }

      const approvals = Array.from(latestByUser.values()).filter(
        (s) => s === "APPROVED",
      ).length;
      const hasChangesRequested = Array.from(latestByUser.values()).some(
        (s) => s === "CHANGES_REQUESTED",
      );
      const reviewState: "APPROVED" | "CHANGES_REQUESTED" | "PENDING" =
        hasChangesRequested
          ? "CHANGES_REQUESTED"
          : approvals > 0
            ? "APPROVED"
            : "PENDING";

      const reviews = Array.from(latestByUser.entries()).map(
        ([reviewer, state]) => ({ reviewer, state }),
      );

      const result: PRGraphQLData = {
        unresolvedThreads,
        approvals,
        reviewState,
        reviews,
      };
      setCached(key, result);
      return result;
    } catch {
      return {
        unresolvedThreads: 0,
        approvals: 0,
        reviewState: "PENDING",
        reviews: [],
      };
    }
  });
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
      const { unresolvedThreads, approvals, reviewState } =
        await getPRGraphQLData(repo, pr.number, token);
      return {
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        author: pr.user.login,
        createdAt: new Date(pr.created_at),
        repo: `${repo.owner}/${repo.repo}`,
        unresolvedThreads,
        approvals,
        isDraft: pr.draft,
        reviewState,
      };
    }),
  );

  setCached(key, prInfos);
  return prInfos;
}

interface EnrichedOtherPR extends PRInfo {
  reviewedByMe: boolean;
  myReviewState?: "APPROVED" | "CHANGES_REQUESTED";
}

async function fetchEnrichedOtherPRs(
  repo: RepoConfig,
  username: string,
  token: string,
): Promise<EnrichedOtherPR[]> {
  const key = `other-prs:${repo.owner}/${repo.repo}:${username}`;
  const cached = getCached<EnrichedOtherPR[]>(key);
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

  const candidates = prs.filter((pr) => pr.user.login !== username);

  const result: EnrichedOtherPR[] = await Promise.all(
    candidates.map(async (pr) => {
      const { unresolvedThreads, approvals, reviewState, reviews } =
        await getPRGraphQLData(repo, pr.number, token);

      const reviewedByMe = reviews.some(
        (r) => r.reviewer === username && r.state !== "COMMENTED",
      );
      const myState = reviews.find((r) => r.reviewer === username)?.state;
      const myReviewState =
        myState === "APPROVED" || myState === "CHANGES_REQUESTED"
          ? myState
          : undefined;

      return {
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        author: pr.user.login,
        createdAt: new Date(pr.created_at),
        repo: `${repo.owner}/${repo.repo}`,
        unresolvedThreads,
        approvals,
        isDraft: pr.draft,
        reviewState,
        reviewedByMe,
        myReviewState,
      };
    }),
  );

  setCached(key, result);
  return result;
}

export async function getMyPendingReviews(
  repo: RepoConfig,
  username: string,
  token: string,
  requiredApprovals: number,
): Promise<PRInfo[]> {
  const all = await fetchEnrichedOtherPRs(repo, username, token);
  return all
    .filter((pr) => !pr.reviewedByMe && pr.approvals < requiredApprovals)
    .map(({ reviewedByMe: _r, ...rest }) => rest);
}

export async function getAlreadyReviewedPRs(
  repo: RepoConfig,
  username: string,
  token: string,
  requiredApprovals: number,
): Promise<PRInfo[]> {
  const all = await fetchEnrichedOtherPRs(repo, username, token);
  return all
    .filter((pr) => pr.reviewedByMe || pr.approvals >= requiredApprovals)
    .map(({ reviewedByMe: _r, ...rest }) => rest);
}

export function getPRAgeDays(pr: { createdAt: Date }): number {
  return Math.floor(
    (Date.now() - pr.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );
}
