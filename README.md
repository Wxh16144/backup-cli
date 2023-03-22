# @wuxh/backup-cli

> Backup and share your configuration files

[![npm](https://img.shields.io/npm/v/@wuxh/backup-cli.svg?style=for-the-badge)](https://www.npmjs.com/package/@wuxh/backup-cli)
[![npm](https://img.shields.io/npm/dt/@wuxh/backup-cli.svg?style=for-the-badge)](https://www.npmjs.com/package/@wuxh/backup-cli)

## 安装

```bash
npm i @wuxh/backup-cli -g
```

## 使用

```bash
backup-cli #默认为备份操作
```

### 还原

```bash
backup-cli -r
```

### 查看配置

```bash
backup-cli -c
```

### options

使用 `backup-cli -h` 查看最新的使用说明：

```bash
    npx backup-cli [options]
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

> 默认使用 `$HOME/.backuprc` 作为配置文件，也可以通过设置 `BACKUP_CONFIG_FILE` 环境变量自定义其他位置。

```ini
[storage]
; 备份地址，默认为执行命令的当前目录 + backup
directory = backup

; 同步的应用程序, 默认同步全部
[applications_to_sync]
zsh

; 忽略某一个应用程序, 默认不忽略
[applications_to_ignore]
git

```

## 自定义应用程序

```ini
[application]
name = Git

; 要同步的目录或文件， 从 $HOME 开始拼接
[configuration_files]
.gitconfig_work
```

## 贡献&调试

TODO

## LICENSE

[MIT](./LICENSE)

## 参考

- [mackup](https://github.com/lra/mackup)
