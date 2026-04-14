import { ShameReport } from "../shame/types";
import { getPRAgeDays } from "../github/api";
import { PRInfo } from "../github/types";

type MessageTrigger = "branch_checkout" | "startup" | "boss_slain";

interface MessageContext {
  report: ShameReport;
  pr?: PRInfo;
}

const BRANCH_CHECKOUT_MESSAGES = [
  "L reviews 💀",
  "Skill issue detected in PR #{{pr}} 🤡",
  "This PR is cooked 💀",
  "POV: You tried to code with open comments 😭",
  "AI Slop detected. Resolve comments before generating more tech debt 🤖",
  "Bro really thought he could code with {{count}} unresolved threads 😂",
  "New branch? In THIS economy? 📉",
  "{{count}} PRs in the mud. No cap. 🧢",
  "Your PR #{{pr}} has been open for {{days}} days. That's not a PR, that's a fossil 🦴",
  "Hot open PRs in your area 🔥",
  "PR #{{pr}} is giving... abandoned 🥀",
  "Not you starting a new feature with {{count}} reviews pending fr fr 💀",
  "The PR review queue is bussin... with YOUR unreviewed code 😤",
  "Erm... what the sigma? Review your PRs first 🐺",
  "It's giving... merge conflict energy 🥀",
  "This PR ain't gonna review itself bestie 💅",
  "{{count}} open PRs and you chose violence (a new branch) 🗡️",
  "Main character syndrome detected — side quest: review PRs first 🎮",
  "You have {{count}} unreviewed PRs. That's not slay. That's delay 🥀",
  "PR #{{pr}} is on life support. Do you have no empathy? 🏥",
  "The audacity. The AUDACITY. {{count}} open PRs. 😤",
  "Bestie... your PR queue called. It's not okay 😔",
  "No cap fr fr your PRs are unalived 🥀",
  "Caught in 4K opening a new branch with {{count}} reviews pending 📸",
  "The villain arc continues. {{count}} unresolved threads. 🦹",
  "Delulu behavior detected: thinking you can ship new code rn 💅",
  "POV: Your teammates seeing you open another PR while theirs rot 👀",
  "This ain't it chief. Review something first. 💀",
  "Lowkey unhinged to start new work with {{count}} PRs aging like milk 🥛",
  "The pipeline said no. PRison said no. The vibes said no. ❌",
];

const STARTUP_MESSAGES = [
  "Welcome back. You still have {{count}} PRs rotting. Just so you know 🥀",
  "Good morning! Your PRs missed you. They've been waiting {{days}} days 💀",
  "Rise and grind! ...on those PR reviews first tho fr fr 📈",
  "You logged in. Your {{count}} open PRs noticed. 👀",
  "The audacity to open VS Code with {{count}} unreviewed PRs. Slay I guess. 💅",
  "Another day, another chance to actually review something fr 🙏",
];

const BOSS_SLAIN_MESSAGES = [
  "PR DEBT CLEARED\n\nHumanity Restored 🔥",
  "BOSS SLAIN\n\nAll reviews complete ⚔️",
  "YOU ARE VICTORIOUS\n\nYou may now code in peace. For now... ☀️",
  "QUEUE CLEARED\n\nActually based behavior. We are so back 🎉",
];

const recentMessages: string[] = [];
const MAX_RECENT = 3;

function interpolate(template: string, context: MessageContext): string {
  const { report, pr } = context;

  const worstPR =
    pr ??
    report.myOpenPRs.reduce<PRInfo | null>((worst, curr) => {
      if (!worst) return curr;
      return getPRAgeDays(curr) > getPRAgeDays(worst) ? curr : worst;
    }, null);

  return template
    .replace(/\{\{pr\}\}/g, worstPR ? String(worstPR.number) : "??")
    .replace(
      /\{\{count\}\}/g,
      String(
        Math.max(
          report.myOpenPRs.length,
          report.pendingReviews.length,
          report.totalUnresolvedThreads,
        ),
      ),
    )
    .replace(/\{\{days\}\}/g, worstPR ? String(getPRAgeDays(worstPR)) : "??")
    .replace(/\{\{author\}\}/g, worstPR?.author ?? "you");
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWithoutRecent(messages: string[]): string {
  const available = messages.filter((m) => !recentMessages.includes(m));
  const pool = available.length > 0 ? available : messages;
  return pickRandom(pool);
}

function trackRecent(message: string): void {
  recentMessages.push(message);
  if (recentMessages.length > MAX_RECENT) {
    recentMessages.shift();
  }
}

export function getRandomMessage(
  trigger: MessageTrigger,
  context: MessageContext,
): string {
  let pool: string[];

  switch (trigger) {
    case "branch_checkout":
      pool = BRANCH_CHECKOUT_MESSAGES;
      break;
    case "startup":
      pool = STARTUP_MESSAGES;
      break;
    case "boss_slain":
      pool = BOSS_SLAIN_MESSAGES;
      break;
  }

  const template = pickWithoutRecent(pool);
  trackRecent(template);
  return interpolate(template, context);
}
