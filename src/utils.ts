import vscode from 'vscode';

const formatMsg = (message: string) => `Search node_modules: ${message}`;
export const showError = (message: string) => vscode.window.showErrorMessage(formatMsg(message));
export const showWarning = (message: string) =>
  vscode.window.showWarningMessage(formatMsg(message));
