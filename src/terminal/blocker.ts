import * as vscode from "vscode";
import { ShameLevel } from "../shame/types";

export class TerminalBlocker implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly getShameLevel: () => ShameLevel,
    private readonly onShame: () => void,
  ) {
    this.disposables.push(vscode.window.onDidOpenTerminal(() => this.check()));
  }

  private check(): void {
    if (this.getShameLevel() >= ShameLevel.SHAMED) {
      this.onShame();
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
