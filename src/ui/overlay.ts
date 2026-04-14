import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ShameReport } from "../shame/types";
import { getRandomMessage } from "../messages/memes";
import { getPRAgeDays } from "../github/api";

let activePanel: vscode.WebviewPanel | null = null;

export async function showShameOverlay(
  context: vscode.ExtensionContext,
  report: ShameReport,
): Promise<void> {
  if (activePanel) {
    activePanel.reveal(vscode.ViewColumn.One);
    sendOverlayContent(activePanel, report);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "prison.overlay",
    "🔒 PRison",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [],
    },
  );

  activePanel = panel;

  const htmlPath = path.join(
    context.extensionPath,
    "src",
    "ui",
    "webview",
    "overlay.html",
  );
  const html = fs.readFileSync(htmlPath, "utf8");
  panel.webview.html = html;

  panel.webview.onDidReceiveMessage(
    (message) => {
      if (message.type === "dismiss") {
        panel.dispose();
      }
    },
    undefined,
    context.subscriptions,
  );

  panel.onDidDispose(() => {
    activePanel = null;
  });

  // Small delay to let webview initialize before sending content
  setTimeout(() => {
    sendOverlayContent(panel, report);
  }, 300);
}

function sendOverlayContent(
  panel: vscode.WebviewPanel,
  report: ShameReport,
): void {
  const message = getRandomMessage("branch_checkout", { report });
  const details = buildShameDetails(report);

  panel.webview.postMessage({
    type: "init",
    message,
    details,
  });
}

function buildShameDetails(report: ShameReport): string {
  const parts: string[] = [];

  if (report.myOpenPRs.length > 0) {
    parts.push(
      `${report.myOpenPRs.length} open PR${report.myOpenPRs.length !== 1 ? "s" : ""}`,
    );
  }
  if (report.totalUnresolvedThreads > 0) {
    parts.push(
      `${report.totalUnresolvedThreads} unresolved thread${report.totalUnresolvedThreads !== 1 ? "s" : ""}`,
    );
  }
  if (report.pendingReviews.length > 0) {
    parts.push(
      `${report.pendingReviews.length} review${report.pendingReviews.length !== 1 ? "s" : ""} pending`,
    );
  }
  if (report.oldestPRAgeDays > 0) {
    parts.push(
      `oldest: ${report.oldestPRAgeDays} day${report.oldestPRAgeDays !== 1 ? "s" : ""}`,
    );
  }

  return parts.join(" · ");
}

// Suppress unused warning — getPRAgeDays is imported for potential future use in overlay detail logic
void getPRAgeDays;

export function disposeOverlay(): void {
  activePanel?.dispose();
  activePanel = null;
}
