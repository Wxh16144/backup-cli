import { homedir } from 'os';
import path from 'path';
import url from 'url';
import fs from 'fs';
import ini from 'ini';
import c from "kleur";
import { Config, Obj } from './type';
import type { LoggerType } from './logger';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultConfig: Config = {
  storage: {
    directory: 'backup',
    path: process.cwd(),
  },
}

// https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
export const XDG_CONFIG_PATH = path.join(process.env.XDG_CONFIG_HOME || homedir(), '.config');
export const CONFIG_FILE_EXT = '.cfg';
export const CUSTOM_APP_CONFIG_DIR = '.backup';
export const CONFIG_FILE_NAME = `${CUSTOM_APP_CONFIG_DIR}rc`

export const resolveProjectRoot = (...args: string[]) =>
  path.resolve(__dirname, '../', ...args);

export const resolveHome = (...args: string[]) =>
  path.resolve(homedir() || '~/', ...args);

export const resolveXDGConfig = (...args: string[]) =>
  path.resolve(XDG_CONFIG_PATH, ...args);

function isPlainObject(obj: unknown): obj is Obj {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

// like lodash.merge
export function merge<T extends Obj, U extends Obj>(target: T, ...sources: U[]): T & U {
  sources.forEach((source) => {
    Object.keys(source).forEach((key) => {
      const targetValue = target[key];
      const sourceValue = source[key];
      if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
        (<Obj>target)[key] = merge(targetValue, sourceValue);
      } else {
        (<Obj>target)[key] = sourceValue;
      }
    });
  });
  return target as T & U;
}

export function getConfig({ logger }: { logger: LoggerType }) {
  const customRcPath = process.env.BACKUP_CONFIG_FILE
  const defaultRcPath = resolveHome(CONFIG_FILE_NAME);

  const configPath = customRcPath || defaultRcPath;
  const configPathIsExist = fs.existsSync(configPath);

  if (!configPathIsExist) {
    logger.debug(`Config file not found: ${configPath}, use default config.`);
    return defaultConfig;
  }

  const configContent = fs.readFileSync(configPath, 'utf-8');
  logger.debug(`Config file found: ${configPath}`);

  const config = ini.parse(configContent);
  return merge(defaultConfig, config);
}

// copied https://github.com/sindresorhus/is-path-inside/blob/6dd8543476cd100488a3cd83887970a8a03504e7/index.js
export function isPathInside(childPath: string, parentPath: string) {
  const relation = path.relative(parentPath, childPath);

  return Boolean(
    relation &&
    relation !== '..' &&
    !relation.startsWith(`..${path.sep}`) &&
    relation !== path.resolve(childPath)
  );
}

export function divider(
  text = '-',
  style = c.bold,
  length = process.stdout?.columns,
) {
  return style(text.repeat(length || 80));
}