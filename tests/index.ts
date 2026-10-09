import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { test } from 'manten';
import { execa } from 'execa';
import { createFixture } from 'fs-fixture';

import { resolveBackupPaths } from '../src/backup';
import { getConfigOverrideWarnings } from '../src/main';
import { normalizeAppArgs } from '../src/util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(__dirname, '../dev.ts');
// resolve tsx absolutely: the child's cwd is the fixture, which has no node_modules
const tsxLoader = createRequire(import.meta.url).resolve('tsx');
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

function runCli(fixturePath: string, args: string[] = [], extraEnv: Record<string, string> = {}) {
  return execa('node', ['--import', tsxLoader, cliPath, ...args], {
    cwd: fixturePath,
    reject: false,
    env: {
      ...process.env,
      HOME: fixturePath,
      XDG_CONFIG_HOME: path.join(fixturePath, '.config'),
      BACKUP_CONFIG_FILE: path.join(fixturePath, '.backuprc'),
      BACKUP_CUSTOM_APP_DIR: path.join(fixturePath, '.backup'),
      BACKUP_DEFAULT_APP_DIR: '',
      BACKUP_QUIET: 'true',
      BACKUP_UPSTREAM_HOME: '',
      BACKUP_FORCE_RESTORE: '',
      ...extraEnv,
    },
  });
}

function backupRc(fixturePath: string, apps: string[], directory = 'backup') {
  return [
    '[storage]',
    `path = ${fixturePath}`,
    `directory = ${directory}`,
    '',
    '[applications_to_sync]',
    ...apps,
    '',
  ].join('\n');
}

function appCfg(name: string, files: string[]) {
  return [
    '[application]',
    `name = ${name}`,
    '',
    '[configuration_files]',
    ...files,
    '',
  ].join('\n');
}

function appCfgXdg(name: string, xdgFiles: string[]) {
  return [
    '[application]',
    `name = ${name}`,
    '',
    '[xdg_configuration_files]',
    ...xdgFiles,
    '',
  ].join('\n');
}

function backupRcFull(
  fixturePath: string,
  { sync = [], ignore = [], directory = 'backup' }: { sync?: string[]; ignore?: string[]; directory?: string } = {},
) {
  const lines = ['[storage]', `path = ${fixturePath}`, `directory = ${directory}`, ''];
  if (sync.length) lines.push('[applications_to_sync]', ...sync, '');
  if (ignore.length) lines.push('[applications_to_ignore]', ...ignore, '');
  return lines.join('\n');
}

test('pure: normalizeAppArgs flattens, splits and dedupes', () => {
  if (normalizeAppArgs(undefined) !== undefined) throw new Error('undefined input');
  const result = normalizeAppArgs(['zsh,git', 'zsh', '  a  ']);
  if (JSON.stringify(result) !== JSON.stringify(['zsh', 'git', 'a'])) {
    throw new Error(`unexpected: ${JSON.stringify(result)}`);
  }
});

test('pure: getConfigOverrideWarnings flags explicitly-selected ignored apps', () => {
  const warnings = getConfigOverrideWarnings(
    ['git'],
    {},
    { applications_to_ignore: { git: true } },
    'backup',
  );
  if (warnings.length !== 1 || !warnings[0].includes('git')) {
    throw new Error(`unexpected warnings: ${JSON.stringify(warnings)}`);
  }

  const none = getConfigOverrideWarnings(['git'], { git: 'path' }, {}, 'backup');
  if (none.length !== 0) throw new Error('expected no warnings for configured app');
});

test('pure: resolveBackupPaths derives home and storage paths', () => {
  const backup = resolveBackupPaths('.gitconfig', '/storage');
  if (backup.sourceFilePath !== path.join(process.env.HOME ?? '', '.gitconfig') && !backup.sourceFilePath.endsWith('/.gitconfig')) {
    throw new Error(`unexpected source: ${backup.sourceFilePath}`);
  }
  if (backup.backupFilePath !== '/storage/.gitconfig') {
    throw new Error(`unexpected backup: ${backup.backupFilePath}`);
  }

  const restore = resolveBackupPaths('.gitconfig', '/storage', { restore: true });
  if (restore.sourceFilePath !== '/storage/.gitconfig') {
    throw new Error(`unexpected restore source: ${restore.sourceFilePath}`);
  }
  if (restore.backupFilePath !== backup.sourceFilePath) {
    throw new Error(`unexpected restore target: ${restore.backupFilePath}`);
  }
});

