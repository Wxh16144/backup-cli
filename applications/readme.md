# 内置的应用程序 (builtInApps)

在保持 `.backup` 优先级不变的情况下，1.7.x 开始, 优先使用了 [mackup/mackup/applications](https://github.com/lra/mackup/tree/master/mackup/applications)。

所以可以理解成， mackup 不支持的应用程序才会走到当前 applications 中

优先级：customApp > mackup > backup(当前CLI)
