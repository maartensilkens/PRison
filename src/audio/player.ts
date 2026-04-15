import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { getConfig } from "../config";

const BUILT_IN_SOUNDS = [
  "faaah.mp3",
  "bruh.mp3",
  "aughhhhh.mp3",
  "vine-boom.mp3",
];

export function playShameSound(extensionPath: string): void {
  if (!getConfig().soundEnabled) return;

  const available = BUILT_IN_SOUNDS.filter((name) =>
    fs.existsSync(path.join(extensionPath, "media", "sounds", name)),
  );
  if (available.length === 0) return;

  const picked = available[Math.floor(Math.random() * available.length)];
  const soundPath = path.join(extensionPath, "media", "sounds", picked);

  let cmd: string;
  switch (process.platform) {
    case "darwin":
      cmd = `afplay "${soundPath}"`;
      break;
    case "win32":
      cmd = `powershell -c "(New-Object Media.SoundPlayer '${soundPath.replace(/'/g, "\\'")}').PlaySync()"`;
      break;
    default:
      cmd = `aplay "${soundPath}" 2>/dev/null || paplay "${soundPath}" 2>/dev/null || true`;
  }

  exec(cmd, { timeout: 10000 }, () => {});
}
