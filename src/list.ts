import glob from 'fast-glob'
import path from 'path'
import ini from 'ini'
import fs from 'fs'
import {
  CONFIG_FILE_EXT,
  CUSTOM_APP_CONFIG_DIR,
  resolveProjectRoot,
  resolveHome,
} from './util'
import type { AppConfig, Config } from './type'
import type { LoggerType } from './logger'

export async function getAppConfigs() {
  // https://github.com/lra/mackup/blob/master/LICENSE
  const _defaultAppDir = resolveProjectRoot('mackup/mackup/applications');
  const _defaultCustomAppDirPath = resolveHome(CUSTOM_APP_CONFIG_DIR);

  const defaultApps = await glob.sync(`*${CONFIG_FILE_EXT}`, {
    cwd: [process.env.BACKUP_DEFAULT_APP_DIR || _defaultAppDir].find(fs.existsSync) || _defaultAppDir,
    deep: 1,
    absolute: true,
  });

  const customApps = await glob.sync(`*${CONFIG_FILE_EXT}`, {
    cwd: [process.env.BACKUP_CUSTOM_APP_DIR || _defaultCustomAppDirPath].find(fs.existsSync) || _defaultCustomAppDirPath,
    deep: 1,
    absolute: true,
  });

  const builtInApps = await glob.sync(`*${CONFIG_FILE_EXT}`, {
    cwd: resolveProjectRoot('applications'),
    deep: 1,
    absolute: true,
  });

  return [...builtInApps, ...defaultApps, ...customApps]
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
      if (
        applications_to_sync &&
        Object.keys(applications_to_sync).length > 0 &&
        !applications_to_sync[appName]
      ) {
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

  return config as AppConfig[];
}
