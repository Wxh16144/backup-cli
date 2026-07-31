import c from "kleur";
import path from "path";
import fs from "fs-extra";
import prompts from 'prompts';
import backup from "./backup";
import prune from "./prune";

import type { Config, NormalizedArgv } from "./type";
import type { LoggerType } from './logger'
import { getAppConfigs, getApps, loadAppsConfigs } from './list'
import { dividerLine, getConfig, merge } from "./util";
import { LogFile } from "./log-file";

type SelectionSource = 'config' | 'app' | 'select';

type SelectedAppsResult = {
  hasConfigOverrides: boolean;
  selectedAppNames: string[];
  selectedApps: Record<string, string>;
  selectionSource: SelectionSource;
};

interface Options {
  logger: LoggerType;
}

function getConfiguredAppNames(appMap?: Record<string, boolean>) {
  return Object.entries(appMap ?? {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([appName]) => appName);
}

function warnForMissingConfiguredApps(
  discoveredApps: Record<string, string>,
  config: Config,
  logger: LoggerType,
) {
  const discoveredAppNames = new Set(Object.keys(discoveredApps));
  const missingSyncApps = getConfiguredAppNames(config.applications_to_sync)
    .filter(appName => !discoveredAppNames.has(appName));
  const missingIgnoredApps = getConfiguredAppNames(config.applications_to_ignore)
    .filter(appName => !discoveredAppNames.has(appName));

  if (missingSyncApps.length > 0) {
    logger.warn(`Configured app(s) not found in discovered apps: ${missingSyncApps.join(', ')}. Run --list or --select to verify available names.`);
  }

  if (missingIgnoredApps.length > 0) {
    logger.warn(`Ignored app(s) not found in discovered apps: ${missingIgnoredApps.join(', ')}. Run --list to verify available names.`);
  }
}

function requiresSyncOptIn(config: Config) {
  return Object.keys(config.applications_to_sync ?? {}).length > 0;
}

function buildSelectedApps(
  appNames: string[],
  discoveredApps: Record<string, string>,
) {
  return appNames.reduce<Record<string, string>>((acc, appName) => {
    acc[appName] = discoveredApps[appName];
    return acc;
  }, {});
}

function warnForConfigOverrides(
  selectedAppNames: string[],
  configSelectedApps: Record<string, string>,
  config: Config,
  logger: LoggerType,
  action: string,
) {
  const hasSyncFilter = requiresSyncOptIn(config);
  let hasConfigOverrides = false;

  for (const appName of selectedAppNames) {
    if (configSelectedApps[appName]) continue;

    hasConfigOverrides = true;

    if (config.applications_to_ignore?.[appName]) {
      logger.warn(`App ${c.bold(appName)} is ignored by config, but it will ${action} because it was explicitly selected.`);
      continue;
    }

    if (hasSyncFilter && !config.applications_to_sync?.[appName]) {
      logger.warn(`App ${c.bold(appName)} is not enabled in applications_to_sync, but it will ${action} because it was explicitly selected.`);
      continue;
    }

    logger.warn(`App ${c.bold(appName)} is not part of the current config set, but it will ${action} because it was explicitly selected.`);
  }

  return hasConfigOverrides;
}

async function promptForAppSelection(
  appNames: string[],
  configuredAppNames: Set<string>,
  action: string,
) {
  const response = await prompts({
    type: 'autocompleteMultiselect',
    name: 'apps',
    message: `Select app(s) to ${action}`,
    instructions: 'Type to filter. Space to toggle. Enter to confirm.',
    hint: '- Space to select. Return to submit',
    choices: appNames.map((appName) => ({
      title: configuredAppNames.has(appName) ? `${appName} [configured]` : appName,
      value: appName,
    })),
  });

  if (!Object.prototype.hasOwnProperty.call(response, 'apps')) {
    return null;
  }

  return Array.isArray(response.apps) ? response.apps as string[] : [];
}

async function resolveSelectedApps(
  args: NormalizedArgv,
  apps: Record<string, string>,
  needBackupApps: Record<string, string>,
  config: Config,
  logger: LoggerType,
  action: string,
): Promise<SelectedAppsResult | null> {
  const requestedAppNames = args.app ?? [];
  const allAppNames = Object.keys(apps);

  if (requestedAppNames.length > 0) {
    if (args.select) {
      logger.warn('--select is ignored because --app was provided.');
    }

    const missingAppNames = requestedAppNames.filter(appName => !apps[appName]);
    if (missingAppNames.length > 0) {
      logger.error(`Unknown app(s): ${missingAppNames.join(', ')}. Run --list or --select to discover valid app names.`);
      return null;
    }

    const hasConfigOverrides = warnForConfigOverrides(requestedAppNames, needBackupApps, config, logger, action);

    return {
      hasConfigOverrides,
      selectedAppNames: requestedAppNames,
      selectedApps: buildSelectedApps(requestedAppNames, apps),
      selectionSource: 'app',
    };
  }

  if (args.select) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      logger.error('Interactive app selection requires a TTY. Use --app or --list instead.');
      return null;
    }

    const selectedAppNames = await promptForAppSelection(
      allAppNames,
      new Set(Object.keys(needBackupApps)),
      action,
    );

    if (selectedAppNames === null) {
      logger.warn('App selection cancelled.');
      return null;
    }

    if (selectedAppNames.length === 0) {
      logger.warn('No app selected.');
      return null;
    }

    const hasConfigOverrides = warnForConfigOverrides(selectedAppNames, needBackupApps, config, logger, action);

    return {
      hasConfigOverrides,
      selectedAppNames,
      selectedApps: buildSelectedApps(selectedAppNames, apps),
      selectionSource: 'select',
    };
  }

  return {
    hasConfigOverrides: false,
    selectedAppNames: Object.keys(needBackupApps),
    selectedApps: needBackupApps,
    selectionSource: 'config',
  };
}