test('cli: backup copies a file as a real file into storage', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.gitconfig': 'v1',
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['.gitconfig']) },
  }));
  try {
    const { exitCode } = await runCli(fixture.path);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);

    const target = path.join(fixture.path, 'backup', '.gitconfig');
    if (!fs.existsSync(target)) throw new Error('backup file not created');
    if (fs.readFileSync(target, 'utf8') !== 'v1') throw new Error('wrong content');
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error('backup should not be a symlink');
  } finally {
    await fixture.rm();
  }
});

test('cli: backup dereferences symlinks', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    'real.txt': 'content',
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['linked']) },
  }));
  try {
    fs.symlinkSync('real.txt', path.join(fixture.path, 'linked'));

    const { exitCode } = await runCli(fixture.path);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);

    const target = path.join(fixture.path, 'backup', 'linked');
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error('symlink was not dereferenced');
    if (fs.readFileSync(target, 'utf8') !== 'content') throw new Error('wrong content');
  } finally {
    await fixture.rm();
  }
});

test('cli: quiet mode skips existing files instead of overwriting', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.gitconfig': 'v1',
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['.gitconfig']) },
  }));
  try {
    await runCli(fixture.path);
    fs.writeFileSync(path.join(fixture.path, '.gitconfig'), 'v2');

    const { exitCode } = await runCli(fixture.path);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);

    const target = path.join(fixture.path, 'backup', '.gitconfig');
    if (fs.readFileSync(target, 'utf8') !== 'v1') throw new Error('quiet mode should not overwrite');
  } finally {
    await fixture.rm();
  }
});

test('cli: --force overwrites existing files', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.gitconfig': 'v1',
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['.gitconfig']) },
  }));
  try {
    await runCli(fixture.path);
    fs.writeFileSync(path.join(fixture.path, '.gitconfig'), 'v2');

    const { exitCode } = await runCli(fixture.path, ['--force']);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);

    const target = path.join(fixture.path, 'backup', '.gitconfig');
    if (fs.readFileSync(target, 'utf8') !== 'v2') throw new Error('force should overwrite');
  } finally {
    await fixture.rm();
  }
});

test('cli: same source and target path fails without reporting success', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp'], '.'),
    '.gitconfig': 'v1',
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['.gitconfig']) },
  }));
  try {
    const { exitCode, stdout, stderr } = await runCli(fixture.path);
    const output = `${stdout}\n${stderr}`;
    if (!output.includes('are the same')) throw new Error(`expected same-path error, got: ${output}`);
    if (output.includes('Successful')) throw new Error('must not report success on error');
    if (exitCode === 0) throw new Error('expected non-zero exit code');
  } finally {
    await fixture.rm();
  }
});

test('cli: prune ignores --app and keeps other apps\' backups', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp_a', 'testapp_b']),
    'filea': 'a',
    'fileb': 'b',
    '.backup': {
      'testapp_a.cfg': appCfg('A', ['filea']),
      'testapp_b.cfg': appCfg('B', ['fileb']),
    },
  }));
  try {
    const backupRun = await runCli(fixture.path);
    if (backupRun.exitCode !== 0) throw new Error(`backup exit ${backupRun.exitCode}`);

    const { exitCode } = await runCli(fixture.path, ['-p', '--app=testapp_a']);
    if (exitCode !== 0) throw new Error(`prune exit ${exitCode}`);

    if (!fs.existsSync(path.join(fixture.path, 'backup', 'fileb'))) {
      throw new Error('prune must not delete backups outside the requested app');
    }
  } finally {
    await fixture.rm();
  }
});

test('cli: --restore and --prune are mutually exclusive', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
  }));
  try {
    const { exitCode, stdout, stderr } = await runCli(fixture.path, ['-r', '-p']);
    const output = `${stdout}\n${stderr}`;
    if (exitCode === 0) throw new Error('expected non-zero exit code');
    if (!output.includes('Cannot use --restore and --prune together')) {
      throw new Error(`expected flag error, got: ${output}`);
    }
  } finally {
    await fixture.rm();
  }
});

test('cli: --list discovers apps', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['.gitconfig']) },
  }));
  try {
    const { stdout } = await runCli(fixture.path, ['-l']);
    if (!stdout.includes('testapp')) throw new Error(`list did not show testapp: ${stdout}`);
  } finally {
    await fixture.rm();
  }
});

