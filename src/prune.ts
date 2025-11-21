import fs from 'fs-extra';
import path from 'path';
import type { LoggerType } from "./logger";
import type { AppConfig, Config } from "./type";
import { resolveHome, resolveXDGConfig, handleConfigFiles } from './util';
import type { LogFile } from './log';

type PruneOptions = {
  logger: LoggerType;
  logFile: LogFile;
}

async function prune(
  appConfig: AppConfig,
  config: Config,
  options: PruneOptions
) {
  const { logger, logFile } = options;

  const configurationFiles = handleConfigFiles(appConfig);

  if (Object.keys(configurationFiles).length === 0) {
    return;
  }

  const {
    storage: { directory: storagePath = "backup" } = {}
  } = config;

  for (const [filePath, isBackup] of Object.entries(configurationFiles)) {
    if (!isBackup) {
      continue;
    }
    const sourceFilePath = resolveHome(filePath);
    const backupFilePath = path.join(storagePath, filePath);

    if (!fs.existsSync(sourceFilePath)) {
      if (fs.existsSync(backupFilePath)) {
        try {
          const stat = await fs.stat(backupFilePath);
          const isDir = stat.isDirectory();
          await fs.remove(backupFilePath);
          logger.warn(`[Prune] Removed ${isDir ? 'directory' : 'file'} from backup: ${backupFilePath}`);
          await logFile.append({
            target: backupFilePath,
            source: sourceFilePath,
            type: isDir ? 'directory' : 'file',
            status: 'pruned',
            application: appConfig.application.name
          });
        } catch (error) {
          logger.error(`[Prune] Failed to remove ${backupFilePath}: ${error}`);
        }
      }
    }
  }
}

export default prune;
