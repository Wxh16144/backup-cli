import c from "kleur";
import path from "path";
import fs from "fs-extra";
import backup from "./backup";
import prune from "./prune";

import type { Argv } from "./type";
import type { LoggerType } from './logger'
import { getAppConfigs, getApps, loadAppsConfigs } from './list'
import { dividerLine, getConfig, merge } from "./util";
import { LogFile } from "./log-file";

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
  const actionPrefix = args.restore ? 'Restore' : (args.prune ? 'Prune' : 'Backup');

  if (args.list) {
    logger.info(`Found ${appNames.length} apps, ${needBackupAppNames.length} of them need ${c.bold(actionPrefix.toLowerCase())}`);
    appNames.forEach(appName => {
      const isBackup = needBackupAppNames.includes(appName);

      const color = isBackup ? c.green : c.red;
      const suffix = isBackup ? ` (${actionPrefix})` : c.red(" (Ignore)");
      const prefix = isBackup ? "+" : "-";
      console.log(color(`     ${prefix} ${c.bold(appName)}${args.debug ? suffix : ''}`));
    });
    return;
  }

  if (needBackupAppNames.length === 0) {
    return logger.warn(`No app need ${actionPrefix.toLowerCase()}`);
  }

  const {
    storage: {
      directory = "backup",
      logs = 'logs',
      path: savePath = '/',
    } = {}
  } = config;

  const storagePath = path.join(savePath, directory);
  const logsPath = path.join(savePath, logs);

  const finalConfig = merge({}, config, {
    storage: { directory: storagePath, logs: logsPath },
  });

  const appsConfigs = await loadAppsConfigs(needBackupApps, { logger });

  if (args.config) {
    // https://github.com/lukeed/console-clear/blob/1999bde1861bfdf1cc86cd9b1e977197da8a8d49/index.js#L5
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H\x1Bc');

    console.log(dividerLine('Read Config', '-', c.green));
    console.log(JSON.stringify(config, null, 2));
    console.log(dividerLine('Final Config', '-', c.green));
    console.log(JSON.stringify(finalConfig, null, 2));
    console.log(dividerLine('Apps Config', '-', c.green));
    appsConfigs.forEach((appConfig, index) => {
      console.log(JSON.stringify(appConfig, null, 2));
      console.log(dividerLine());
    });
    return;
  }

  if (!fs.existsSync(storagePath)) {
    logger.warn(`Storage directory not found: ${storagePath}`);
    fs.ensureDirSync(storagePath);
    logger.info(`Create storage directory: ${storagePath}`);
  }

  fs.ensureDirSync(logsPath); // always create logs directory

  const logFile = new LogFile(actionPrefix, config.storage?.logs);

  if (args.prune) {
    await prune(appsConfigs, finalConfig, { logger, logFile });
    console.log(c.green().bold(`[${new Date().toLocaleTimeString(undefined, { hour12: false })}] Successful ${actionPrefix.toLowerCase()} finished!`));
    return;
  }

  for (const appConfig of appsConfigs) {
    logger.info(`${actionPrefix} ${c.bold(appConfig.application.name)} ...`);
    await backup(
      appConfig,
      finalConfig,
      {
        logger,
        logFile,
        force: args.restore
          /**
           * extra care needs to be taken and double confirmation!!!
           * needs to be enabled via environment variables.
           */
          ? (process.env.BACKUP_FORCE_RESTORE === 'true' && args.force)
          : args.force,
        restore: args.restore,
      }
    );
    logger.info(`${actionPrefix} ${c.bold(appConfig.application.name)} ${c.green('done')}\n`);
  }

  // successful backup finished
  console.log(c.green().bold(`[${new Date().toLocaleTimeString(undefined, { hour12: false })}] Successful ${actionPrefix.toLowerCase()} finished!`));
}

export default main;