test('cli: directory backup dereferences symlinks', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    'real.txt': 'content',
    configdir: { 'inner.txt': 'inner' },
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['configdir']) },
  }));
  try {
    fs.symlinkSync('../real.txt', path.join(fixture.path, 'configdir', 'linked'));

    const { exitCode } = await runCli(fixture.path);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);

    const linked = path.join(fixture.path, 'backup', 'configdir', 'linked');
    if (fs.lstatSync(linked).isSymbolicLink()) throw new Error('symlink was not dereferenced');
    if (fs.readFileSync(linked, 'utf8') !== 'content') throw new Error('wrong content');
    if (!fs.existsSync(path.join(fixture.path, 'backup', 'configdir', 'inner.txt'))) {
      throw new Error('directory contents not copied');
    }
  } finally {
    await fixture.rm();
  }
});

test('cli: quiet mode skips non-empty directory conflicts', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    configdir: { 'inner.txt': 'v1' },
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['configdir']) },
  }));
  try {
    await runCli(fixture.path);
    fs.writeFileSync(path.join(fixture.path, 'configdir', 'inner.txt'), 'v2');

    const { exitCode } = await runCli(fixture.path);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);

    const target = path.join(fixture.path, 'backup', 'configdir', 'inner.txt');
    if (fs.readFileSync(target, 'utf8') !== 'v1') throw new Error('quiet mode should not overwrite directory');
  } finally {
    await fixture.rm();
  }
});

test('cli: restore copies files back home', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.gitconfig': 'v1',
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['.gitconfig']) },
  }));
  try {
    await runCli(fixture.path);
    fs.rmSync(path.join(fixture.path, '.gitconfig'));

    const { exitCode } = await runCli(fixture.path, ['-r']);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);

    const restored = path.join(fixture.path, '.gitconfig');
    if (!fs.existsSync(restored)) throw new Error('file not restored');
    if (fs.readFileSync(restored, 'utf8') !== 'v1') throw new Error('wrong content');
  } finally {
    await fixture.rm();
  }
});

test('cli: restore remaps BACKUP_UPSTREAM_HOME', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.backup': { 'testapp.cfg': appCfg('TestApp', [`${root}/.gitconfig`]) },
  }));
  try {
    const homeFile = path.join(fixture.path, '.gitconfig');
    const upstreamHome = `${fixture.path}/upstream`;
    const upstreamFile = path.join(fixture.path, 'backup', upstreamHome, '.gitconfig');
    fs.mkdirSync(path.dirname(upstreamFile), { recursive: true });
    fs.writeFileSync(upstreamFile, 'upstream-content');

    const { exitCode } = await runCli(fixture.path, ['-r'], { BACKUP_UPSTREAM_HOME: upstreamHome });
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);
    if (!fs.existsSync(homeFile)) throw new Error('file was not restored');
    if (fs.readFileSync(homeFile, 'utf8') !== 'upstream-content') throw new Error('wrong content restored');
  } finally {
    await fixture.rm();
  }
});

test('cli: --app only backs up the selected app', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['app_a', 'app_b']),
    filea: 'a',
    fileb: 'b',
    '.backup': {
      'app_a.cfg': appCfg('A', ['filea']),
      'app_b.cfg': appCfg('B', ['fileb']),
    },
  }));
  try {
    const { exitCode } = await runCli(fixture.path, ['--app=app_a']);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);
    if (!fs.existsSync(path.join(fixture.path, 'backup', 'filea'))) throw new Error('selected app not backed up');
    if (fs.existsSync(path.join(fixture.path, 'backup', 'fileb'))) throw new Error('unselected app should not be backed up');
  } finally {
    await fixture.rm();
  }
});

test('cli: applications_to_ignore excludes apps', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRcFull(root, { sync: ['testapp'], ignore: ['testapp'] }),
    '.gitconfig': 'v1',
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['.gitconfig']) },
  }));
  try {
    const { exitCode } = await runCli(fixture.path);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);
    if (fs.existsSync(path.join(fixture.path, 'backup', '.gitconfig'))) {
      throw new Error('ignored app should not be backed up');
    }
  } finally {
    await fixture.rm();
  }
});

