import * as vscode from "vscode";
import { ShameReport } from "../shame/types";
import { PRInfo } from "../github/types";
import { getPRAgeDays } from "../github/api";
import { getConfig } from "../config";
import { getNonce } from "../utils/nonce";
import { ownPRsNeedingAction } from "../shame/engine";

type PRRole = "own" | "pending" | "reviewed";

type SidebarState =
  | { kind: "loading" }
  | { kind: "authRequired" }
  | { kind: "noRepos" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      // My Open PRs sub-sections
      myAttention: CardData[];
      myAwaiting: CardData[];
      myApproved: CardData[];
      // Not Reviewed by You sub-sections
      pendingIssues: CardData[];
      pendingReady: CardData[];
      // Reviewed / Approved sub-sections
      myChangesRequested: CardData[];
      reviewedByMe: CardData[];
      enoughApprovals: CardData[];
    };

interface CardData {
  number: number;
  title: string;
  url: string;
  icon: string;
  meta: string;
  statusClass: string;
}

function resolveIcon(pr: PRInfo, ageDays: number, role: PRRole): string {
  if (role === "reviewed") return "👁️";
  if (role === "pending") {
    if (pr.unresolvedThreads > 0) return "💬";
    if (ageDays >= 1) return "🔥";
    return "👀";
  }
  // own
  if (pr.approvals >= getConfig().requiredApprovals) return "✅";
  if (pr.reviewState === "CHANGES_REQUESTED") return "🔥";
  if (pr.unresolvedThreads > 0) return "💬";
  if (pr.isDraft) return "📝";
  return "🔄";
}

function resolveStatusClass(pr: PRInfo, ageDays: number, role: PRRole): string {
  if (role === "reviewed") return "success";
  if (role === "pending") {
    if (pr.unresolvedThreads > 0) return "warning";
    if (ageDays >= 1) return "danger";
    return "neutral";
  }
  // own
  if (pr.approvals >= getConfig().requiredApprovals) return "success";
  if (pr.reviewState === "CHANGES_REQUESTED") return "danger";
  if (pr.unresolvedThreads > 0) return "warning";
  return "neutral";
}

function serializePR(pr: PRInfo, role: PRRole): CardData {
  const { requiredApprovals } = getConfig();
  const ageDays = getPRAgeDays(pr);
  const meta: string[] = [`@${pr.author}`, `${ageDays}d old`];
  if (pr.isDraft) meta.push("draft");
  meta.push(`${pr.approvals}/${requiredApprovals} ✅`);
  if (pr.unresolvedThreads > 0) meta.push(`${pr.unresolvedThreads} unresolved 💬`);
  if (pr.reviewState === "CHANGES_REQUESTED") meta.push("⚠️ changes");

  return {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    icon: resolveIcon(pr, ageDays, role),
    meta: meta.join("  ·  "),
    statusClass: resolveStatusClass(pr, ageDays, role),
  };
}