async function main(args: NormalizedArgv, { logger }: Options) {
  const config = getConfig({ logger });
  logger.debug(`read config: ${JSON.stringify(config, null, 2)} `);
  const appConfigPaths = await getAppConfigs();
  const apps = await getApps(appConfigPaths);
  const appNames = Object.keys(apps);

  const needBackupApps = await getApps(appConfigPaths, config);
  const needBackupAppNames = Object.keys(needBackupApps);
  const actionPrefix = args.restore ? 'Restore' : (args.prune ? 'Prune' : 'Backup');
  const actionName = actionPrefix.toLowerCase();

  warnForMissingConfiguredApps(apps, config, logger);

  if (args.list) {
    logger.info(`Found ${appNames.length} apps, ${needBackupAppNames.length} of them need ${c.bold(actionName)}`);
    appNames.forEach(appName => {
      const isBackup = needBackupAppNames.includes(appName);

      const color = isBackup ? c.green : c.red;
      const suffix = isBackup ? ` (${actionPrefix})` : c.red(" (Ignore)");
      const prefix = isBackup ? "+" : "-";
      console.log(color(`     ${prefix} ${c.bold(appName)}${args.debug ? suffix : ''}`));
    });
    return;
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

  const selectedAppsResult = await resolveSelectedApps(
    args,
    apps,
    needBackupApps,
    config,
    logger,
    actionName,
  );

  if (!selectedAppsResult) {
    return;
  }

  const {
    hasConfigOverrides,
    selectedAppNames,
    selectedApps,
    selectionSource,
  } = selectedAppsResult;

  if (selectedAppNames.length === 0) {
    return logger.warn(`No app need ${actionName}`);
  }

  const appsConfigs = await loadAppsConfigs(selectedApps, { logger });

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

  const logFile = new LogFile(actionPrefix, logsPath, {
    selectedApps: selectedAppNames,
    selectionSource,
    hasConfigOverrides,
  });
  await logFile.init();

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