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
    logs: 'logs',
    path: process.cwd(),
  },
}

// https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
export const XDG_CONFIG_PATH = process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config');
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

export function dividerLine(
  text = '',
  repeat = '-',
  style = c.bold,
) {
  const fullLength = process.stdout?.columns || 80;

  const textLength = (text.length) + 2;

  const leftLength = Math.floor((fullLength - textLength) / 2);

  const left = repeat.repeat(leftLength);
  const right = repeat.repeat(fullLength - leftLength - textLength);
  return style(`${left}${text.length ? ` ${text} ` : ''}${right}`);
}