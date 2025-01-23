import fs from 'node:fs/promises';
import path from 'path';
import vscode, { type ExtensionContext } from 'vscode';
import { findChildPackages } from './find-child-packages';
import { sortFiles } from './sort-files';
import { showError } from './utils';

let lastFolder = '';
let lastWorkspaceName = '';
let lastWorkspaceRoot = '';

const nodeModules = 'node_modules';

export function activate(context: ExtensionContext) {
  const searchNodeModules = vscode.commands.registerCommand('search_node_modules', async () => {
    const preferences = vscode.workspace.getConfiguration('search-node-modules');

    const useLastFolder = preferences.get('useLastFolder', false);
    const nodeModulesPath = preferences.get('path', nodeModules);
    const orderPriority = preferences.get('orderPriority', []);

    async function searchPath(workspaceName: string, workspaceRoot: string, folderPath: string) {
      // Path to node_modules in this workspace folder
      const workspaceNodeModules = path.join(workspaceName, nodeModulesPath);

      // Reset last folder
      lastFolder = '';
      lastWorkspaceName = '';
      lastWorkspaceRoot = '';

      // Path to current folder
      const folderFullPath = path.join(workspaceRoot, folderPath);

      // Read folder, built quick pick with files/folder (and shortcuts)
      let files = [];
      try {
        files = await fs.readdir(folderFullPath);
      } catch {
        if (folderPath === nodeModulesPath) {
          return showError('No node_modules folder in this workspace.');
        }

        return showError(`Unable to open folder ${folderPath}`);
      }

      const isParentFolder = folderPath.includes('..');
      const options = sortFiles(files, orderPriority);

      // If searching in root node_modules, also include modules from parent folders, that are outside of the workspace
      if (folderPath === nodeModulesPath) {
        // TODO: currently I don't have this use case
        // if (searchParentModules) {
        //   const parentModules = await findParentModules(workspaceRoot, nodeModulesPath);
        //   options.push(...parentModules);
        // }
      } else {
        // Otherwise, show option to move back to root
        options.push('');
        options.push(workspaceNodeModules);

        // If current folder is not outside of the workspace, also add option to move a step back
        if (!isParentFolder) {
          options.push('..');
        }
      }

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: path.format({ dir: workspaceName, base: folderPath }),
      });
      if (selected) {
        // node_modules shortcut selected
        if (selected === workspaceNodeModules) {
          searchPath(workspaceName, workspaceRoot, nodeModulesPath);
        } else {
          const selectedPath = path.join(folderPath, selected);
          const selectedFullPath = path.join(workspaceRoot, selectedPath);

          // If selected is a folder, traverse it,
          // otherwise open file.
          const stats = await fs.stat(selectedFullPath);
          if (stats.isDirectory()) {
            searchPath(workspaceName, workspaceRoot, selectedPath);
          } else {
            lastWorkspaceName = workspaceName;
            lastWorkspaceRoot = workspaceRoot;
            lastFolder = folderPath;

            const doc = await vscode.workspace.openTextDocument(selectedFullPath);
            vscode.window.showTextDocument(doc);
          }
        }
      }
    }

    async function getProjectFolder(workspaceFolder: vscode.WorkspaceFolder) {
      const packages = await findChildPackages(workspaceFolder.uri.fsPath);
      // If in a lerna/yarn monorepo, prompt user to select which project to traverse
      if (packages.length > 0) {
        const selected = await vscode.window.showQuickPick(
          [
            { label: workspaceFolder.name, packageDir: '' }, // First option is the root dir
            ...packages.map((packageDir) => ({
              label: path.join(workspaceFolder.name, packageDir),
              packageDir,
            })),
          ],
          { placeHolder: 'Select Project' }
        );
        if (!selected) {
          return;
        }

        return {
          name: selected.label,
          path: path.join(workspaceFolder.uri.fsPath, selected.packageDir),
        };
      }

      // Otherwise, use the root folder
      return {
        name: workspaceFolder.name,
        path: workspaceFolder.uri.fsPath,
      };
    }

    async function getWorkspaceFolder() {
      // If in a multi folder workspace, prompt user to select which one to traverse.
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 1) {
        const selected = await vscode.window.showQuickPick(
          vscode.workspace.workspaceFolders.map((folder) => ({
            label: folder.name,
            folder,
          })),
          {
            placeHolder: 'Select workspace folder',
          }
        );

        if (!selected) {
          return;
        }

        return selected.folder;
      }

      // Otherwise, use the first one
      const folder = vscode.workspace.workspaceFolders?.[0];
      return folder;
    }

    // Open last folder if there is one
    if (useLastFolder && lastFolder) {
      return searchPath(lastWorkspaceName, lastWorkspaceRoot, lastFolder);
    }

    // Must have at least one workspace folder
    if (!vscode.workspace.workspaceFolders?.length) {
      return showError('You must have a workspace opened.');
    }

    const workSpaceFolder = await getWorkspaceFolder();
    if (workSpaceFolder) {
      const folder = await getProjectFolder(workSpaceFolder);
      if (folder) {
        searchPath(folder.name, folder.path, nodeModulesPath);
      }
    }
  });

  context.subscriptions.push(searchNodeModules);
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
