import c, { type Color } from "kleur";

type LogLevel = 'info' | 'warn' | 'debug' | 'error' | 'event';

function generateLogger(level: LogLevel) {
  const cMap: Record<LogLevel, Color> = {
    info: c.green,
    warn: c.yellow,
    debug: c.bgMagenta().white,
    error: c.red,
    event: c.cyan,
  }
  return function (message: string) {
    console.log(`${cMap[level](level)} - ${message}`);
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

  event(message: string) {
    generateLogger('event')(message);
  }
}

export default Logger;