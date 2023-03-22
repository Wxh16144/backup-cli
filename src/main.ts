import c from "kleur";
import fs from "fs";
import { merge } from "lodash-es"
import type { Argv } from "./type";
import type { LoggerType } from './logger'
import { getAppConfigs, getApps, loadAppsConfigs } from './list'
import { getConfig, divider, resolveHome, CONFIG_FILE_EXT } from "./util";
import path from "path";

interface Options {
  logger: LoggerType;
}

async function main(args: Argv, { logger }: Options) {
  const config = getConfig({ logger });
  logger.debug(`read config: ${JSON.stringify(config, null, 2)} `);
  const appConfigPaths = await getAppConfigs();
  const apps = await getApps(appConfigPaths);
  const appNames = Object.keys(apps);

  const needBackupApps = await getApps(appConfigPaths, config);
  const needBackupAppNames = Object.keys(needBackupApps);

  if (args.list) {
    logger.info(`Found ${appNames.length} apps:`);
    appNames.forEach(appName => {
      const isBackup = needBackupAppNames.includes(appName);

      // 需要备份的应用前面加上 * 并且使用绿色显示
      const color = isBackup ? c.green : (_: any) => _;

      console.log(color(`     ${isBackup ? "*" : "-"} ${c.bold(appName)}`));
    });
    return;
  }

  if (needBackupAppNames.length === 0) {
    return logger.warn('No apps to backup');
  }

  const { storage: { directory } } = config;
  const storagePath = resolveHome(directory);
  if (!fs.existsSync(storagePath)) {
    logger.warn(`Storage directory not found: ${storagePath}`);
    fs.mkdirSync(storagePath);
    logger.info(`Create storage directory: ${storagePath}`);
  }

  const finalConfig = merge(config, {
    storage: { directory: storagePath, }
  });

  const appsConfigs = await loadAppsConfigs(needBackupApps, { logger });


  // successful backup finished
  console.log(args.debug ? divider() : '\n');
  console.log(c.green(`[${new Date().toLocaleTimeString(undefined, { hour12: false })}] Successful backup finished!`));
}

export default main;