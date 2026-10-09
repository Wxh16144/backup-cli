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
