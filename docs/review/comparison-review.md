# Demo 与需求对照评审

业务模板提供 `/compare`：左侧复用独立 `/app` 交互，右侧按“当前说明、相关说明、完整文档”浏览文本。全局条款有固定入口。宽度可调，两侧独立滚动，窄屏上下排列。重置重新加载左侧，不代表业务系统持久化数据清理；业务自行接入持久化时必须另行定义恢复行为。

本能力来自真实业务项目的展示实验；仅回归布局、关联与阅读机制，不携带客户正文、专属规则或客户链接。展示形式认可、场景认可、规则批准、需求总评审分别记录。

## 接入文档

编辑业务拥有的 `prototype/src/comparison-content.json`。默认文档为空，不自动生成正式规则或宣称输入缺失。`source` 填采用的标题、URL、修订、读取日期。正文是阅读快照，线上文档仍为采用版本的正文来源；来源变更后显式刷新、复核映射，不静默覆盖。

`sections` 包含所有文本章节，每节用稳定 `id`、`title`、`body`；可选 `sourceUrl` 精确到原文锚点。无Demo区域的章节也保留在目录，不得因为没有映射而删除。图片、白板保留原文查看提示，不声称已转为正文。

```json
{
  "sections": [
    {"id":"requests", "title":"请求查询", "body":"已采用文档中的说明"},
    {"id":"calculation", "title":"推算规则", "body":"已采用文档中的规则正文"},
    {"id":"permissions", "title":"权限边界", "body":"已采用文档中的权限说明"}
  ],
  "pageMappings": [
    {"page":"records", "sectionId":"requests", "relatedSectionIds":["requests","calculation"]}
  ],
  "actionMappings": [{"action":"recalculate", "sectionId":"calculation"}],
  "globalSectionIds": ["permissions"]
}
```

这是配置片段，保留默认文件的 `schemaVersion`、`title`、同源 `demoEntry`、`minimumDemoWidth` 和 `source`。关联支持 `detail: present/absent`、`mode` 进一步定位，详细匹配优先。章节ID缺失应修复，不能把错误引用当成验收通过。可调用 `validateReviewContent` 检查项目配置。

## 页面与动作

模板 App 已用 `publishReviewLocation(location)` 通知外层；换路由实现时保留桥接。桥接只在同源父子窗口间通信，外层核对来源窗口；使用通用 `prototype-review-location` 和 `prototype-review-action` 事件。

动作面板可接入：

```js
useEffect(() => {
  publishReviewAction("recalculate", open);
  return () => publishReviewAction("recalculate", false);
}, [open]);
```

从 `./comparison-bridge.js` 导入 `publishReviewAction`。打开动作自动显示配置章节，关闭后回到页面说明；手动全文浏览不因普通页面切换被打断。此机制仅展示说明，不触发业务操作。

正文支持段落、标题、列表、简单Markdown表格、粗体和行内代码，以文本渲染，不执行HTML。复杂嵌套表格、图片与白板内嵌、实时同步、单HTML离线交付、意见留存和自动业务修正规则不在本次能力内。应保留来源提示，禁止宣称转换后的媒体已完整展示。

## 存量项目与验证

新项目通过清单分发入口与空配置。存量项目的原型文件属于业务所有，升级不会强制覆盖；显式迁入以上5个文件，在main加入 `/compare` 懒加载入口并在路由与动作中接入桥接，保留原有业务代码。不要直接覆盖整个App。

验证生成项目构建、页面/动作关联、无关联文本仍可浏览、手选阅读不被普通路由打断、来源安全及恢复演示。运行 `node scripts/test-comparison-review.mjs` 验证Kit通用模型与新项目分发。体验仍由产品经理确认，不以自动检查替代。

本轮授权：当前聊天“更新到kit？”。目标、范围、验收为本文件所述通用能力；依赖为已有React/Vite模板及清单机制；规则为原型演示、采用文档快照与分开记录确认；授权来自当前用户；风险为业务所有文件不可自动覆盖及正文需显式采用。七项已核对，不更改Kit模式、不创建正式CR、不发布新版本。
