export function parseOptions(args, { values = [], flags = [] } = {}) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, "");
    if (args[i] === "--") continue;
    if (flags.includes(key)) options[key] = true;
    else if (values.includes(key)) {
      if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`--${key} 缺少值`);
      options[key] = args[++i];
    } else throw new Error(`未知参数：${args[i]}`);
  }
  return options;
}
export function issue(code, field, reason, nextAction = "修正输入后重新检查") {
  return { code, field, reason, nextAction };
}
