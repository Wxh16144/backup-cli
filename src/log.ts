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

    this.fileName = `${operation}-${Date.now()}.jsonl`;
  }

  private async write(data: string) {
    await fs.appendFile(
      path.join(this.basePath, this.fileName),
      data + '\n'
    );
  }
  get isRestored() {
    return String(this.operation).toLowerCase() === 'restore';
  }

  async append(data: {
    target: string,
    source: string,
    type: 'file' | 'directory',
    status: 'success' | 'error' | 'skip',
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