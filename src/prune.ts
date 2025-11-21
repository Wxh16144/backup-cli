import fs from 'fs-extra';
import path from 'path';
import fg from 'fast-glob';
import type { LoggerType } from "./logger";
import type { AppConfig, Config } from "./type";
import { resolveHome, handleConfigFiles, isPathInside } from './util';
import type { LogFile } from './log';

type PruneOptions = {
  logger: LoggerType;
  logFile: LogFile;
}

async function removeEmptyDirs(dir: string) {
  if (!fs.existsSync(dir)) return;
  const stat = await fs.stat(dir);
  if (!stat.isDirectory()) return;

  let files = await fs.readdir(dir);
  if (files.length > 0) {
    for (const file of files) {
      const fullPath = path.join(dir, file);
      await removeEmptyDirs(fullPath);
    }
    // Re-read files after cleaning children
    files = await fs.readdir(dir);
  }

  if (files.length === 0) {
    await fs.rmdir(dir);
  }
}

/**
 * 标记 (Mark):
 *  1. 遍历所有应用的配置文件, 检查每个文件在本地是否存在。
 *    - 如果本地存在，则将其对应的备份路径标记为 "有效" (Valid)。
 *    - 如果本地不存在，则不标记（这意味着它会被视为垃圾）。
 * 扫描 (Sweep):
 *  1. 扫描整个备份目录中的所有文件。
 *  2. 如果一个文件不在 "有效" 列表中，且不属于任何 "有效" 目录，则将其视为孤儿文件或过期文件，直接删除。
 * 
 * 清理 (Cleanup):
 * 1. 删除备份目录中所有空的子目录。
 */

export async function prune(
  appsConfigs: AppConfig[],
  config: Config,
  options: PruneOptions
) {
  const { logger, logFile } = options;
  const {
    storage: { directory: storagePath = "backup" } = {}
  } = config;

  if (!fs.existsSync(storagePath)) {
    logger.warn('Backup directory does not exist, nothing to prune.');
    return;
  }

  logger.info('Analyzing backup files...');

  const validBackupFiles = new Set<string>();
  const validBackupDirs: string[] = [];

  // 1. 标记: 根据当前配置和本地存在性识别所有有效的备份文件
  // ========== MARK ==========
  for (const appConfig of appsConfigs) {
    const configurationFiles = handleConfigFiles(appConfig);
    for (const [filePath, isBackup] of Object.entries(configurationFiles)) {
      if (!isBackup) continue;

      const localPath = resolveHome(filePath);
      
      if (!fs.existsSync(localPath)) {
        // 本地文件缺失。不将其标记为有效。
        logger.debug(`[Prune] Local file missing: ${localPath}. Backup will be removed.`);
        continue;
      }

      //  计算预期的备份路径
      //  必须与 backup.ts 中的逻辑相匹配: path.join(storagePath, filePath)
      const backupFilePath = path.join(storagePath, filePath);
      
      // 区分文件和目录
      const stat = await fs.stat(localPath);
      
      if (stat.isDirectory()) {
        validBackupDirs.push(backupFilePath);
      } else {
        validBackupFiles.add(backupFilePath);
      }
    }
  }

  // 2. 扫描备份目录, 删除所有未标记为有效的文件
  // ========= SWEEP ==========
  const allBackupFiles = await fg('**/*', {
    cwd: storagePath,
    absolute: true,
    dot: true,
    ignore: ['.git', '.DS_Store', 'README.md', 'LICENSE'],
    onlyFiles: true,  // 只处理文件，目录将在清理阶段处理
  });

  for (const file of allBackupFiles) {
    // Normalize path for comparison
    const normalizedFile = path.resolve(file);

    // 验证通过，表明该文件是有效的备份文件
    if (validBackupFiles.has(normalizedFile)) continue;

    // 验证通过，表明该文件位于有效的备份目录中
    const isInsideValidDir = validBackupDirs.some(dir => {
        const normalizedDir = path.resolve(dir);
        return isPathInside(normalizedFile, normalizedDir);
    });
    
    if (isInsideValidDir) continue;

    // 删除孤儿文件或过期文件
    try {
      await fs.remove(file);
      logger.warn(`[Prune] Removed orphaned file: ${file}`);
      await logFile.append({
        target: file,
        source: 'ORPHAN',
        type: 'file',
        status: 'pruned',
        application: 'SYSTEM'
      });
    } catch (error) {
      logger.error(`[Prune] Failed to remove orphaned file ${file}: ${error}`);
    }
  }

  // ========== CLEANUP ==========
  await removeEmptyDirs(storagePath);
}

export default prune;
