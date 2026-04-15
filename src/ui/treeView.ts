import * as vscode from "vscode";
import { ShameReport } from "../shame/types";
import { PRInfo } from "../github/types";
import { getPRAgeDays } from "../github/api";
import { getConfig } from "../config";

class PRItem extends vscode.TreeItem {
  constructor(
    public readonly pr: PRInfo,
    public readonly isReviewRequest: boolean,
  ) {
    super(`#${pr.number}  ${pr.title}`, vscode.TreeItemCollapsibleState.None);

    const ageDays = getPRAgeDays(pr);
    const requiredApprovals = getConfig().requiredApprovals;
    this.description = buildDescription(
      pr,
      ageDays,
      isReviewRequest,
      requiredApprovals,
    );
    this.tooltip = buildTooltip(
      pr,
      ageDays,
      isReviewRequest,
      requiredApprovals,
    );
    this.command = {
      command: "prison.openPR",
      title: "Open PR in Browser",
      arguments: [pr.url],
    };
    this.contextValue = "prItem";
    this.iconPath = resolveIcon(
      pr,
      ageDays,
      isReviewRequest,
      requiredApprovals,
    );
  }
}

function buildDescription(
  pr: PRInfo,
  ageDays: number,
  isReviewRequest: boolean,
  requiredApprovals: number,
): string {
  const parts: string[] = [`${ageDays}d old`];
  if (pr.isDraft) parts.push("draft");
  if (pr.unresolvedThreads > 0) parts.push(`${pr.unresolvedThreads} unresolved`);
  if (!isReviewRequest) {
    if (pr.approvals >= requiredApprovals) parts.push(`${pr.approvals} ✅`);
    else if (pr.approvals > 0)
      parts.push(`${pr.approvals}/${requiredApprovals} ✅`);
    else if (pr.reviewState === "CHANGES_REQUESTED") parts.push("⚠️ changes");
  }
  return parts.join("  ·  ");
}

function buildTooltip(
  pr: PRInfo,
  ageDays: number,
  isReviewRequest: boolean,
  requiredApprovals: number,
): vscode.MarkdownString {
  const lines: string[] = [];

  lines.push(`### #${pr.number} — ${pr.title}`);
  lines.push("");
  lines.push(`\`${pr.repo}\`  ·  opened by **@${pr.author}**`);
  lines.push("");

  const rows: [string, string][] = [
    ["⏱ Age", `${ageDays} day${ageDays !== 1 ? "s" : ""}`],
  ];

  if (pr.isDraft) rows.push(["📝 Status", "Draft"]);
  if (pr.unresolvedThreads > 0)
    rows.push(["💬 Unresolved comments", `${pr.unresolvedThreads}`]);
  if (!isReviewRequest) {
    rows.push([
      "✅ Approvals",
      `${pr.approvals} / ${requiredApprovals} required`,
    ]);
    if (pr.reviewState === "CHANGES_REQUESTED")
      rows.push(["⚠️ Review state", "Changes requested"]);
    else if (pr.reviewState === "APPROVED")
      rows.push(["✅ Review state", "Approved"]);
  }

  lines.push("| | |");
  lines.push("|:--|:--|");
  for (const [k, v] of rows) lines.push(`| ${k} | ${v} |`);

  lines.push("");
  lines.push(`[$(link-external) Open in GitHub](${pr.url})`);

  const md = new vscode.MarkdownString(lines.join("\n"), true);
  md.isTrusted = true;
  return md;
}

function resolveIcon(
  pr: PRInfo,
  ageDays: number,
  isReviewRequest: boolean,
  requiredApprovals: number,
): vscode.ThemeIcon {
  if (isReviewRequest) {
    if (pr.unresolvedThreads > 0)
      return new vscode.ThemeIcon(
        "comment-unresolved",
        new vscode.ThemeColor("list.warningForeground"),
      );
    if (ageDays >= 1)
      return new vscode.ThemeIcon(
        "flame",
        new vscode.ThemeColor("errorForeground"),
      );
    return new vscode.ThemeIcon("git-pull-request");
  }

  if (pr.approvals >= requiredApprovals)
    return new vscode.ThemeIcon(
      "pass",
      new vscode.ThemeColor("testing.iconPassed"),
    );
  if (pr.unresolvedThreads > 0)
    return new vscode.ThemeIcon(
      "comment-unresolved",
      new vscode.ThemeColor("list.warningForeground"),
    );
  if (pr.isDraft) return new vscode.ThemeIcon("git-pull-request-draft");
  return new vscode.ThemeIcon("git-pull-request");
}

class PRListProvider implements vscode.TreeDataProvider<PRItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private items: PRItem[] = [];
  private emptyLabel: string;

  constructor(
    private readonly isReviewRequest: boolean,
    emptyLabel: string,
  ) {
    this.emptyLabel = emptyLabel;
  }

  update(prs: PRInfo[]): void {
    this.items = prs.map((pr) => new PRItem(pr, this.isReviewRequest));
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PRItem): vscode.TreeItem {
    return element;
  }

  getChildren(): PRItem[] {
    if (this.items.length === 0) {
      const empty = new PRItem(
        {
          number: 0,
          title: this.emptyLabel,
          url: "",
          author: "",
          createdAt: new Date(),
          repo: "",
          unresolvedThreads: 0,
          isDraft: false,
          approvals: 0,
        },
        this.isReviewRequest,
      );
      empty.command = undefined;
      empty.iconPath = new vscode.ThemeIcon("check");
      empty.description = "";
      empty.tooltip = undefined;
      return [empty];
    }
    return this.items;
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

export class ShameTreeView {
  private readonly myPRsProvider: PRListProvider;
  private readonly pendingProvider: PRListProvider;
  private readonly myPRsView: vscode.TreeView<PRItem>;
  private readonly pendingView: vscode.TreeView<PRItem>;

  constructor() {
    this.myPRsProvider = new PRListProvider(false, "No open PRs  🎉");
    this.pendingProvider = new PRListProvider(
      true,
      "All caught up  ✅  no cap fr fr",
    );

    this.myPRsView = vscode.window.createTreeView("prison.myOpenPRs", {
      treeDataProvider: this.myPRsProvider,
      showCollapseAll: false,
    });

    this.pendingView = vscode.window.createTreeView("prison.pendingReviews", {
      treeDataProvider: this.pendingProvider,
      showCollapseAll: false,
    });
  }

  update(report: ShameReport): void {
    this.myPRsProvider.update(report.myOpenPRs);
    this.pendingProvider.update(report.pendingReviews);

    this.myPRsView.badge = report.myOpenPRs.length
      ? { value: report.myOpenPRs.length, tooltip: "Your open PRs" }
      : undefined;

    this.pendingView.badge = report.pendingReviews.length
      ? {
          value: report.pendingReviews.length,
          tooltip: "PRs awaiting your review",
        }
      : undefined;
  }

  dispose(): void {
    this.myPRsProvider.dispose();
    this.pendingProvider.dispose();
    this.myPRsView.dispose();
    this.pendingView.dispose();
  }
}
