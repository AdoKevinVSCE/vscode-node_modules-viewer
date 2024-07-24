import { type ExtensionContext } from 'vscode';
import { registerViewDocCommand } from './commands/viewDoc';

export function activate(context: ExtensionContext) {
  const disposables = registerViewDocCommand();

  context.subscriptions.push(disposables);
}

export function deactivate() {}
