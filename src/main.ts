import c from "kleur";
import path from "path";
import fs from "fs-extra";
import backup from "./backup";
import type { Argv } from "./type";
import type { LoggerType } from './logger'
import { getAppConfigs, getApps, loadAppsConfigs } from './list'
import { divider, getConfig, setValues } from "./util";

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

  const {
    storage: { directory = "backup", path: savePath = '/' } = {}
  } = config;

  const storagePath = path.join(savePath, directory);

  const finalConfig = setValues({}, config, {
    storage: { directory: storagePath, }
  });

  const appsConfigs = await loadAppsConfigs(needBackupApps, { logger });

  if (args.config) {
    // https://github.com/lukeed/console-clear/blob/1999bde1861bfdf1cc86cd9b1e977197da8a8d49/index.js#L5
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H\x1Bc');

    console.log(divider('----- Read Config -----', c.green, 1));
    console.log(JSON.stringify(config, null, 2));
    console.log(divider('----- Final Config -----', c.green, 1));
    console.log(JSON.stringify(finalConfig, null, 2));

    console.log(divider('----- Apps Config -----', c.green, 1));
    appsConfigs.forEach((appConfig, index) => {
      console.log(JSON.stringify(appConfig, null, 2));
      console.log(divider());
    });
    return;
  }

  if (!fs.existsSync(storagePath)) {
    logger.warn(`Storage directory not found: ${storagePath}`);
    fs.ensureDirSync(storagePath);
    logger.info(`Create storage directory: ${storagePath}`);
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