import * as vscode from "vscode";
import { PRPoller } from "./github/poller";
import { BranchWatcher } from "./git/watcher";
import { ShameStatusBar } from "./ui/statusBar";
import { SidebarViewProvider } from "./ui/sidebarView";
import { showShameOverlay } from "./ui/overlay";
import { shouldShowOverlay } from "./shame/engine";
import { ShameLevel } from "./shame/types";
import { getRandomMessage } from "./messages/memes";
import { getConfig } from "./config";
import { clearCache } from "./github/api";
import { clearTokenCache } from "./github/auth";
import { TerminalBlocker } from "./terminal/blocker";

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = getConfig();
  if (!config.enabled) return;

  const poller = new PRPoller();
  const branchWatcher = new BranchWatcher();
  const statusBar = new ShameStatusBar();
  const sidebarProvider = new SidebarViewProvider();
  context.subscriptions.push(poller, branchWatcher, statusBar, sidebarProvider);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "prison.sidebar",
      sidebarProvider,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("prison.showOverlay", async () => {
      const report = poller.currentReport;
      if (report) {
        await showShameOverlay(context, report);
      } else {
        vscode.window.showInformationMessage(
          "PRison: No data yet — still checking your PRs...",
        );
      }
    }),

    vscode.commands.registerCommand("prison.checkPRs", async () => {
      vscode.window.showInformationMessage("PRison: Checking your PRs... 🔍");
      await poller.poll();
      vscode.window.showInformationMessage("PRison: Done checking!");
    }),

    vscode.commands.registerCommand("prison.clearCache", () => {
      clearCache();
      clearTokenCache();
      vscode.window.showInformationMessage("PRison: Cache cleared 🧹");
    }),

    vscode.commands.registerCommand("prison.openPR", (url: string) => {
      if (/^https:\/\/github\.com\//.test(url)) {
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
    }),

    vscode.commands.registerCommand("prison.demo", async () => {
      const mockReport = {
        myOpenPRs: [
          {
            number: 142,
            title: "Add authentication module",
            url: "https://github.com/example/repo/pull/142",
            author: "you",
            createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            repo: "example/repo",
            unresolvedThreads: 7,
            isDraft: false,
            reviewState: "CHANGES_REQUESTED" as const,
            approvals: 0,
          },
          {
            number: 138,
            title: "Fix login bug",
            url: "https://github.com/example/repo/pull/138",
            author: "you",
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            repo: "example/repo",
            unresolvedThreads: 2,
            isDraft: false,
            reviewState: "PENDING" as const,
            approvals: 1,
          },
        ],
        pendingReviews: [
          {
            number: 141,
            title: "Update dependencies",
            url: "https://github.com/example/repo/pull/141",
            author: "teammate",
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            repo: "example/repo",
            unresolvedThreads: 0,
            isDraft: false,
            reviewState: "PENDING" as const,
            approvals: 0,
          },
        ],
        attentionCount: 3,
        reviewedByMe: [],
        shameLevel: ShameLevel.SHAMED,
        updatedAt: new Date(),
      };
      await showShameOverlay(context, mockReport);
    }),
  );

  poller.onShameUpdated((report) => {
    statusBar.update(report);
    sidebarProvider.update(report);
  });

  poller.onPollError((err) => {
    if (err.kind === "authRequired") sidebarProvider.setAuthRequired();
    else if (err.kind === "noRepos") sidebarProvider.setNoRepos();
    else sidebarProvider.setError(err.message ?? "Unknown error");
  });

  if (config.blockTerminal) {
    const blocker = new TerminalBlocker(
      () => poller.currentReport?.shameLevel ?? ShameLevel.CLEAN,
      () => {
        const report = poller.currentReport;
        if (report) showShameOverlay(context, report);
      },
    );
    context.subscriptions.push(blocker);
  }

  branchWatcher.onBranchChange(async () => {
    if (!config.overlayOnBranchChange) return;
    const report = poller.currentReport;
    if (!report) return;
    if (shouldShowOverlay(report)) {
      await showShameOverlay(context, report);
    }
  });

  await branchWatcher.initialize();

  // First poll triggers startup check; subsequent polls just update state
  let firstPoll = true;
  const startupDisposable = poller.onShameUpdated(async (report) => {
    if (!firstPoll) return;
    firstPoll = false;

    if (config.overlayOnStartup && shouldShowOverlay(report)) {
      await showShameOverlay(context, report);
    } else if (report.shameLevel === ShameLevel.CLEAN) {
      const message = getRandomMessage("boss_slain", { report });
      vscode.window.showInformationMessage(`PRison: ${message}`);
    }

    startupDisposable.dispose();
  });
  context.subscriptions.push(startupDisposable);

  await poller.start();
}

export function deactivate(): void {
  // Disposables are handled via context.subscriptions
}
