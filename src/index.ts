import fs from "fs";
import { fileURLToPath } from 'url';
import path from "path";
import c from "kleur";
import mri from "mri";
import type { Argv } from "./type";
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
    h: 'help',
    v: 'version',
    l: 'list',
    d: 'debug',
    f: 'force',
  },
});

async function run(args: Argv = argv) {
  if (args.version) {
    console.log(`${c.bold(pkg.name)}: ${c.green('v' + pkg.version)}`);
    return;
  }

  if (args.help) {
    console.log(`
    npx ${c.bold(command)} [options]
    ----------------------------------------
    -${c.bold('l')}, --list: list all apps. (${c.green('* [name]')}: backup, -: not backup)
    -${c.bold('d')}, --debug: show debug info.
    -${c.bold('f')}, --force: force to backup (overwrite files).
    -${c.bold('h')}, --help: show help.
    -${c.bold('v')}, --version: show version. ${c.green('v' + pkg.version)}
    ----------------------------------------
    ${c.bold('e.g.')} ${c.green(`${command} -h`)} 
  `)
    return;
  }

  main(args, {
    logger: new Logger({
      isDebug: args.debug,
    })
  });
}

export default run;
