import { glob } from 'glob';
import loadJsonFile from 'load-json-file';
import fs from 'node:fs/promises';
import path from 'path';
import { showWarning } from './utils';
import { parse } from 'yaml';

async function exists(path: string) {
  try {
    await fs.access(path, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

const PACKAGE_JSON_FILE = 'package.json';
const LERNA_CONFIG_FILE = 'lerna.json';
const PNPM_CONFIG_FILE = 'pnpm-workspace.yaml';
const DOUBLE_STAR = '**'; // globstar

const flat = (arrays: string[][]) => ([] as string[]).concat.apply([], arrays);

const distinct = (array: string[]) => [...new Set(array)];

const findPatternMatches = async (root: string, pattern: string) => {
  // patterns with double star e.g. '/src/**/' are not supported at the moment, because they are too general and may match nested node_modules
  if (pattern.includes(DOUBLE_STAR)) return [];

  const matches = await glob(path.join(pattern, PACKAGE_JSON_FILE), {
    cwd: root,
  });

  return matches.map((match) => path.join(match, '..'));
};

const getLernaPackagesConfig = async (root: string) => {
  const lernaConfigFile = path.join(root, LERNA_CONFIG_FILE);
  if (!(await exists(lernaConfigFile))) {
    return [];
  }
  try {
    const config: {
      packages?: string[];
    } = await loadJsonFile<{ packages?: string[] }>(lernaConfigFile);
    return Array.isArray(config?.packages) ? config.packages : [];
  } catch (error) {
    showWarning(`Ignoring invalid ${LERNA_CONFIG_FILE} file at: ${lernaConfigFile}`);
    return [];
  }
};

const getPnpmPackagesConfig = async (root: string) => {
  const pnpmConfigFile = path.join(root, PNPM_CONFIG_FILE);
  if (!(await exists(pnpmConfigFile))) {
    return [];
  }
  try {
    const fileStr = await fs.readFile(pnpmConfigFile, 'utf8');
    const config = await parse(fileStr);
    return Array.isArray(config?.packages) ? config.packages : [];
  } catch (error) {
    showWarning(`Ignoring invalid ${PNPM_CONFIG_FILE} file at: ${pnpmConfigFile}`);
    return [];
  }
};

const getYarnWorkspacesConfig = async (root: string) => {
  const packageJsonFile = path.join(root, PACKAGE_JSON_FILE);
  if (!(await exists(packageJsonFile))) {
    return [];
  }

  try {
    const config = await loadJsonFile<{
      workspaces?: string[];
    }>(packageJsonFile);
    return Array.isArray(config?.workspaces) ? config.workspaces : [];
  } catch (error) {
    showWarning(`Ignoring invalid ${PACKAGE_JSON_FILE} file at: ${packageJsonFile}`);
    return [];
  }
};

export async function findChildPackages(root: string) {
  const patterns = distinct([
    ...(await getLernaPackagesConfig(root)),
    ...(await getYarnWorkspacesConfig(root)),
    ...(await getPnpmPackagesConfig(root)),
  ]);

  const matchesArr = await Promise.all(
    patterns.map((pattern) => findPatternMatches(root, pattern))
  );

  return flat(matchesArr);
}
