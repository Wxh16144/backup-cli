import { homedir } from 'os';
import path from 'path';
import url from 'url';
import fs from 'fs';
import ini from 'ini';
import c from "kleur";
import { Config, MaybeArray, Obj } from './type';
import type { LoggerType } from './logger';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultConfig: Config = {
  storage: {
    directory: 'backup',
    path: process.cwd(),
  },
}

export const CONFIG_FILE_EXT = '.cfg';
export const CUSTOM_APP_CONFIG_DIR = '.backup';
export const CONFIG_FILE_NAME = `${CUSTOM_APP_CONFIG_DIR}rc`

export const resolveProjectRoot = (...args: string[]) =>
  path.resolve(__dirname, '../', ...args);

export const resolveHome = (...args: string[]) =>
  path.resolve(homedir() || '~/', ...args);

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
  return setValues({}, defaultConfig, config);
}

function isObject(obj: any): obj is Obj {
  return typeof obj === 'object' && obj !== null && Object.getPrototypeOf(obj) === Object.prototype;
}

function cloneObjectDeep(val: Obj) {
  if (Object.getPrototypeOf(val) === Object.prototype) {
    const res: Record<string, any> = {};
    for (const key in val) {
      res[key] = cloneDeep(val[key]);
    }
    return res;
  }
  return val;
}

function cloneArrayDeep(val: any[]) {
  return val.map(item => cloneDeep(item));
}

function cloneDeep<T>(val: T): T {
  if (Array.isArray(val)) {
    return cloneArrayDeep(val) as T;
  } else if (isObject(val)) {
    return cloneObjectDeep(val) as T;
  }
  return val;
}

// copied https://github.com/react-component/field-form/blob/a34d311f3feb79048a241a5afcfe6083eed2ba47/src/utils/valueUtil.ts#L38-L67
function internalSetValues<T extends MaybeArray<Obj>>(store: T, values: T): T {
  const newStore: T = (Array.isArray(store) ? [...store] : { ...store }) as T;

  if (!values) {
    return newStore;
  }

  Object.keys(values).forEach(key => {
    const prevValue = (newStore as Obj)[key];
    const value: Obj = (values as Obj)[key];

    // If both are object (but target is not array), we use recursion to set deep value
    const recursive = isObject(prevValue) && isObject(value);

    (newStore as Obj)[key] = recursive ? internalSetValues(prevValue, value || {}) : cloneDeep(value); // Clone deep for arrays
  });

  return newStore;
}

export function setValues<T extends Obj>(store: T, ...restValues: T[]): T {
  return restValues.reduce(
    (current: T, newStore: T): T => internalSetValues<T>(current, newStore),
    store,
  );
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