function buildReadyState(report: ShameReport): SidebarState {
  const { requiredApprovals } = getConfig();
  const attention = ownPRsNeedingAction(report.myOpenPRs);
  const nonAttention = report.myOpenPRs.filter((pr) => !attention.includes(pr));
  const myApproved = nonAttention.filter(
    (pr) => pr.approvals >= requiredApprovals,
  );
  const myAwaiting = nonAttention.filter(
    (pr) => pr.approvals < requiredApprovals,
  );

  const pendingIssues = report.pendingReviews.filter(
    (pr) => pr.unresolvedThreads > 0,
  );
  const pendingReady = report.pendingReviews.filter(
    (pr) => pr.unresolvedThreads === 0,
  );

  const enoughApprovals = report.reviewedByMe.filter(
    (pr) => pr.approvals >= requiredApprovals,
  );
  const myChangesRequested = report.reviewedByMe.filter(
    (pr) =>
      pr.approvals < requiredApprovals &&
      pr.myReviewState === "CHANGES_REQUESTED",
  );
  const reviewedByMe = report.reviewedByMe.filter(
    (pr) =>
      pr.approvals < requiredApprovals &&
      pr.myReviewState !== "CHANGES_REQUESTED",
  );

  return {
    kind: "ready",
    myAttention: attention.map((pr) => ({
      ...serializePR(pr, "own"),
      statusClass: "danger",
    })),
    myAwaiting: myAwaiting.map((pr) => serializePR(pr, "own")),
    myApproved: myApproved.map((pr) => serializePR(pr, "own")),
    pendingIssues: pendingIssues.map((pr) => serializePR(pr, "pending")),
    pendingReady: pendingReady.map((pr) => ({
      ...serializePR(pr, "pending"),
      statusClass: "danger",
    })),
    myChangesRequested: myChangesRequested.map((pr) => ({
      ...serializePR(pr, "reviewed"),
      statusClass: "warning",
      icon: "↩️",
    })),
    reviewedByMe: reviewedByMe.map((pr) => serializePR(pr, "reviewed")),
    enoughApprovals: enoughApprovals.map((pr) => serializePR(pr, "reviewed")),
  };
}

export class SidebarViewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  private view?: vscode.WebviewView;
  private isReady = false;
  private state: SidebarState = { kind: "loading" };

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    this.isReady = false;

    view.webview.options = { enableScripts: true };
    view.webview.html = buildHtml(view.webview);

    view.webview.onDidReceiveMessage((msg: { type: string; url?: string }) => {
      if (msg.type === "ready") {
        this.isReady = true;
        this.push();
      } else if (msg.type === "openPR" && msg.url) {
        // Only open validated GitHub URLs
        if (/^https:\/\/github\.com\//.test(msg.url)) {
          vscode.env.openExternal(vscode.Uri.parse(msg.url));
        }
      }
    });

    view.onDidDispose(() => {
      this.view = undefined;
      this.isReady = false;
    });
  }

  update(report: ShameReport): void {
    this.state = buildReadyState(report);
    this.push();
  }

  setAuthRequired(): void {
    this.state = { kind: "authRequired" };
    this.push();
  }

  setNoRepos(): void {
    this.state = { kind: "noRepos" };
    this.push();
  }

  setError(message: string): void {
    this.state = { kind: "error", message };
    this.push();
  }

  private push(): void {
    if (this.view && this.isReady) {
      this.view.webview.postMessage({ type: "setState", state: this.state });
    }
  }

  dispose(): void {
    this.view = undefined;
    this.isReady = false;
  }
}

// getNonce imported from shared util

