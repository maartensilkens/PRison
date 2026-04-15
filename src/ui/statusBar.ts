import * as vscode from "vscode";
import { ShameReport } from "../shame/types";
import { ownPRsNeedingAction } from "../shame/engine";

export class ShameStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      -100,
    );
    this.item.command = "workbench.view.extension.prison-sidebar";
    this.item.tooltip = "PRison — Click to open sidebar";
    this.setClean();
    this.item.show();
  }

  update(report: ShameReport): void {
    const { myOpenPRs, pendingReviews, attentionCount } = report;

    if (attentionCount === 0) {
      this.setClean();
      return;
    }

    const actionRequired = ownPRsNeedingAction(myOpenPRs);
    const parts: string[] = [];
    if (actionRequired.length > 0)
      parts.push(
        `${actionRequired.length} own PR${actionRequired.length !== 1 ? "s" : ""} need action`,
      );
    if (pendingReviews.length > 0)
      parts.push(`${pendingReviews.length} to review`);

    const isError = attentionCount >= 2;
    this.item.text = `$(alert) PRison: ${attentionCount} need attention`;
    this.item.tooltip = `PRison — ${parts.join(" · ")} — Click to open sidebar`;
    this.item.backgroundColor = new vscode.ThemeColor(
      isError
        ? "statusBarItem.errorBackground"
        : "statusBarItem.warningBackground",
    );
    this.item.color = undefined;
  }

  private setClean(): void {
    this.item.text = "$(check) PRison: All clear";
    this.item.tooltip = "PRison — Click to open sidebar";
    this.item.backgroundColor = undefined;
    this.item.color = undefined;
  }

  dispose(): void {
    this.item.dispose();
  }
}
