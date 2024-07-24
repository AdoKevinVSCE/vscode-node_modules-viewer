import fs from 'node:fs/promises';
import path from 'node:path';

// Looks for node_modules in parent folders of the workspace recursively.
// Returns a list of paths relative to workspaceRoot/nodeModulesPath
export async function findParentModules(workspaceRoot: string, nodeModulesPath: string) {
  const rootDirectoryPath = path.parse(process.cwd()).root.toLowerCase();
  const absoluteRootNodeModules = path.join(rootDirectoryPath, nodeModulesPath);

  async function find(dir: string) {
    const ret: string[] = [];
    const stat = await fs.stat(dir);
    if (stat.isDirectory()) {
      const getFilePath = (file: string) =>
        path.relative(path.join(workspaceRoot, nodeModulesPath), path.join(dir, file));

      const dirFiles = await fs.readdir(dir);
      ret.push(...dirFiles.map(getFilePath));
    }

    if (dir !== absoluteRootNodeModules) {
      const parent = path.join(dir, '..', '..', nodeModulesPath);
      ret.push(...(await find(parent)));
    }

    return ret;
  }

  return find(path.join(workspaceRoot, '..', nodeModulesPath));
}
