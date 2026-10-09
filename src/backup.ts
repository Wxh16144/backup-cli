import fs from 'fs-extra';
import prompts from "prompts";
import path from 'path';
import util from 'util';
import c from 'kleur';
import type { LoggerType } from "./logger";
import type { AppConfig, Config } from "./type";
import { isPathInside, resolveHome, handleConfigFiles, toRelativePath } from './util';
import type { LogFile } from './log-file';

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
  quiet?: boolean;
}

interface BackupOptionsWithApp extends BackupOptions {
  application: string;
}

/**
 * Pure path derivation shared by backup/restore.
 * On restore the source/target are swapped, and BACKUP_UPSTREAM_HOME remaps
 * a backup recorded under another user's home to the current one.
 */
export function resolveBackupPaths(
  filePath: string,
  storagePath: string,
  { restore = false, upstreamHome }: { restore?: boolean; upstreamHome?: string } = {},
) {
  const home = resolveHome();
  let sourceFilePath = resolveHome(filePath);
  let backupFilePath = path.join(storagePath, filePath);

  if (restore) {
    [sourceFilePath, backupFilePath] = [backupFilePath, sourceFilePath];

    if (
      typeof upstreamHome === 'string' &&
      upstreamHome.length > 0 &&
      upstreamHome !== home
    ) {
      const realBackedPath = path.join(storagePath, upstreamHome);
      const restoredPath = path.join(storagePath, home);

      if (sourceFilePath.startsWith(restoredPath)) {
        const relative = path.relative(restoredPath, sourceFilePath);
        sourceFilePath = path.join(realBackedPath, relative);
      }
    }
  }

  return { sourceFilePath, backupFilePath };
}

async function backupFile(
  sourceFilePath: string,
  backupFilePath: string,
  { logger, force = false, restore = false, quiet = false, logFile, application }: BackupOptionsWithApp
): Promise<boolean> {

  const action = restore ? 'restore' : 'backup';

  if (fs.existsSync(backupFilePath) && !force) {
    if (quiet) {
      logger.warn(`${action} file ${backupFilePath} already exists, skipped (quiet mode)`);
      await logFile.append({ target: backupFilePath, source: sourceFilePath, type: 'file', status: 'skip', application });
      return true;
    }

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
        await logFile.append({ target: backupFilePath, source: sourceFilePath, type: 'file', status: 'skip', application });
        return true;
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

  const [
    showSourceFilePath,
    showBackupFilePath
  ] = (function () {
    if (restore) {
      return [toRelativePath(sourceFilePath), backupFilePath];
    }
    return [sourceFilePath, toRelativePath(backupFilePath)];
  }());

  try {
    await fs.copy(
      sourceFilePath,
      backupFilePath,
      {
        dereference: true, // follow symlinks so the backup is self-contained
      }
    );
    logger.event(`File ${action} success: ${showSourceFilePath} -> ${showBackupFilePath}`);
    await logFile.append({ target: backupFilePath, source: sourceFilePath, type: 'file', status: 'success', application });
    return true;
  } catch (error) {
    logger.error(`File ${action} error: ${showSourceFilePath} -> ${showBackupFilePath} (${error})`);
    await logFile.append({ target: backupFilePath, source: sourceFilePath, type: 'file', status: 'error', application });
    return false;
  }
}

async function backupDirectory(
  sourceDirectoryPath: string,
  backupDirectoryPath: string,
  { logger, force = false, restore = false, quiet = false, logFile, application }: BackupOptionsWithApp
): Promise<boolean> {
  const action = restore ? 'restore' : 'backup';

  if (!fs.existsSync(backupDirectoryPath)) {
    logger.warn(`${action} directory not exists, create it: ${backupDirectoryPath}`);
    fs.ensureDirSync(backupDirectoryPath);
  }

  if (!await isDirectoryEmpty(backupDirectoryPath) && !force) {
    if (quiet) {
      logger.warn(`${action} directory ${backupDirectoryPath} not empty, skipped (quiet mode)`);
      await logFile.append({ target: backupDirectoryPath, source: sourceDirectoryPath, type: 'directory', status: 'skip', application });
      return true;
    }

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
        await logFile.append({ target: backupDirectoryPath, source: sourceDirectoryPath, type: 'directory', status: 'skip', application });
        return true;
      }
    } else {
      process.exit(0);
    }
  }

  try {
    await fs.copy(
      sourceDirectoryPath,
      backupDirectoryPath,
      {
        dereference: true, // follow symlinks so the backup is self-contained
      }
    );
    logger.event(`Directory ${action} success: ${sourceDirectoryPath} -> ${backupDirectoryPath}`);
    await logFile.append({ target: backupDirectoryPath, source: sourceDirectoryPath, type: 'directory', status: 'success', application });
    return true;
  } catch (error) {
    logger.error(`Directory ${action} error: ${sourceDirectoryPath} -> ${backupDirectoryPath} (${error})`);
    await logFile.append({ target: backupDirectoryPath, source: sourceDirectoryPath, type: 'directory', status: 'error', application });
    return false;
  }
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
    return true;
  }

  const action = restore ? 'restore' : 'backup';

  const {
    storage: { directory: storagePath = "backup" } = {}
  } = config;

  let success = true;

  for (const [filePath, isBackup] of Object.entries(configurationFiles)) {
    if (!isBackup) {
      logger.debug(`skip file: ${filePath}`);
      continue;
    }

    const { sourceFilePath, backupFilePath } = resolveBackupPaths(filePath, storagePath, {
      restore,
      upstreamHome: process.env.BACKUP_UPSTREAM_HOME,
    });

    const mergedOptions: BackupOptionsWithApp = {
      ...options,
      application: appConfig.application.name,
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
      success = false;
      continue;
    }

    // never let a config entry escape the storage root
    const storageSidePath = restore ? sourceFilePath : backupFilePath;
    if (!isPathInside(path.resolve(storageSidePath), path.resolve(storagePath))) {
      logger.error(`configuration file escapes the ${action} directory: ${storageSidePath} (storage: ${storagePath})`);
      success = false;
      continue;
    }

    if (isPathInside(backupFilePath, sourceFilePath)) {
      logger.error(`source file path is inside ${action} file path: ${sourceFilePath} -> ${backupFilePath}`);
      success = false;
      continue;
    }

    const stats = await fs.stat(sourceFilePath);

    if (stats.isDirectory()) {
      success = (await backupDirectory(sourceFilePath, backupFilePath, mergedOptions)) && success;
    }

    if (stats.isFile()) {
      success = (await backupFile(sourceFilePath, backupFilePath, mergedOptions)) && success;
    }
  }

  return success;
}

export default backup;