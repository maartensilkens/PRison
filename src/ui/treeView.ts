import * as vscode from "vscode";
import { ShameReport } from "../shame/types";
import { PRInfo } from "../github/types";
import { getPRAgeDays } from "../github/api";

type ShameTreeItem = CategoryItem | PRItem;

class CategoryItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly children: PRItem[],
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "category";
  }
}

class PRItem extends vscode.TreeItem {
  constructor(
    public readonly pr: PRInfo,
    public readonly isReviewRequest: boolean,
  ) {
    super(`#${pr.number} ${pr.title}`, vscode.TreeItemCollapsibleState.None);

    const ageDays = getPRAgeDays(pr);
    const descriptions: string[] = [`${ageDays}d old`];

    if (pr.unresolvedThreads > 0) {
      descriptions.push(`${pr.unresolvedThreads} unresolved`);
    }
    if (pr.reviewState === "APPROVED") {
      descriptions.push("approved ✅");
    } else if (pr.reviewState === "CHANGES_REQUESTED") {
      descriptions.push("changes requested ⚠️");
    }

    this.description = descriptions.join(", ");
    this.tooltip = `${pr.title}\n${pr.repo}\n${this.description}\n\nClick to open in browser`;
    this.command = {
      command: "prison.openPR",
      title: "Open PR",
      arguments: [pr.url],
    };
    this.contextValue = "prItem";

    if (ageDays >= 7) {
      this.iconPath = new vscode.ThemeIcon(
        "flame",
        new vscode.ThemeColor("errorForeground"),
      );
    } else if (pr.unresolvedThreads > 0) {
      this.iconPath = new vscode.ThemeIcon(
        "comment-unresolved",
        new vscode.ThemeColor("list.warningForeground"),
      );
    } else if (pr.reviewState === "APPROVED") {
      this.iconPath = new vscode.ThemeIcon(
        "pass",
        new vscode.ThemeColor("testing.iconPassed"),
      );
    } else {
      this.iconPath = new vscode.ThemeIcon("git-pull-request");
    }
  }
}

export class ShameTreeProvider implements vscode.TreeDataProvider<ShameTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private report: ShameReport | null = null;

  update(report: ShameReport): void {
    this.report = report;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ShameTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ShameTreeItem): ShameTreeItem[] {
    if (element instanceof CategoryItem) {
      return element.children;
    }

    if (!this.report) {
      return [new CategoryItem("Loading...", [])];
    }

    const categories: CategoryItem[] = [];

    if (this.report.myOpenPRs.length > 0) {
      const emoji = this.report.myOpenPRs.some((pr) => getPRAgeDays(pr) >= 7)
        ? "🔥"
        : "📋";
      categories.push(
        new CategoryItem(
          `${emoji} YOUR OPEN PRs (${this.report.myOpenPRs.length})`,
          this.report.myOpenPRs.map((pr) => new PRItem(pr, false)),
        ),
      );
    }

    if (this.report.pendingReviews.length > 0) {
      categories.push(
        new CategoryItem(
          `👀 NEEDS YOUR REVIEW (${this.report.pendingReviews.length})`,
          this.report.pendingReviews.map((pr) => new PRItem(pr, true)),
        ),
      );
    }

    if (categories.length === 0) {
      const cleanItem = new vscode.TreeItem("✅ All clear — no PR debt!");
      cleanItem.description = "You are built different fr fr 🔥";
      return [cleanItem as ShameTreeItem];
    }

    return categories;
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