function buildHtml(_webview: vscode.Webview): string {
  const nonce = getNonce();
  const csp = [
    `default-src 'none'`,
    `style-src 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      padding: 8px 6px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
    }
    .section { margin-bottom: 6px; }
    .section-divider {
      border: none;
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
      margin: 14px 2px 12px;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--vscode-foreground);
      opacity: 0.6;
      padding: 0 2px 5px;
      user-select: none;
    }
    .collapsible-section { margin-bottom: 6px; }
    .collapsible-section > summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 2px 5px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--vscode-foreground);
      opacity: 0.6;
      user-select: none;
      border-radius: 3px;
    }
    .collapsible-section > summary:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
    .collapsible-section > summary::-webkit-details-marker { display: none; }
    .chevron { width: 10px; height: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .chevron::before { content: ''; display: inline-block; width: 5px; height: 5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); vertical-align: 1px; }
    details[open] > summary .chevron::before { transform: rotate(45deg); vertical-align: -1px; }
    .badge {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 10px;
      padding: 1px 6px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
    }
    .badge.danger {
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      color: var(--vscode-errorForeground, #f48771);
    }
    details.subsection { margin-bottom: 2px; }
    details.subsection > summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 4px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 500;
      opacity: 0.75;
      user-select: none;
    }
    details.subsection > summary:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
    details.subsection > summary::-webkit-details-marker { display: none; }
    details.subsection > summary.danger { color: var(--vscode-errorForeground); opacity: 1; }
    .sub-cards { padding-top: 3px; }
    .card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 10px 8px 11px;
      margin-bottom: 4px;
      border-radius: 4px;
      border-left: 3px solid var(--card-accent, transparent);
      cursor: pointer;
      background: var(--vscode-list-inactiveSelectionBackground, rgba(128,128,128,0.1));
      outline: none;
    }
    .card:hover, .card:focus-visible { background: var(--vscode-list-hoverBackground); }
    .card:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    .card.danger  { --card-accent: var(--vscode-errorForeground); }
    .card.warning { --card-accent: var(--vscode-list-warningForeground, #cca700); }
    .card.success { --card-accent: var(--vscode-testing-iconPassed, #4ec9b0); }
    .card.neutral { --card-accent: var(--vscode-foreground); opacity: 0.65; }
    .card.neutral:hover, .card.neutral:focus-visible { opacity: 1; }
    .card-top { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
    .card-icon  { flex-shrink: 0; font-size: 13px; line-height: 1; }
    .card-number { flex-shrink: 0; font-size: 11px; opacity: 0.5; font-variant-numeric: tabular-nums; }
    .card-title {
      flex: 1; font-size: 12px; font-weight: 500;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
    }
    .card-link {
      flex-shrink: 0; font-size: 12px; opacity: 0;
      color: var(--vscode-textLink-foreground); transition: opacity 0.12s;
    }
    .card:hover .card-link, .card:focus-visible .card-link { opacity: 1; }
    .card-meta {
      font-size: 11px; color: var(--vscode-descriptionForeground);
      padding-left: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .empty { padding: 4px 4px; font-size: 11px; opacity: 0.45; }
    .state-msg { padding: 16px 4px; font-size: 12px; opacity: 0.6; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const root = document.getElementById('root');

    function renderCard(card) {
      const el = document.createElement('div');
      el.className = 'card ' + card.statusClass;
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'PR #' + card.number + ': ' + card.title + '. Press Enter to open.');

      const top = document.createElement('div');
      top.className = 'card-top';

      const icon = document.createElement('span');
      icon.className = 'card-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = card.icon;

      const num = document.createElement('span');
      num.className = 'card-number';
      num.textContent = '#' + card.number;

      const titleEl = document.createElement('span');
      titleEl.className = 'card-title';
      titleEl.title = card.title;
      titleEl.textContent = card.title;

      const linkIcon = document.createElement('span');
      linkIcon.className = 'card-link';
      linkIcon.setAttribute('aria-hidden', 'true');
      linkIcon.textContent = '↗';

      top.appendChild(num); top.appendChild(titleEl); top.appendChild(linkIcon);

      const meta = document.createElement('div');
      meta.className = 'card-meta';
      meta.textContent = card.meta;

      el.appendChild(top); el.appendChild(meta);

      const url = card.url;
      function open() { vscode.postMessage({ type: 'openPR', url }); }
      el.addEventListener('click', open);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      return el;
    }

    // opts: { defaultOpen, danger }
    function renderSubSection(label, cards, opts) {
      opts = opts || {};
      if (cards.length === 0) return null;

      const details = document.createElement('details');
      details.className = 'subsection';
      if (opts.defaultOpen !== false) details.open = true;

      const summary = document.createElement('summary');
      if (opts.danger) summary.className = 'danger';

      const chevron = document.createElement('span');
      chevron.className = 'chevron';
      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      summary.appendChild(chevron);
      summary.appendChild(labelEl);
      if (cards.length > 0) {
        const badge = document.createElement('span');
        badge.className = opts.danger ? 'badge danger' : 'badge';
        badge.textContent = String(cards.length);
        summary.appendChild(badge);
      }
      details.appendChild(summary);

      const content = document.createElement('div');
      content.className = 'sub-cards';
      for (const card of cards) content.appendChild(renderCard(card));
      details.appendChild(content);
      return details;
    }

    // opts: { collapsible, defaultOpen } — collapsible wraps in <details>; defaultOpen controls initial state
    function renderSection(title, totalCount, subsections, opts) {
      opts = opts || {};
      let container;

      if (opts.collapsible) {
        container = document.createElement('details');
        container.className = 'collapsible-section';
        if (opts.defaultOpen !== false) container.open = true;

        const summary = document.createElement('summary');
        const chevron = document.createElement('span');
        chevron.className = 'chevron';
        const titleSpan = document.createElement('span');
        titleSpan.textContent = title;
        summary.appendChild(chevron);
        summary.appendChild(titleSpan);
        if (totalCount > 0) {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = String(totalCount);
          summary.appendChild(badge);
        }
        container.appendChild(summary);
      } else {
        container = document.createElement('div');
        container.className = 'section';

        const header = document.createElement('div');
        header.className = 'section-header';
        header.textContent = title;
        if (totalCount > 0) {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = String(totalCount);
          header.appendChild(badge);
        }
        container.appendChild(header);
      }

      for (const sub of subsections) {
        const el = renderSubSection(sub.label, sub.cards, sub.opts);
        if (el) container.appendChild(el);
      }
      return container;
    }

    function divider() {
      const hr = document.createElement('hr');
      hr.className = 'section-divider';
      return hr;
    }

    function render(state) {
      while (root.firstChild) root.removeChild(root.firstChild);

      if (state.kind === 'loading') {
        const msg = document.createElement('div'); msg.className = 'state-msg';
        msg.textContent = 'Checking your PRs…'; root.appendChild(msg); return;
      }
      if (state.kind === 'authRequired') {
        const msg = document.createElement('div'); msg.className = 'state-msg';
        msg.textContent = '🔐 Sign in to GitHub to use PRison'; root.appendChild(msg); return;
      }
      if (state.kind === 'noRepos') {
        const msg = document.createElement('div'); msg.className = 'state-msg';
        msg.textContent = '⚙️ No repos configured. Add prison.repos in settings.'; root.appendChild(msg); return;
      }
      if (state.kind === 'error') {
        const msg = document.createElement('div'); msg.className = 'state-msg';
        msg.textContent = '⚠️ ' + state.message; root.appendChild(msg); return;
      }

      const myTotal = state.myAttention.length + state.myAwaiting.length + state.myApproved.length;
      root.appendChild(renderSection('Your Open PRs', myTotal, [
        { label: '⚠️ Requires Attention', cards: state.myAttention, opts: { danger: true } },
        { label: '⏳ Awaiting Approval',  cards: state.myAwaiting, opts: { defaultOpen: false } },
        { label: '✅ Approved',           cards: state.myApproved, opts: { defaultOpen: false } },
      ], { collapsible: true, defaultOpen: true }));

      root.appendChild(divider());

      const pendingTotal = state.pendingIssues.length + state.pendingReady.length;
      root.appendChild(renderSection('Not Reviewed by You', pendingTotal, [
        { label: '🔥 Ready to Review', cards: state.pendingReady, opts: { danger: true } },
        { label: '💬 Unresolved Comments', cards: state.pendingIssues },
      ], { collapsible: true, defaultOpen: true }));

      root.appendChild(divider());

      const reviewedTotal = state.myChangesRequested.length + state.reviewedByMe.length + state.enoughApprovals.length;
      root.appendChild(renderSection('Reviewed / Approved', reviewedTotal, [
        { label: '↩️ Changes Requested by You', cards: state.myChangesRequested, opts: { danger: false } },
        { label: '👁️ Reviewed by You',          cards: state.reviewedByMe },
        { label: '✅ Enough Approvals',          cards: state.enoughApprovals },
      ], { collapsible: true, defaultOpen: false }));
    }

    window.addEventListener('message', e => {
      if (e.data.type === 'setState') render(e.data.state);
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
