import type { Messages } from "./types";

export const v2Messages: Record<"zh-CN" | "en-US", Messages> = {
  "zh-CN": {
    "v2.light":"浅色", "v2.dark":"深色", "v2.mode.t2i":"文生图", "v2.mode.i2i":"图生图",
    "v2.gallery.title":"基础组件预览", "v2.gallery.description":"开发预览 · 键盘、表单与状态；不连接生成服务。",
    "v2.gallery.tag":"状态标签", "v2.gallery.fields":"表单", "v2.gallery.states":"状态",
    "v2.gallery.name":"名称", "v2.gallery.namePlaceholder":"输入名称", "v2.gallery.mode":"创作模式",
    "v2.gallery.request":"需求", "v2.gallery.requestPlaceholder":"描述你希望创作的画面",
    "v2.gallery.errorField":"校验示例", "v2.gallery.errorDescription":"示例：请填写该字段。", "v2.gallery.checkbox":"勾选示例",
    "v2.gallery.empty":"暂无内容", "v2.gallery.emptyDescription":"示例：创建内容后会显示在这里。",
    "v2.gallery.feedback":"交互反馈示例", "v2.gallery.primary":"主要操作", "v2.gallery.disabled":"不可用",
    "v2.gallery.menu":"菜单", "v2.gallery.dialog":"打开对话框", "v2.gallery.dialogDescription":"Tab 保持在对话框中；Escape 关闭并返回打开按钮。"
  },
  "en-US": {
    "v2.light":"Light", "v2.dark":"Dark", "v2.mode.t2i":"Text to image", "v2.mode.i2i":"Image to image",
    "v2.gallery.title":"Component preview", "v2.gallery.description":"Development preview · Keyboard, fields and states; no generation service calls.",
    "v2.gallery.tag":"Status label", "v2.gallery.fields":"Fields", "v2.gallery.states":"States",
    "v2.gallery.name":"Name", "v2.gallery.namePlaceholder":"Enter a name", "v2.gallery.mode":"Creation mode",
    "v2.gallery.request":"Request", "v2.gallery.requestPlaceholder":"Describe the image you want to create",
    "v2.gallery.errorField":"Validation example", "v2.gallery.errorDescription":"Example: complete this field.", "v2.gallery.checkbox":"Checkbox example",
    "v2.gallery.empty":"No content", "v2.gallery.emptyDescription":"Example: created content appears here.",
    "v2.gallery.feedback":"Interaction feedback example", "v2.gallery.primary":"Primary action", "v2.gallery.disabled":"Unavailable",
    "v2.gallery.menu":"Menu", "v2.gallery.dialog":"Open dialog", "v2.gallery.dialogDescription":"Tab stays within the dialog; Escape closes and returns to the trigger."
  }
};
