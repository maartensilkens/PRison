import * as vscode from "vscode";

let cachedToken: string | null = null;

export async function getGitHubToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;

  try {
    const session = await vscode.authentication.getSession(
      "github",
      ["repo", "read:user"],
      { createIfNone: true },
    );
    cachedToken = session.accessToken;
    return cachedToken;
  } catch (err) {
    vscode.window.showWarningMessage(
      "PRison: Could not authenticate with GitHub. Some features will be unavailable.",
    );
    return null;
  }
}

export function clearTokenCache(): void {
  cachedToken = null;
}

export async function getAuthenticatedUser(
  token: string,
): Promise<string | null> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "PRison-VSCode-Extension",
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { login: string };
    return data.login;
  } catch {
    return null;
  }
}
