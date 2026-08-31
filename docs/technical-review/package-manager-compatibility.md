# 套件版本与包管理兼容策略

## 版本权威

- `package.json.version` 是套件当前版本的唯一权威。
- `project.config.json.kitVersion` 是供项目校验和界面读取的副本，必须与包版本一致。
- `engineering-prototype-kit-v0.1` 是工作区沿用的历史目录名，不表示当前套件仍是 V0.1，也不参与版本比较。
- 正式发布包按当前包版本命名，例如 `engineering-prototype-kit-v0.2.0.zip`。

保留历史目录名是为了避免无授权的大范围路径迁移；后续若要重命名，应作为独立变更处理并验证所有本地引用。

## pnpm 边界

- 套件根目录使用 `package.json` 声明的 `pnpm@10.12.4`。
- 套件内的前端子项目由套件根命令调度，不单独维护另一份根锁文件。
- 宿主业务原型可以声明不同的 pnpm 精确版本；它与套件是两个独立工作区，分别维护各自的 `package.json` 和 `pnpm-lock.yaml`。
- 命令必须在所属工作区目录执行，不跨工作区运行递归安装，也不复制、合并或覆盖另一工作区的锁文件。
- 两个锁文件当前都采用 lockfile v9，只代表文件格式可被相应 pnpm 读取，不代表依赖图或工作区可以合并。

## 运行基线

- Node.js：`>=20`，以套件 `package.json.engines.node` 为准。
- 包管理器：必须是带精确版本的 `pnpm@x.y.z` 声明。
- 日常评审：运行 `pnpm check`，需要评审站时运行 `pnpm build:review`。
- 正式 ZIP：只有用户明确要求交付时才运行 `pnpm build:delivery`。

## 冲突处理

如果当前终端使用的 pnpm 与所属工作区声明不同，应先切换到声明版本，再重新安装或验证；不要通过删除或改写另一工作区锁文件来消除提示。
