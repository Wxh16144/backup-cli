import glob from 'fast-glob'
import path from 'path'
import ini from 'ini'
import fs from 'fs'
import {
  CONFIG_FILE_EXT,
  CONFIG_DIR_NAME,
  resolveProjectRoot,
} from './util'
import { Config } from './type'
import type { LoggerType } from './logger'

export async function getAppConfigs() {
  const defaultApps = await glob.sync(`*${CONFIG_FILE_EXT}`, {
    cwd: resolveProjectRoot('applications'),
    deep: 1,
    absolute: true,
  });

  const customApps = await glob.sync(`*${CONFIG_FILE_EXT}`, {
    cwd: resolveProjectRoot(CONFIG_DIR_NAME),
    deep: 1,
    absolute: true,
  });

  return [...defaultApps, ...customApps]
}

export async function getApps(apps: string[], config: Config = {}) {
  const {
    applications_to_ignore,
    applications_to_sync
  } = config

  const appNames = apps.reduce<Record<string, string>>(
    (acc, app) => {
      const appName = path.basename(app, CONFIG_FILE_EXT);
      if (applications_to_ignore?.[appName]) {
        return acc;
      }
      if (applications_to_sync && !applications_to_sync[appName]) {
        return acc;
      }
      return { ...acc, [appName]: app };
    },
    {}
  );

  return appNames;
}

export async function loadAppsConfigs(
  apps: Record<string, string>,
  { logger }: { logger: LoggerType }
) {
  const config = Object.entries(apps).map(([appName, configPath]) => {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = ini.parse(configContent);
    logger.debug(`parse config for ${appName}: ${JSON.stringify(config, null, 2)}`);
    return config;
  });

  return config;
}
