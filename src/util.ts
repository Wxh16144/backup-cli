import path from 'path';
import fs from 'fs';
import ini from 'ini';
import c from "kleur";
import { merge } from 'lodash-es'
import { Config } from './type';
import type { LoggerType } from './logger';

let defaultConfig: Config = {
  storage: {
    directory: 'backup'
  },
}

const home = process.platform === 'win32'
  ? process.env.USERPROFILE
  : process.env.HOME

export const CONFIG_FILE_EXT = '.cfg';
export const CONFIG_DIR_NAME = '.backup';
export const CONFIG_FILE_NAME = `${CONFIG_DIR_NAME}rc`

export const resolveProjectRoot = (...args: string[]) =>
  path.resolve(__dirname, '../', ...args);

export const resolveHome = (...args: string[]) =>
  path.resolve(home || '~/', ...args);

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

export function divider(
  text = '-',
  length = process.stdout?.columns,
  style = c.bold,
) {
  return style(text.repeat(length || 80));
}