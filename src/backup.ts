import fs from 'fs-extra';
import prompts from "prompts";
import path from 'path';
import util from 'util';
import c from 'kleur';
import type { LoggerType } from "./logger";
import type { AppConfig, Config } from "./type";
import { isPathInside, resolveHome, resolveXDGConfig } from './util';
import type { LogFile } from './log';

const readdir = util.promisify(fs.readdir);

async function isDirectoryEmpty(dirPath: string) {
  const files = await readdir(dirPath);
  return files.length === 0;
}

type BackupOptions = {
  logger: LoggerType;
  logFile: LogFile;
  force?: boolean;
  restore?: boolean;
}

async function backupFile(
  sourceFilePath: string,
  backupFilePath: string,
  { logger, force = false, restore = false, logFile }: BackupOptions
) {

  const action = restore ? 'restore' : 'backup';

  if (fs.existsSync(backupFilePath) && !force) {
    logger.warn(`${action} file ${backupFilePath} already exists`);
    const response = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `${action} file ${c.yellow(backupFilePath)} already exists, do you want to overwrite it?`,
    });

    if (response.hasOwnProperty('overwrite')) {
      if (response.overwrite) {
        logger.debug(`${action} file already exists, overwrite`);
      } else {
        logger.debug(`${action} file already exists, skip`);
        logFile.append({ target: backupFilePath, source: sourceFilePath, type: 'file', status: 'skip' })
        return;
      }
    } else {
      process.exit(0);
    }
  }

  const backupFileDirectory = path.dirname(backupFilePath);
  if (!fs.existsSync(backupFileDirectory)) {
    logger.debug(`${action} file directory not exists, create it: ${backupFileDirectory}`);
    fs.ensureDirSync(backupFileDirectory);
  }

  return fs.copy(
    sourceFilePath,
    backupFilePath,
    {
      dereference: true, // copy symlinks as symlinks
    }
  )
    .then(() => {
      logger.event(`File ${action} success: ${sourceFilePath} -> ${backupFilePath}`);
      logFile.append({ target: backupFilePath, source: sourceFilePath, type: 'file', status: 'success' })
    })
    .catch(() => {
      logger.error(`File ${action} error: ${sourceFilePath} -> ${backupFilePath}`);
      logFile.append({ target: backupFilePath, source: sourceFilePath, type: 'file', status: 'error' })
    });

}

async function backupDirectory(
  sourceDirectoryPath: string,
  backupDirectoryPath: string,
  { logger, force = false, restore = false, logFile }: BackupOptions
) {
  const action = restore ? 'restore' : 'backup';

  if (!fs.existsSync(backupDirectoryPath)) {
    logger.warn(`${action} directory not exists, create it: ${backupDirectoryPath}`);
    fs.ensureDirSync(backupDirectoryPath);
  }

  if (!isDirectoryEmpty(backupDirectoryPath) && !force) {
    const response = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `${action} directory ${c.yellow(backupDirectoryPath)} not empty, do you want to overwrite it?`,
    });

    if (response.hasOwnProperty('overwrite')) {
      if (response.overwrite) {
        logger.debug(`${action} directory not empty, overwrite`);
      } else {
        logger.debug(`${action} directory not empty, skip`);
        logFile.append({ target: backupDirectoryPath, source: sourceDirectoryPath, type: 'directory', status: 'skip' })
        return;
      }
    }
  }

  return fs.copy(
    sourceDirectoryPath,
    backupDirectoryPath,
  )
    .then(() => {
      logger.event(`Directory ${action} success: ${sourceDirectoryPath} -> ${backupDirectoryPath}`);
      logFile.append({ target: backupDirectoryPath, source: sourceDirectoryPath, type: 'directory', status: 'success' })
    })
    .catch(() => {
      logger.error(`Directory ${action} error: ${sourceDirectoryPath} -> ${backupDirectoryPath}`);
      logFile.append({ target: backupDirectoryPath, source: sourceDirectoryPath, type: 'directory', status: 'error' })
    });
}

function handleConfigFiles(appConfig: AppConfig) {
  const finalConfigFiles: Record<string, boolean> = {
    ...(appConfig.configuration_files ?? {}),
  };

  const xdgConfigFiles = appConfig.xdg_configuration_files ?? {};

  for (const [filePath, isBackup] of Object.entries(xdgConfigFiles)) {
    if (path.isAbsolute(filePath)) continue; // Unsupported absolute path

    finalConfigFiles[resolveXDGConfig(filePath)] = isBackup;
  }

  return finalConfigFiles;
}

async function backup(
  appConfig: AppConfig,
  config: Config,
  options: BackupOptions
) {
  const { logger, restore = false } = options;

  const configurationFiles = handleConfigFiles(appConfig);

  if (Object.keys(configurationFiles).length === 0) {
    logger.warn('No configuration files to backup');
    return;
  }

  const action = restore ? 'restore' : 'backup';

  const {
    storage: { directory: storagePath = "backup" } = {}
  } = config;

  for (const [filePath, isBackup] of Object.entries(configurationFiles)) {
    if (isBackup) {
      let sourceFilePath = resolveHome(filePath);
      let backupFilePath = path.join(storagePath, filePath);

      if (restore) {
        [sourceFilePath, backupFilePath] = [backupFilePath, sourceFilePath];

        // 上游 $HOME (通常指还原别人的备份文件, 他们的 $HOME 不一样)
        const upstreamHome = process.env.BACKUP_UPSTREAM_HOME,
          restoreHome = resolveHome();
        if (
          typeof upstreamHome === 'string' &&
          upstreamHome.length > 0 &&
          upstreamHome !== restoreHome
        ) {
          const realBackedPath = path.join(storagePath, upstreamHome);
          const restoredPath = path.join(storagePath, restoreHome);

          logger.debug(`[restore] upstream home: ${realBackedPath} -> ${restoredPath}`);

          sourceFilePath = sourceFilePath.replace(
            new RegExp(`^${restoredPath}`),
            realBackedPath
          );
        }
      }

      if (!fs.existsSync(sourceFilePath)) {
        logger.debug(`the file or directory does not exist: ${sourceFilePath}, no ${action} is required`);
        continue;
      }


      if (
        sourceFilePath === backupFilePath ||
        path.resolve(sourceFilePath) === path.resolve(backupFilePath)
      ) {
        logger.error(`source file path and ${action} file path are the same: ${sourceFilePath}`);
        continue;
      }

      if (isPathInside(backupFilePath, sourceFilePath)) {
        logger.error(`source file path is inside ${action} file path: ${sourceFilePath} -> ${backupFilePath}`);
        continue;
      }

      const stats = await fs.stat(sourceFilePath);

      if (stats.isDirectory()) {
        await backupDirectory(
          sourceFilePath,
          backupFilePath,
          options,
        );
      }

      if (stats.isFile()) {
        await backupFile(
          sourceFilePath,
          backupFilePath,
          options,
        );
      }
    }
  }
}

export default backup;