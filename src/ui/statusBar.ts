import * as vscode from "vscode";
import { ShameReport, ShameLevel } from "../shame/types";

export class ShameStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      -100,
    );
    this.item.command = "workbench.view.extension.prison-sidebar";
    this.item.tooltip = "PRison — Click to see your PR shame";
    this.setClean();
    this.item.show();
  }

  update(report: ShameReport): void {
    const { myOpenPRs, pendingReviews, shameLevel } = report;

    if (shameLevel === ShameLevel.CLEAN) {
      this.setClean();
      return;
    }

    const parts: string[] = [];
    if (myOpenPRs.length > 0) parts.push(`${myOpenPRs.length} open`);
    if (pendingReviews.length > 0)
      parts.push(`${pendingReviews.length} to review`);

    const summary = parts.join(" · ");

    switch (shameLevel) {
      case ShameLevel.MILD:
        this.item.text = `$(git-pull-request) PRison: ${summary}`;
        this.item.backgroundColor = undefined;
        this.item.color = new vscode.ThemeColor(
          "statusBarItem.warningForeground",
        );
        break;
      case ShameLevel.MODERATE:
        this.item.text = `$(flame) PRison: ${summary}`;
        this.item.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground",
        );
        this.item.color = undefined;
        break;
      case ShameLevel.SEVERE:
      case ShameLevel.CRITICAL:
        this.item.text = `$(alert) PRison: 🔥 ${summary}`;
        this.item.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground",
        );
        this.item.color = undefined;
        break;
    }
  }

  private setClean(): void {
    this.item.text = "$(check) PRison: All clear";
    this.item.backgroundColor = undefined;
    this.item.color = undefined;
  }

  dispose(): void {
    this.item.dispose();
  }
}
