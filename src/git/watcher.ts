import * as vscode from "vscode";

interface BranchChangeEvent {
  previousBranch: string | null;
  currentBranch: string | null;
  isNewBranch: boolean;
}

type BranchChangeHandler = (event: BranchChangeEvent) => void;

export class BranchWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private previousBranch: string | null = null;
  private knownBranches: Set<string> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;
  private handlers: BranchChangeHandler[] = [];

  onBranchChange(handler: BranchChangeHandler): vscode.Disposable {
    this.handlers.push(handler);
    return {
      dispose: () => {
        this.handlers = this.handlers.filter((h) => h !== handler);
      },
    };
  }

  async initialize(): Promise<void> {
    try {
      const gitExtension = vscode.extensions.getExtension("vscode.git");
      if (!gitExtension) {
        console.warn("PRison: VS Code git extension not found");
        return;
      }

      if (!gitExtension.isActive) {
        await gitExtension.activate();
      }

      const git = gitExtension.exports.getAPI(1);

      for (const repo of git.repositories) {
        this.watchRepo(repo);
      }

      const repoWatcher = git.onDidOpenRepository((repo: unknown) => {
        this.watchRepo(repo);
      });
      this.disposables.push(repoWatcher);
    } catch (err) {
      console.error("PRison: Failed to initialize branch watcher:", err);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private watchRepo(repo: any): void {
    const disposable = repo.state.onDidChange(() => {
      this.handleStateChange(repo);
    });
    this.disposables.push(disposable);

    if (repo.state.HEAD?.name) {
      this.previousBranch = repo.state.HEAD.name;
      this.knownBranches.add(repo.state.HEAD.name);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleStateChange(repo: any): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const currentBranch = repo.state.HEAD?.name ?? null;

      if (currentBranch === this.previousBranch) return;

      const isNewBranch =
        currentBranch !== null && !this.knownBranches.has(currentBranch);

      if (currentBranch) {
        this.knownBranches.add(currentBranch);
      }

      const event: BranchChangeEvent = {
        previousBranch: this.previousBranch,
        currentBranch,
        isNewBranch,
      };

      this.previousBranch = currentBranch;

      for (const handler of this.handlers) {
        handler(event);
      }
    }, 500);
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
