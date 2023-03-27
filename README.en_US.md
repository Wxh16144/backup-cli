# @wuxh/backup-cli

> Backup your configuration files and directories

[![npm](https://img.shields.io/npm/v/@wuxh/backup-cli.svg?style=for-the-badge)](https://www.npmjs.com/package/@wuxh/backup-cli)
[![npm](https://img.shields.io/npm/dt/@wuxh/backup-cli.svg?style=for-the-badge)](https://www.npmjs.com/package/@wuxh/backup-cli)

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

### View Configuration

```bash
backup-cli -c
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

> Define the `[application name].cfg` configuration file and place it in the `$HOME/.backup` directory. You can customize other directories by setting the `CUSTOM_APP_CONFIG_DIR` environment variable.

```ini
[application]
name = Git

; Directories or files to be synchronized, concatenated from $HOME
[configuration_files]
.gitconfig_work
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

[MIT](./LICENSE)

## Reference

- [mackup](https://github.com/lra/mackup)
