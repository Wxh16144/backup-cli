# @wuxh/backup-cli

> 备份你的配置文件和目录 [为什么重复创造轮子？](https://github.com/lra/mackup/issues/1849#issuecomment-1369963734)，[lra/mackup#1969](https://github.com/lra/mackup/discussions/1969)。

[![npm](https://img.shields.io/npm/v/@wuxh/backup-cli.svg?style=for-the-badge)](https://www.npmjs.com/package/@wuxh/backup-cli)
[![npm](https://img.shields.io/npm/dt/@wuxh/backup-cli.svg?style=for-the-badge)](https://www.npmjs.com/package/@wuxh/backup-cli)

简体中文 | [English](./README.en_US.md) | [Bilibili#BV1dL411D7kh](https://bilibili.com/video/BV1dL411D7kh)

## 安装

```bash
npm i @wuxh/backup-cli -g
```

## 使用

### 备份

```bash
backup-cli
```

### 还原

```bash
backup-cli -r
```

### 支持的应用程序

```bash
backup-cli -l
```

### 查看配置

```bash
backup-cli -c
```

### CLI 命令

使用 `backup-cli -h` 查看最新的使用说明：

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

> 默认使用 `$HOME/.backuprc` 作为配置文件，也可以通过设置 `BACKUP_CONFIG_FILE` 环境变量自定义其他位置。

```ini
[storage]
; 备份路径， 默认: 执行命令当前目录
path = $PWD
; 备份目录, 默认: backup
directory = backup

; 同步的应用程序, 默认同步全部
[applications_to_sync]
zsh

; 忽略某一个应用程序, 默认为空
[applications_to_ignore]
git

```

## 自定义应用程序

> 定义 `[application name].cfg` 配置文件，并放在 `$HOME/.backup` 根目录中，你可以通过设置 `BACKUP_CUSTOM_APP_DIR` 环境变量自定义其他目录。

```ini
[application]
name = Git

; 要同步的目录或文件， 从 $HOME 开始拼接
[configuration_files]
.gitconfig_work

; XDG 配置文件, 从 $XDG_CONFIG_HOME 开始拼接;
; see: https://specifications.freedesktop.org/basedir-spec/latest
[xdg_configuration_files]
git/config
```

## 高级用法

### 强制还原

`backup-cli -r` 还原备份时使用 `--force` 无法强制覆盖文件（还是会进行二次确认）。因为数据是宝贵的，所以默认不会覆盖。

- **tips**: 你可以通过设置 `BACKUP_FORCE_RESTORE = true` 环境变量来强制还原。（还是需要加上 `--force` 参数）

### 还原他人的备份

还原备份目录中的文件到 `$HOME` 目录，但是他人的 `$HOME` 目录可能和你的不一样，所以不能直接还原。

- **tips**: 你可以通过设置 `BACKUP_UPSTREAM_HOME={别人的HOME目录}` 环境变量来还原他人的备份。

### 日志记录

每次备份或还原操作都会在 `storage.logs` 目录下生成日志文件：

- 文件格式：`[Backup|Restore]-{timestamp}.jsonl`
- 记录内容：操作类型、源文件、目标路径、状态等详细信息

<details>
    <summary>查看日志示例</summary>

```jsonl
{"target":"../backup/.gitconfig","source":"/Users/root/.gitconfig","type":"file","status":"success"}
{"target":"../backup/.gnupg/gpg.conf","source":"/Users/root/.gnupg/gpg.conf","type":"file","status":"success"}
{"target":"../backup/.cargo/config","source":"/Users/root/.cargo/config","type":"file","status":"success"}
```

</details>

## 谁在使用

- [Wxh16144's Dotfiles](https://github.com/Wxh16144/dotfiles)
- 欢迎 PR: [New pull request](https://github.com/Wxh16144/backup-cli/pulls)

## 贡献&调试

1. 克隆项目后使用 `pnpm` 安装依赖

```bash
git clone git@github.com:Wxh16144/backup-cli.git && cd backup-cli \
    && pnpm install
```

之后可以在 VSCode 中按下 `F5` 进行 debugger, [launch.json](./.vscode/launch.json)

## LICENSE

[MIT](./LICENSE)

## 实现参考

- [mackup](https://github.com/lra/mackup)
