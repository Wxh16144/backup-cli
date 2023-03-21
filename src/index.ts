import fs from "fs";
import { fileURLToPath } from 'url';
import path from "path";
import c from "kleur";
import mri from "mri";
import { Argv } from "./type";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolvePath = (...arg: any[]) => path.resolve(__dirname, '..', ...arg);
const readFileSync = (path: string) => fs.readFileSync(resolvePath(path), 'utf8');
const pkg = JSON.parse(readFileSync('./package.json'));
const command = Object.keys(pkg.bin ?? {})[0] ?? pkg.name;
// const moduleName = pkg.name.replace(/^@.*\//, '')

const argv = mri<Argv>(process.argv.slice(2), {
  alias: { h: 'help', v: 'version' },
});

async function main(args: Argv = argv) {
  if (args.version) {
    console.log(`${c.bold(pkg.name)}: ${c.green('v' + pkg.version)}`);
    return;
  }

  if (args.help) {
    console.log(`
    npx ${c.bold(command)} [options]
    ----------------------------------------
    -${c.bold('h')}, --help: show help.
    -${c.bold('v')}, --version: show version. ${c.green('v' + pkg.version)}
    ----------------------------------------
    ${c.bold('e.g.')} ${c.green(`${command} -h`)} 
  `)
    return;
  }

  console.log(`Welcome ${c.green(pkg.name)}`);
}

export default main;
