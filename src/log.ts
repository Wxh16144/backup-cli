import fs from 'fs-extra';
import path from 'path';

export class LogFile {
  private basePath;
  private fileName;
  private operation;

  constructor(
    operation: 'Restore' | 'Backup',
    basePath: string = process.cwd()
  ) {
    this.basePath = basePath;
    this.operation = operation;

    this.fileName = this.formatLogFileName(operation);
  }

  private async write(data: string) {
    await fs.appendFile(
      path.join(this.basePath, this.fileName),
      data + '\n'
    );
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
    return `${operation}-${dateStr}.jsonl`;
  }

  get isRestored() {
    return String(this.operation).toLowerCase() === 'restore';
  }

  async append(data: {
    target: string,
    source: string,
    type: 'file' | 'directory',
    status: 'success' | 'error' | 'skip',
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