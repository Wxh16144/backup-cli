import fs from 'fs-extra';
import path from 'path';

type LogOperation = 'Restore' | 'Backup' | 'Prune';
type SelectionSource = 'config' | 'app' | 'select';

interface LogScope {
  selectedApps: string[];
  selectionSource: SelectionSource;
  hasConfigOverrides: boolean;
}

export class LogFile {
  private basePath;
  private fileName;
  private operation;
  private scope;

  constructor(
    operation: LogOperation,
    basePath: string = process.cwd(),
    scope?: LogScope,
  ) {
    this.basePath = basePath;
    this.operation = operation;
    this.scope = scope;

    this.fileName = this.formatLogFileName(operation);
  }

  private async write(data: string) {
    await fs.appendFile(
      path.join(this.basePath, this.fileName),
      data + '\n'
    );
  }

  private sanitizeFileNamePart(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private formatLogFileName(operation: string) {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('')
    ].join('-');

    let scopeSuffix = '';
    if (this.scope?.selectionSource !== 'config') {
      if (this.scope.selectedApps.length === 1) {
        scopeSuffix = `-${this.sanitizeFileNamePart(this.scope.selectedApps[0])}`;
      } else if (this.scope.selectedApps.length > 1) {
        scopeSuffix = `-selected-${this.scope.selectedApps.length}apps`;
      }
    }

    return `${operation}${scopeSuffix}-${dateStr}.jsonl`;
  }

  get isRestored() {
    return String(this.operation).toLowerCase() === 'restore';
  }

  async init() {
    const now = new Date();
    return this.write(JSON.stringify({
      kind: 'meta',
      operation: this.operation,
      selectionSource: this.scope?.selectionSource ?? 'config',
      selectedApps: this.scope?.selectedApps ?? [],
      selectedAppCount: this.scope?.selectedApps.length ?? 0,
      hasConfigOverrides: this.scope?.hasConfigOverrides ?? false,
      timestamp: now.toISOString(),
      fileName: this.fileName,
    }));
  }

  async append(data: {
    target: string,
    source: string,
    type: 'file' | 'directory',
    status: 'success' | 'error' | 'skip' | 'pruned',
    application: string,
  }) {
    const obj = {
      ...data,
      ...(
        this.isRestored
          ? { source: path.relative(this.basePath, data.source) }
          : { target: path.relative(this.basePath, data.target) }
      )
    }
    return this.write(JSON.stringify(obj));
  }
}