test('cli: xdg_configuration_files are backed up', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.config': { git: { config: 'xdg-content' } },
    '.backup': { 'testapp.cfg': appCfgXdg('TestApp', ['git/config']) },
  }));
  try {
    const { exitCode } = await runCli(fixture.path);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);

    const xdgAbs = path.join(fixture.path, '.config', 'git', 'config');
    const target = path.join(fixture.path, 'backup', xdgAbs);
    if (!fs.existsSync(target)) throw new Error(`xdg file not backed up at ${target}`);
    if (fs.readFileSync(target, 'utf8') !== 'xdg-content') throw new Error('wrong content');
  } finally {
    await fixture.rm();
  }
});

test('cli: writes a JSONL log with a meta line and file records', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.gitconfig': 'v1',
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['.gitconfig']) },
  }));
  try {
    const { exitCode } = await runCli(fixture.path);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);

    const logsDir = path.join(fixture.path, 'logs');
    const files = fs.readdirSync(logsDir).filter(file => file.startsWith('Backup-') && file.endsWith('.jsonl'));
    if (files.length !== 1) throw new Error(`expected one Backup log, got ${JSON.stringify(fs.readdirSync(logsDir))}`);

    const lines = fs.readFileSync(path.join(logsDir, files[0]), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    if (lines[0].kind !== 'meta' || lines[0].operation !== 'Backup') throw new Error(`bad meta: ${JSON.stringify(lines[0])}`);
    if (!lines.some(line => line.status === 'success' && typeof line.target === 'string')) {
      throw new Error(`no success record: ${JSON.stringify(lines)}`);
    }
  } finally {
    await fixture.rm();
  }
});

test('cli: prune removes files no longer present locally', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.gitconfig': 'v1',
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['.gitconfig']) },
  }));
  try {
    await runCli(fixture.path);
    const backedUp = path.join(fixture.path, 'backup', '.gitconfig');
    if (!fs.existsSync(backedUp)) throw new Error('setup: file was not backed up');

    fs.rmSync(path.join(fixture.path, '.gitconfig'));
    const { exitCode } = await runCli(fixture.path, ['-p']);
    if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);
    if (fs.existsSync(backedUp)) throw new Error('orphaned backup was not pruned');
  } finally {
    await fixture.rm();
  }
});

test('cli: --config prints the resolved config', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['.gitconfig']) },
  }));
  try {
    const { stdout } = await runCli(fixture.path, ['-c']);
    if (!stdout.includes('Read Config') || !stdout.includes('Final Config')) {
      throw new Error(`config not printed: ${stdout}`);
    }
  } finally {
    await fixture.rm();
  }
});

test('cli: unknown --app reports an error', async () => {
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.backup': { 'testapp.cfg': appCfg('TestApp', ['.gitconfig']) },
  }));
  try {
    const { stdout } = await runCli(fixture.path, ['--app=does-not-exist']);
    if (!stdout.includes('Unknown app')) throw new Error(`expected unknown app error: ${stdout}`);
  } finally {
    await fixture.rm();
  }
});

test('cli: config entries cannot escape the backup directory', async () => {
  const escapeName = `backup-cli-escape-${process.pid}-${Date.now()}.txt`;
  const fixture = await createFixture(({ path: root }) => ({
    '.backuprc': backupRc(root, ['testapp']),
    '.backup': { 'testapp.cfg': appCfg('TestApp', [`../${escapeName}`]) },
  }));
  const escapeSource = path.join(path.dirname(fixture.path), escapeName);
  try {
    fs.writeFileSync(escapeSource, 'secret');

    const { exitCode, stdout, stderr } = await runCli(fixture.path);
    const output = `${stdout}\n${stderr}`;
    if (!output.includes('escapes the backup directory')) throw new Error(`expected escape guard, got: ${output}`);
    if (exitCode === 0) throw new Error('expected non-zero exit code');
    if (fs.existsSync(path.join(fixture.path, escapeName))) throw new Error('escaped file should not be written');
  } finally {
    fs.rmSync(escapeSource, { force: true });
    await fixture.rm();
  }
});

test('cli: prints version and help', async () => {
  const fixture = await createFixture();
  try {
    const version = await runCli(fixture.path, ['-v']);
    if (!version.stdout.includes(pkg.version)) throw new Error(`version missing: ${version.stdout}`);

    const help = await runCli(fixture.path, ['-h']);
    if (!help.stdout.includes('--list') || !help.stdout.includes('--prune')) {
      throw new Error(`help missing: ${help.stdout}`);
    }
  } finally {
    await fixture.rm();
  }
});
