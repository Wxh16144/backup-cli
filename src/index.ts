import fs from "fs";
import { fileURLToPath } from 'url';
import path from "path";
import c from "kleur";
import mri from "mri";
import type { Argv, NormalizedArgv } from "./type";
import main from "./main";
import Logger from "./logger";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolvePath = (...arg: any[]) => path.resolve(__dirname, '..', ...arg);
const readFileSync = (path: string) => fs.readFileSync(resolvePath(path), 'utf8');
const pkg = JSON.parse(readFileSync('./package.json'));
const command = Object.keys(pkg.bin ?? {})[0] ?? pkg.name;
// const moduleName = pkg.name.replace(/^@.*\//, '')

const argv = mri<Argv>(process.argv.slice(2), {
  alias: {
    a: 'app',
    h: 'help',
    v: 'version',
    l: 'list',
    s: 'select',
    d: 'debug',
    f: 'force',
    c: 'config',
    r: 'restore',
    p: 'prune',
  },
});

function normalizeAppArgs(app: Argv['app']) {
  if (!app) return undefined;

  const appNames = (Array.isArray(app) ? app : [app])
    .flatMap(item => String(item).split(','))
    .map(item => item.trim())
    .filter(Boolean);

  return Array.from(new Set(appNames));
}

async function run(args: Argv = argv) {
  const normalizedArgs: NormalizedArgv = {
    ...args,
    app: normalizeAppArgs(args.app),
  };

  if (args.version) {
    console.log(`${c.bold(pkg.name)}: ${c.green('v' + pkg.version)}`);
    return;
  }

  if (args.help) {
    console.log(`
    npx ${c.bold(command)} [options]
    ----------------------------------------
    -${c.bold('l')}, --list: list all apps.
    -${c.bold('a')}, --app: only run selected app(s); supports repeated flags and comma-separated values.
    -${c.bold('s')}, --select: interactively search and select apps.
    -${c.bold('f')}, --force: force to backup (overwrite files).
    -${c.bold('c')}, --config: view config.
    -${c.bold('r')}, --restore: restore backup.
    -${c.bold('p')}, --prune: delete files from backup that do not exist locally or are no longer in config.
    -${c.bold('h')}, --help: show help.
    -${c.bold('d')}, --debug: show debug info.
    -${c.bold('v')}, --version: show version. ${c.green('v' + pkg.version)}
    ----------------------------------------
    ${c.bold('e.g.')} ${c.green(`${command} -h`)} 
  `)
    return;
  }

  main(normalizedArgs, {
    logger: new Logger({
      isDebug: normalizedArgs.debug || process.env.DEBUG === command,
    })
  });
}

export default run;
