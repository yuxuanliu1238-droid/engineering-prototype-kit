# 证据新鲜度与 Markdown 评审包

## 目的

检查报告必须记录执行时间、命令、覆盖文件和源码指纹。覆盖文件变化或缺失后，旧报告分别显示 `stale` 或 `missing`，不能继续冒充当前结论。

Markdown 评审包只汇总结构化台账中的状态、范围、就绪检查、唯一卡点和类型化证据。它可以重复生成，但不能反向成为需求、决策或页面契约的事实源。

## 通用命令

生成检查报告：

```bash
node scripts/source-fingerprint.mjs --id example-check --command "pnpm check" --result passed --executed-at 2099-01-01T00:00:00.000Z --file prototype/src/App.jsx --output dist/check-reports/example-check.json
```

生成某条需求的 Markdown 评审包：

```bash
node scripts/review-package.mjs --cr CR-001 --output dist/review-packages/CR-001.md
```

两条命令都只读取项目内相对路径。评审包默认不生成 Word、PDF、截图或 ZIP；正式交付仍需单独授权并运行 `pnpm build:delivery`。

## 隔离样本

`examples/review-workflow-isolated.json` 只包含匿名入口、动作和状态，不对应任何宿主项目业务。`pnpm review-evidence:test` 会验证 `fresh、stale、missing` 和连续生成一致性。
