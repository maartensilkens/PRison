import * as vscode from "vscode";

export interface PrisonConfig {
  repos: string[];
  pollingInterval: number;
  shameThreshold: "mild" | "moderate" | "severe";
  enabled: boolean;
  overlayOnStartup: boolean;
  overlayOnBranchChange: boolean;
}

export function getConfig(): PrisonConfig {
  const cfg = vscode.workspace.getConfiguration("prison");
  return {
    repos: cfg.get<string[]>("repos", []),
    pollingInterval: cfg.get<number>("pollingInterval", 5),
    shameThreshold: cfg.get<"mild" | "moderate" | "severe">(
      "shameThreshold",
      "mild",
    ),
    enabled: cfg.get<boolean>("enabled", true),
    overlayOnStartup: cfg.get<boolean>("overlayOnStartup", true),
    overlayOnBranchChange: cfg.get<boolean>("overlayOnBranchChange", true),
  };
}
