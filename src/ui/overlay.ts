import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ShameReport } from "../shame/types";
import { getRandomMessage } from "../messages/memes";
import { playShameSound } from "../audio/player";
import { ownPRsNeedingAction } from "../shame/engine";
import { getNonce } from "../utils/nonce";

let activePanel: vscode.WebviewPanel | null = null;

export async function showShameOverlay(
  context: vscode.ExtensionContext,
  report: ShameReport,
): Promise<void> {
  // Play sound immediately via OS — no webview delay
  playShameSound(context.extensionPath);

  if (activePanel) {
    activePanel.reveal(vscode.ViewColumn.One);
    updateOverlayContent(activePanel, report);
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

  const nonce = getNonce();
  const rawHtml = fs.readFileSync(
    path.join(context.extensionPath, "media", "overlay.html"),
    "utf8",
  );
  panel.webview.html = rawHtml.split("{{NONCE}}").join(nonce);

  panel.webview.onDidReceiveMessage(
    (message) => {
      if (message.type === "dismiss") panel.dispose();
    },
    undefined,
    context.subscriptions,
  );

  const updateTimer = setTimeout(
    () => updateOverlayContent(panel, report),
    300,
  );
  panel.onDidDispose(() => {
    clearTimeout(updateTimer);
    activePanel = null;
  });
}

function updateOverlayContent(
  panel: vscode.WebviewPanel,
  report: ShameReport,
): void {
  panel.webview.postMessage({
    type: "init",
    message: getRandomMessage("branch_checkout", { report }),
    details: buildShameDetails(report),
  });
}

function buildShameDetails(report: ShameReport): string {
  const parts: string[] = [];
  const actionRequired = ownPRsNeedingAction(report.myOpenPRs);
  if (actionRequired.length > 0)
    parts.push(
      `${actionRequired.length} own PR${actionRequired.length !== 1 ? "s" : ""} need action`,
    );
  if (report.pendingReviews.length > 0) {
    const reviewableNow = report.pendingReviews.filter(
      (pr) => pr.unresolvedThreads === 0,
    );
    if (reviewableNow.length > 0)
      parts.push(
        `${reviewableNow.length} review${reviewableNow.length !== 1 ? "s" : ""} pending`,
      );
  }
  return parts.join(" · ");
}

export function disposeOverlay(): void {
  activePanel?.dispose();
  activePanel = null;
}
