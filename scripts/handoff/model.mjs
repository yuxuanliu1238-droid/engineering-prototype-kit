export const HANDOFF_STATUSES = ["draft", "formal", "superseded"];
export const TASK_TYPES = ["application-feature", "external-integration", "non-page"];
export const MATERIAL_TYPES = [
  "dingtalk-document",
  "git-file",
  "prototype",
  "screenshot",
  "interface-document",
  "document",
  "other",
];
export const MATERIAL_ROLES = [
  "requirement",
  "prototype",
  "review",
  "interface",
  "screenshot",
  "other",
];
export const BASELINE_STATES = ["verified", "manual-confirmed", "unverified", "changed", "missing"];
export const ENGINEERING_DOMAINS = [
  "frontend",
  "backend",
  "client",
  "data",
  "configuration",
  "qa",
  "devops",
  "other",
];
export const INTEGRATION_DIRECTIONS = [
  "counterparty-provides-we-call",
  "we-provide-counterparty-calls",
  "mutual",
];
export const SCOPE_DISPOSITIONS = ["development-required", "no-development"];
export const TOUCHPOINT_DISPOSITIONS = ["development-required", "no-change"];
export const CONFIRMATION_DECISIONS = ["pending", "confirmed", "acknowledged"];
export const CHANGE_TYPES = ["initial", "in-scope-omission", "business-scope-change"];

export const TASK_TYPE_LABELS = {
  "application-feature": "应用功能任务",
  "external-integration": "外部系统接口任务",
  "non-page": "非页面研发任务",
};

export const MATERIAL_TYPE_LABELS = {
  "dingtalk-document": "钉钉文档",
  "git-file": "Git 文件",
  prototype: "原型",
  screenshot: "截图",
  "interface-document": "接口文档",
  document: "文档",
  other: "其他",
};

export const MATERIAL_ROLE_LABELS = {
  requirement: "需求",
  prototype: "原型",
  review: "研发评审",
  interface: "接口",
  screenshot: "截图",
  other: "其他",
};

export const BASELINE_STATE_LABELS = {
  verified: "已自动核对",
  "manual-confirmed": "已人工确认",
  unverified: "版本未自动核对",
  changed: "评审后已变化",
  missing: "当前不可访问",
};

export const ENGINEERING_DOMAIN_LABELS = {
  frontend: "前端",
  backend: "后端",
  client: "客户端",
  data: "数据",
  configuration: "配置",
  qa: "测试",
  devops: "运维",
  other: "其他",
};

export const DIRECTION_LABELS = {
  "counterparty-provides-we-call": "对方提供、我方调用",
  "we-provide-counterparty-calls": "我方提供、对方调用",
  mutual: "双方分别提供并调用",
};

export const CONFIRMATION_LABELS = {
  pending: "待确认",
  confirmed: "已确认",
  acknowledged: "已知悉",
};

export const HANDOFF_STATUS_LABELS = {
  draft: "草稿",
  formal: "正式版",
  superseded: "已被替代",
};

export const SCOPE_DISPOSITION_LABELS = {
  "development-required": "需要研发改动",
  "no-development": "无需研发改动",
};

export const CHANGE_TYPE_LABELS = {
  initial: "首次正式版",
  "in-scope-omission": "原范围内研发任务遗漏",
  "business-scope-change": "业务范围或验收变化",
};

export const DISALLOWED_TASK_FIELDS = [
  "owner",
  "assignee",
  "status",
  "progress",
  "estimate",
  "dueDate",
  "completedAt",
];
export const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /[?&](?:token|key|secret|password)=[^&\s]+/i,
];

export function unique(values) {
  return [...new Set(values)];
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
