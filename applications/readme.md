# 内置的应用程序 (builtInApps)

在保持 `.backup` 优先级不变的情况下，Backup CLI `1.7.x` 开始, 优先使用了 `mackup/mackup/applications`。

所以可以理解成， mackup 不支持的应用程序才会走到当前 applications 中。

优先级：customApp > mackup > backup(当前CLI)

---

_2025/11/21 更新：_ mackup 修改了应用程序的配置路径位置，从 `mackup/mackup/applications` 迁移到了 [mackup/src/mackup/applications](https://github.com/lra/mackup/tree/master/src/mackup/applications)，所以 Backup CLI 在 `2.1.0` 版本中也做了相应的调整 [See Detail](https://github.com/Wxh16144/backup-cli/commit/9d11070e) 。
