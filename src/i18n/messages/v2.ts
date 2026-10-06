import type { Messages } from "./types";

export const v2Messages: Record<"zh-CN" | "en-US", Messages> = {
  "zh-CN": {
    "v2.login.guide":"使用指南", "v2.login.workspace":"AI IMAGE WORKSPACE", "v2.login.headline":"从描述，到图像。",
    "v2.login.description":"优化提示词，生成图片，持续编辑。在你的工作空间中，完成整个创作流程。",
    "v2.login.title":"登录工作台", "v2.login.welcome":"欢迎来到 {name}。", "v2.login.registerEntry":"没有账号？注册", "v2.login.contactAdmin":"没有账号？联系管理员",
    "v2.login.footer":"{name} · AI 图像创作工作台", "v2.login.compactFlow":"提示词优化 → 图片生成 → 参考图编辑",
    "v2.login.flow.optimize":"提示词优化", "v2.login.flow.optimizeDescription":"将想法表达清楚", "v2.login.flow.generate":"图片生成", "v2.login.flow.generateDescription":"选择模型并生成", "v2.login.flow.edit":"参考图编辑", "v2.login.flow.editDescription":"保留主体，继续修改",
    "v2.login.guide.optimize":"写下需求，选择风格包；可优化、比较和修改提示词，也可直接生成。",
    "v2.login.guide.generate":"使用管理员配置的模型，检查提示词和参数后提交；在会话里查看实际任务状态。",
    "v2.login.guide.edit":"上传参考图或选择已有图片，描述要保留与修改的内容；能力取决于实际配置的模型。",
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
    "v2.login.guide":"User guide", "v2.login.workspace":"AI IMAGE WORKSPACE", "v2.login.headline":"From words to images.",
    "v2.login.description":"Refine prompts, generate images and keep editing. Complete your creative workflow in one workspace.",
    "v2.login.title":"Sign in to your workspace", "v2.login.welcome":"Welcome to {name}.", "v2.login.registerEntry":"Need an account? Register", "v2.login.contactAdmin":"Need an account? Contact your administrator",
    "v2.login.footer":"{name} · AI image workspace", "v2.login.compactFlow":"Refine prompts → Generate images → Edit references",
    "v2.login.flow.optimize":"Refine prompts", "v2.login.flow.optimizeDescription":"Make your idea clear", "v2.login.flow.generate":"Generate images", "v2.login.flow.generateDescription":"Choose a model and create", "v2.login.flow.edit":"Edit references", "v2.login.flow.editDescription":"Keep the subject, refine the image",
    "v2.login.guide.optimize":"Describe your request and choose a style pack. Refine, compare and edit prompts, or generate directly.",
    "v2.login.guide.generate":"Use a model configured by your administrator. Review the prompt and parameters, then track the actual job in your conversation.",
    "v2.login.guide.edit":"Upload a reference or choose an existing image. Describe what to keep and change; available features depend on the configured model.",
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
