import * as vscode from "vscode";
import { PRPoller } from "./github/poller";
import { BranchWatcher } from "./git/watcher";
import { ShameStatusBar } from "./ui/statusBar";
import { ShameTreeProvider } from "./ui/treeView";
import { showShameOverlay } from "./ui/overlay";
import { shouldShowOverlay } from "./shame/engine";
import { ShameLevel } from "./shame/types";
import { getRandomMessage } from "./messages/memes";
import { getConfig } from "./config";
import { clearCache } from "./github/api";
import { clearTokenCache } from "./github/auth";

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = getConfig();
  if (!config.enabled) return;

  const poller = new PRPoller();
  const branchWatcher = new BranchWatcher();
  const statusBar = new ShameStatusBar();
  const treeProvider = new ShameTreeProvider();

  context.subscriptions.push(poller, branchWatcher, statusBar);

  const treeView = vscode.window.createTreeView("prison.shameTree", {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(treeView);

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
      vscode.env.openExternal(vscode.Uri.parse(url));
    }),

    vscode.commands.registerCommand("prison.demo", async () => {
      const { ShameLevel } = await import("./shame/types");
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
          },
        ],
        totalUnresolvedThreads: 9,
        oldestPRAgeDays: 8,
        shameLevel: ShameLevel.CRITICAL,
        updatedAt: new Date(),
      };
      await showShameOverlay(context, mockReport);
    }),
  );

  poller.onShameUpdated((report) => {
    statusBar.update(report);
    treeProvider.update(report);
  });

  branchWatcher.onBranchChange(async () => {
    if (!config.overlayOnBranchChange) return;

    const report = poller.currentReport;
    if (!report) return;

    if (shouldShowOverlay(report, config.shameThreshold)) {
      await showShameOverlay(context, report);
    }
  });

  await branchWatcher.initialize();

  // First poll triggers startup check; subsequent polls just update state
  let firstPoll = true;
  const startupDisposable = poller.onShameUpdated(async (report) => {
    if (!firstPoll) return;
    firstPoll = false;

    if (
      config.overlayOnStartup &&
      shouldShowOverlay(report, config.shameThreshold)
    ) {
      if (report.shameLevel >= ShameLevel.SEVERE) {
        await showShameOverlay(context, report);
      } else {
        const message = getRandomMessage("startup", { report });
        vscode.window
          .showWarningMessage(`PRison: ${message}`, "Show Me", "Dismiss")
          .then((choice) => {
            if (choice === "Show Me") {
              showShameOverlay(context, report);
            }
          });
      }
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
