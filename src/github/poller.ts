import * as vscode from "vscode";
import { getGitHubToken, getAuthenticatedUser } from "./auth";
import { getMyOpenPRs, getMyPendingReviews } from "./api";
import { parseRepo, RepoConfig } from "./types";
import { buildShameReport } from "../shame/engine";
import { ShameReport } from "../shame/types";
import { getConfig } from "../config";

export class PRPoller implements vscode.Disposable {
  private timer: NodeJS.Timeout | null = null;
  private _currentReport: ShameReport | null = null;
  private _onShameUpdated = new vscode.EventEmitter<ShameReport>();
  readonly onShameUpdated = this._onShameUpdated.event;

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
    try {
      const token = await getGitHubToken();
      if (!token) return;

      if (!this.username) {
        this.username = await getAuthenticatedUser(token);
        if (!this.username) return;
      }

      const repos = await this.getRepos();
      if (repos.length === 0) return;

      const [allMyPRs, allPendingReviews] = await Promise.all([
        Promise.all(repos.map((r) => getMyOpenPRs(r, this.username!, token))),
        Promise.all(
          repos.map((r) => getMyPendingReviews(r, this.username!, token)),
        ),
      ]);

      const myOpenPRs = allMyPRs.flat();
      const pendingReviews = allPendingReviews.flat();

      const report = buildShameReport(myOpenPRs, pendingReviews);
      this._currentReport = report;
      this._onShameUpdated.fire(report);
    } catch (err) {
      console.error("PRison polling error:", err);
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
  }
}
