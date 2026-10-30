/* eslint-disable @typescript-eslint/no-explicit-any */
const registeredCommands: Record<string, (...args: unknown[]) => unknown> = {};
const showErrorMessage = jest.fn();
const showWarningMessage = jest.fn();
const showInformationMessage = jest.fn();
const appendLine = jest.fn();
const outputShow = jest.fn();
let webviewHtml = "";

jest.mock(
  "vscode",
  () => ({
    commands: {
      registerCommand: (name: string, handler: (...args: unknown[]) => unknown) => {
        registeredCommands[name] = handler;
        return { dispose: jest.fn() };
      }
    },
    window: {
      createOutputChannel: () => ({ appendLine, show: outputShow, dispose: jest.fn() }),
      createWebviewPanel: () => ({
        webview: {
          set html(value: string) {
            webviewHtml = value;
          },
          get html() {
            return webviewHtml;
          }
        }
      }),
      showErrorMessage,
      showWarningMessage,
      showInformationMessage
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "/repo" } }]
    },
    ViewColumn: { Beside: 2 }
  }),
  { virtual: true }
);

const mockCheckRepo = jest.fn();
jest.mock("docsync-core", () => ({
  checkRepo: (...args: unknown[]) => mockCheckRepo(...args),
  formatReport: jest.fn().mockReturnValue("## report body")
}));

jest.mock("simple-git", () => ({
  simpleGit: () => ({
    revparse: jest.fn().mockRejectedValue(new Error("no such ref"))
  })
}));

import { activate } from "../src/extension";

describe("DocSync-Bot VS Code extension", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    webviewHtml = "";
  });

  function activateAndGetHandler() {
    activate({ subscriptions: [] } as any);
    return registeredCommands["docsync.checkCurrentBranch"];
  }

  it("registers the 'docsync.checkCurrentBranch' command", () => {
    activateAndGetHandler();
    expect(registeredCommands["docsync.checkCurrentBranch"]).toBeDefined();
  });

  it("shows an informational message when there is no drift", async () => {
    mockCheckRepo.mockResolvedValue({ findings: [], blocking: false });
    const handler = activateAndGetHandler();
    await handler();
    expect(showInformationMessage).toHaveBeenCalledWith(expect.stringContaining("no documentation drift"));
    expect(webviewHtml).toContain("report body");
  });

  it("shows a warning message listing the number of findings when drift is detected", async () => {
    mockCheckRepo.mockResolvedValue({ findings: [{}, {}], blocking: true });
    const handler = activateAndGetHandler();
    await handler();
    expect(showWarningMessage).toHaveBeenCalledWith(expect.stringContaining("2 documentation drift finding(s)"));
    expect(showWarningMessage).toHaveBeenCalledWith(expect.stringContaining("blocking"));
  });

  it("shows an error message when checkRepo throws", async () => {
    mockCheckRepo.mockRejectedValue(new Error("git not found"));
    const handler = activateAndGetHandler();
    await handler();
    expect(showErrorMessage).toHaveBeenCalledWith(expect.stringContaining("git not found"));
  });
});
