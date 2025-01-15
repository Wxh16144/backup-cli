import fs from 'fs-extra';
import path from 'path';

export class LogFile {
  private basePath;
  private fileName;

  constructor(
    operation: string,
    basePath: string = process.cwd()
  ) {
    this.basePath = basePath;

    this.fileName = `${Date.now()}-${operation}.jsonl`;
  }

  private async write(data: string) {
    await fs.appendFile(
      path.join(this.basePath, this.fileName),
      data + '\n'
    );
  }

  async append(data: {
    target: string,
    source: string,
    type: 'file' | 'directory',
    status: 'success' | 'error' | 'skip',
  }) {
    await this.write(JSON.stringify({
      ...data,
      target: path.relative(this.basePath, data.target),
      // timestamp: Date.now(),
    }));
  }
}