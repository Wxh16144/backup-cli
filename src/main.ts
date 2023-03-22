import c from "kleur";
import fs from "fs-extra";
import { merge } from "lodash-es"
import backup from "./backup";
import type { Argv } from "./type";
import type { LoggerType } from './logger'
import { getAppConfigs, getApps, loadAppsConfigs } from './list'
import { divider, getConfig, resolveHome } from "./util";

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
    logger.info(`Found ${appNames.length} apps, ${needBackupAppNames.length} of them need backup:`);
    appNames.forEach(appName => {
      const isBackup = needBackupAppNames.includes(appName);

      const color = isBackup ? c.green : (_: any) => _;
      const suffix = isBackup ? " (backup)" : c.red(" (ignore)");
      const prefix = isBackup ? "*" : "-";
      console.log(color(`     ${prefix} ${c.bold(appName)}${args.debug ? suffix : ''}`));
    });
    return;
  }

  if (needBackupAppNames.length === 0) {
    return logger.warn('No apps to backup');
  }

  const { storage: { directory = "backup" } = {} } = config;
  const storagePath = resolveHome(directory);
  if (!fs.existsSync(storagePath) && args.config !== 'true') {
    logger.warn(`Storage directory not found: ${storagePath}`);
    fs.ensureDirSync(storagePath);
    logger.info(`Create storage directory: ${storagePath}`);
  }

  const finalConfig = merge(config, {
    storage: { directory: storagePath, }
  });

  const appsConfigs = await loadAppsConfigs(needBackupApps, { logger });

  if (args.config) {
    console.clear();
    console.log(JSON.stringify(finalConfig, null, 2));
    console.log(divider());
    appsConfigs.forEach(appConfig => {
      console.log(JSON.stringify(appConfig, null, 2));
      console.log(divider());
    });
    return;
  }

  for (const appConfig of appsConfigs) {
    logger.info(`Backup ${c.bold(appConfig.application.name)} ...`);
    await backup(
      appConfig,
      finalConfig,
      {
        logger,
        force: args.restore ? false : args.force,
        restore: args.restore,
      }
    );
    logger.info(`Backup ${c.bold(appConfig.application.name)} ${c.green('done')}\n`);
  }

  // successful backup finished
  console.log(c.green().bold(`[${new Date().toLocaleTimeString(undefined, { hour12: false })}] Successful backup finished!`));
}

export default main;