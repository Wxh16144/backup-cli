import c from "kleur";
import type { Argv } from "./type";
import type { LoggerType } from './logger'

interface Options {
  logger: LoggerType;
}

async function main(args: Argv, { logger }: Options) {
  logger.info('hello world');
  logger.error('hello world');
  logger.warn('hello world');
  logger.debug('hello world');
  console.log(`Welcome ${c.bold("to")} ${c.green("deno")}!`);
}

export default main;