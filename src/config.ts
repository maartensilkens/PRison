import * as vscode from "vscode";

export interface PrisonConfig {
  repos: string[];
  pollingInterval: number;
  enabled: boolean;
  overlayOnStartup: boolean;
  overlayOnBranchChange: boolean;
  soundEnabled: boolean;
  blockTerminal: boolean;
  requiredApprovals: number;
}

export function getConfig(): PrisonConfig {
  const cfg = vscode.workspace.getConfiguration("prison");
  return {
    repos: cfg.get<string[]>("repos", []),
    pollingInterval: cfg.get<number>("pollingInterval", 5),
    enabled: cfg.get<boolean>("enabled", true),
    overlayOnStartup: cfg.get<boolean>("overlayOnStartup", true),
    overlayOnBranchChange: cfg.get<boolean>("overlayOnBranchChange", true),
    soundEnabled: cfg.get<boolean>("soundEnabled", true),
    blockTerminal: cfg.get<boolean>("blockTerminal", true),
    requiredApprovals: cfg.get<number>("requiredApprovals", 2),
  };
}
