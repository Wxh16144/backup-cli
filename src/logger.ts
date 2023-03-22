import c, { type Color } from "kleur";

type LogLevel = 'info' | 'warn' | 'debug' | 'error';

function generateLogger(level: LogLevel) {
  const cMap: Record<LogLevel, Color> = {
    info: c.green,
    warn: c.yellow,
    debug: c.bgMagenta().white,
    error: c.red,
  }
  return function (message: string) {
    console.log(`${cMap[level](level.toUpperCase())} - ${message}`);
  }
}

type options = {
  isDebug?: boolean;
  quietOnly?: boolean;
}

export type LoggerType = {
  [key in LogLevel]: (message: string) => void;
}

class Logger implements LoggerType {
  private isDebug: boolean;
  private quietOnly: boolean;

  constructor(options: options) {
    const {
      isDebug = false,
      quietOnly = false
    } = options

    this.isDebug = isDebug;
    this.quietOnly = quietOnly;
  }

  info(message: string) {
    generateLogger('info')(message);
  }

  warn(message: string) {
    if (this.quietOnly) return;
    generateLogger('warn')(message);
  }

  debug(message: string) {
    if (!this.isDebug || this.quietOnly) return;
    generateLogger('debug')(message);
  }

  error(message: string) {
    generateLogger('error')(message);
  }
}

export default Logger;