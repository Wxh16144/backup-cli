import fs from 'fs-extra';
import prompts from "prompts";
import path from 'path';
import util from 'util';
import c from 'kleur';
import type { LoggerType } from "./logger";
import type { AppConfig, Config } from "./type";
import { resolveHome } from './util';

const readdir = util.promisify(fs.readdir);

async function isDirectoryEmpty(dirPath: string) {
  const files = await readdir(dirPath);
  return files.length === 0;
}

type BackupOptions = {
  logger: LoggerType;
  force?: boolean;
}

async function backupFile(
  sourceFilePath: string,
  backupFilePath: string,
  { logger, force = false }: BackupOptions
) {
  if (fs.existsSync(backupFilePath) && !force) {
    logger.warn(`backup file ${backupFilePath} already exists`);
    const response = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `Backup file ${c.yellow(backupFilePath)} already exists, do you want to overwrite it?`,
      initial: false,
    });

    if (response.overwrite) {
      logger.debug('backup file already exists, overwrite');
    } else {
      logger.debug('backup file already exists, skip');
      return;
    }
  }

  await fs.copyFile(sourceFilePath, backupFilePath);

  logger.event(`File backup success: ${sourceFilePath} -> ${backupFilePath}`);
}

async function backupDirectory(
  sourceDirectoryPath: string,
  backupDirectoryPath: string,
  { logger, force = false }: BackupOptions
) {

  if (!fs.existsSync(backupDirectoryPath)) {
    logger.warn(`Backup directory not exists, create it: ${backupDirectoryPath}`);
    fs.ensureDirSync(backupDirectoryPath);
  }

  if (!isDirectoryEmpty(backupDirectoryPath) && !force) {
    const response = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `Backup directory ${c.yellow(backupDirectoryPath)} not empty, do you want to overwrite it?`,
      initial: false,
    });

    if (response.overwrite) {
      logger.debug('Backup directory not empty, overwrite');
    } else {
      logger.debug('Backup directory not empty, skip');
      return;
    }
  }

  await fs.copy(sourceDirectoryPath, backupDirectoryPath);

  logger.debug(`Backup directory: ${sourceDirectoryPath} -> ${backupDirectoryPath}`);
}


async function backup(
  appConfig: AppConfig,
  config: Config,
  { logger, force = false }: BackupOptions
) {

  const configurationFiles = appConfig.configuration_files ?? {};

  if (Object.keys(configurationFiles).length === 0) {
    logger.warn('No configuration files to backup');
    return;
  }

  const {
    storage: { directory: storagePath = "backup" } = {}
  } = config;

  for (const [filePath, isBackup] of Object.entries(configurationFiles)) {
    if (isBackup) {
      const sourceFilePath = resolveHome(filePath);
      const backupFilePath = resolveHome(path.join(storagePath, filePath));

      if (!fs.existsSync(sourceFilePath)) {
        logger.debug(`the file or directory does not exist: ${sourceFilePath}, no backup is required`);
        continue;
      }


      if (sourceFilePath === backupFilePath) {
        logger.error(`source file path and backup file path are the same: ${sourceFilePath}`);
        continue;
      }

      const stats = await fs.stat(sourceFilePath);

      if (stats.isDirectory()) {
        await backupDirectory(
          sourceFilePath,
          backupFilePath,
          { logger, force }
        );
      }

      if (stats.isFile()) {
        await backupFile(
          sourceFilePath,
          backupFilePath,
          { logger, force }
        );
      }
    }
  }
}

export default backup;