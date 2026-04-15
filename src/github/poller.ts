import * as vscode from "vscode";
import { getGitHubToken, getAuthenticatedUser } from "./auth";
import {
  getMyOpenPRs,
  getMyPendingReviews,
  getAlreadyReviewedPRs,
} from "./api";
import { parseRepo, RepoConfig } from "./types";
import { buildShameReport } from "../shame/engine";
import { ShameReport } from "../shame/types";
import { getConfig } from "../config";

export type PollErrorKind = "authRequired" | "noRepos" | "error";
export interface PollError {
  kind: PollErrorKind;
  message?: string;
}

export class PRPoller implements vscode.Disposable {
  private timer: NodeJS.Timeout | null = null;
  private _currentReport: ShameReport | null = null;
  private _onShameUpdated = new vscode.EventEmitter<ShameReport>();
  private _onPollError = new vscode.EventEmitter<PollError>();
  private polling = false;

  readonly onShameUpdated = this._onShameUpdated.event;
  readonly onPollError = this._onPollError.event;

  private username: string | null = null;

  async start(): Promise<void> {
    await this.poll();
    this.scheduleNext();
  }

  get currentReport(): ShameReport | null {
    return this._currentReport;
  }

  private scheduleNext(): void {
    const config = getConfig();
    const intervalMs = config.pollingInterval * 60 * 1000;
    this.timer = setTimeout(async () => {
      await this.poll();
      this.scheduleNext();
    }, intervalMs);
  }

  async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const token = await getGitHubToken();
      if (!token) {
        this._onPollError.fire({ kind: "authRequired" });
        return;
      }

      if (!this.username) {
        this.username = await getAuthenticatedUser(token);
        if (!this.username) {
          this._onPollError.fire({ kind: "authRequired" });
          return;
        }
      }

      const repos = await this.getRepos();
      if (repos.length === 0) {
        this._onPollError.fire({ kind: "noRepos" });
        return;
      }

      const [allMyPRs, allPendingReviews, allReviewedByMe] = await Promise.all([
        Promise.all(repos.map((r) => getMyOpenPRs(r, this.username!, token))),
        Promise.all(
          repos.map((r) =>
            getMyPendingReviews(
              r,
              this.username!,
              token,
              getConfig().requiredApprovals,
            ),
          ),
        ),
        Promise.all(
          repos.map((r) =>
            getAlreadyReviewedPRs(
              r,
              this.username!,
              token,
              getConfig().requiredApprovals,
            ),
          ),
        ),
      ]);

      const report = buildShameReport(
        allMyPRs.flat(),
        allPendingReviews.flat(),
        allReviewedByMe.flat(),
      );
      this._currentReport = report;
      this._onShameUpdated.fire(report);
    } catch (err) {
      console.error("PRison polling error:", err);
      this._onPollError.fire({ kind: "error", message: String(err) });
    } finally {
      this.polling = false;
    }
  }

  private async getRepos(): Promise<RepoConfig[]> {
    const config = getConfig();

    if (config.repos.length > 0) {
      return config.repos
        .map((r) => parseRepo(r))
        .filter((r): r is RepoConfig => r !== null);
    }

    return await this.detectReposFromGit();
  }

  private async detectReposFromGit(): Promise<RepoConfig[]> {
    try {
      const gitExtension = vscode.extensions.getExtension("vscode.git");
      if (!gitExtension) return [];
      const git = gitExtension.exports.getAPI(1);
      const repos: RepoConfig[] = [];

      for (const repo of git.repositories) {
        const remotes = repo.state.remotes;
        for (const remote of remotes) {
          const url = remote.fetchUrl || remote.pushUrl || "";
          const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
          if (match) {
            repos.push({ owner: match[1], repo: match[2] });
            break;
          }
        }
      }

      return repos;
    } catch {
      return [];
    }
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._onShameUpdated.dispose();
    this._onPollError.dispose();
  }
}
