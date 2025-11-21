# @wuxh/backup-cli

> Backup your configuration files and directories [Why?](https://github.com/lra/mackup/issues/1849#issuecomment-1369963734), [lra/mackup#1969](https://github.com/lra/mackup/discussions/1969).

[![npm](https://img.shields.io/npm/v/@wuxh/backup-cli.svg?style=for-the-badge)](https://www.npmjs.com/package/@wuxh/backup-cli)
[![npm](https://img.shields.io/npm/dt/@wuxh/backup-cli.svg?style=for-the-badge)](https://www.npmjs.com/package/@wuxh/backup-cli)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=for-the-badge)](./LICENSE)

[简体中文](./README.md) | English

## Installation

```bash
npm i @wuxh/backup-cli -g
```

## Usage

### Backup

```bash
backup-cli
```

### Restore

```bash
backup-cli -r
```

### Support Apps

```bash
backup-cli -l
```

### View Configuration

```bash
backup-cli -c
```

### Prune Backup

> Clean up files in the existing backup directory that do not exist locally or in the configuration

```bash
backup-cli -p
```

### CLI Options

Use `backup-cli -h` to see the latest usage instructions:

```bash
    npx @wuxh/backup-cli [options]
    ----------------------------------------
    -l, --list: list all apps.
    -f, --force: force to backup (overwrite files).
    -c, --config: view config.
    -r, --restore: restore backup.
    -p, --prune: delete files from backup that do not exist locally or are no longer in config.
    -h, --help: show help.
    -d, --debug: show debug info.
    -v, --version: show version. vx.x.x
    ----------------------------------------
    e.g. backup-cli -h
```

## Config

> By default, `$HOME/.backuprc` is used as the configuration file, and you can also customize other locations by setting the `BACKUP_CONFIG_FILE` environment variable.

```ini
[storage]
; Backup path, default: current directory where the command is executed.
path = $PWD
; Backup directory, default: backup
directory = backup

; Synchronized applications, default: synchronize all
[applications_to_sync]
zsh

; Ignore a certain application, default: empty
[applications_to_ignore]
git

```

## Custom Application

> Define the `[application name].cfg` configuration file and place it in the `$HOME/.backup` directory. You can customize other directories by setting the `BACKUP_CUSTOM_APP_DIR` environment variable.

```ini
[application]
name = Git

; Directories or files to be synchronized, concatenated from $HOME
[configuration_files]
.gitconfig_work

; XDG configuration file, concatenated from $XDG_CONFIG_HOME
; see: https://specifications.freedesktop.org/basedir-spec/latest
[xdg_configuration_files]
git/config
```

## Advanced

### Forced Restore

When using `backup-cli -r` to restore backups, the `--force` option does not bypass confirmation prompts even when set to force overwriting files. This is due to security and data integrity considerations; by default, backups are not overwritten without user consent.

- **Tip**: You can enforce a restore operation by setting the environment variable `BACKUP_FORCE_RESTORE=true`. However, it's important to note that this still requires using the `--force` argument in your command.

### Restoring Another's Backup

When attempting to restore files from backup directories into your `$HOME` directory, the issue might arise because their `$HOME` directories may differ from yours. Direct restoration would fail due to these differences.

- **Tip**: To successfully restore another person's backups, you can set the environment variable `BACKUP_UPSTREAM_HOME={theirs HOME directory}` in your command. This specifies where each file should be placed upon restoration, ensuring they are correctly located on your system.

## Log

Each backup or restore operation generates a log file in the `storage.logs` directory:

- File name format: `[Backup|Restore]-YYYY-MM-DD_HHMMSS.jsonl`, e.g. `Backup-2025-09-05_153012.jsonl`
- Content: operation type, source file, target path, status, etc.

<details>
    <summary>View log example</summary>

```jsonl
{"target":"../backup/.gitconfig","source":"/Users/root/.gitconfig","type":"file","status":"success"}
{"target":"../backup/.gnupg/gpg.conf","source":"/Users/root/.gnupg/gpg.conf","type":"file","status":"success"}
{"target":"../backup/.cargo/config","source":"/Users/root/.cargo/config","type":"file","status":"success"}
```

## Who is Using

- [Wxh16144's Dotfiles](https://github.com/Wxh16144/dotfiles)
- Welcome PR: [New pull request](https://github.com/Wxh16144/backup-cli/pulls)

## Contribution

1. Clone the project and install dependencies using `pnpm`

```bash
git clone git@github.com:Wxh16144/backup-cli.git && cd backup-cli \
    && pnpm install
```

You can then press F5 in VSCode to start the debugger, [launch.json](./.vscode/launch.json)

## LICENSE

[GPL-3.0-or-later](./LICENSE)

Since this project uses application configurations from [mackup](https://github.com/lra/mackup) (via git submodule), which is licensed under GPLv3, this project is also distributed under the GPLv3 license.

## Reference

- [mackup](https://github.com/lra/mackup)
