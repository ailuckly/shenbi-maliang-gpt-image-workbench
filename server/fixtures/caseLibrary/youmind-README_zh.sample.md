# Fixture (trimmed from YouMind README_zh.md, CC BY 4.0)

## 🔥 精选提示词

### No. 1: 带肖像和中英文定制的宽引言卡

![Language-ZH](https://img.shields.io/badge/Language-ZH-blue)
![Featured](https://img.shields.io/badge/⭐-Featured-gold)
![Raycast](https://img.shields.io/badge/🚀-Raycast_Friendly-purple)

#### 📖 描述

一个用于生成宽幅引言卡的提示，卡片上有一位名人的肖像，背景为棕色，引言文字为浅金色衬线字体。布局为文字占据三分之二，人物占据三分之一。引言文字和作者可参数化以便重复使用。

#### 📝 提示词

```
一张宽幅引言卡片，上面印有一位名人，背景为棕色，引言文字为浅金色衬线字体：“{argument name="famous_quote" default="Stay Hungry, Stay Foolish"}”，下方是较小的文字：“—{argument name="author" default="Steve Jobs"}”。文字前面有一个大而柔和的引号。人物肖像在左侧，文字在右侧。文字占据图片的三分之二，肖像占据三分之一，肖像部分带有轻微的渐变过渡效果。
```

#### 🖼️ 生成图片

##### Image 1

<div align="center">
<img src="https://cms-assets.youmind.com/media/1763886933714_5zqn1e_G6QBjQHbgAE3Yt_.jpg" width="700" alt="带肖像和中英文定制的宽引言卡 - Image 1">
</div>

##### Image 2

<div align="center">
<img src="https://cms-assets.youmind.com/media/1763886938314_wbcfc7_G6QBiiracAInQ8z.jpg" width="700" alt="带肖像和中英文定制的宽引言卡 - Image 2">
</div>

##### Image 3

<div align="center">
<img src="https://cms-assets.youmind.com/media/1763886941069_1d9ace_G6QBii_acAIRxKd.jpg" width="700" alt="带肖像和中英文定制的宽引言卡 - Image 3">
</div>

##### Image 4

<div align="center">
<img src="https://cms-assets.youmind.com/media/1763886946388_nwahev_G6QBikOaEAAmYkO.jpg" width="700" alt="带肖像和中英文定制的宽引言卡 - Image 4">
</div>

#### 📌 详情

- **作者:** [Nicolechan](https://x.com/stark_nico99)
- **来源:** [Twitter Post](https://x.com/stark_nico99/status/1991718646570426763)
- **发布时间:** 2025年11月21日
- **多语言:** zh

**[👉 立即尝试 →](https://youmind.com/zh-CN/nano-banana-pro-prompts?id=151)**

---

### No. 2: 高级液态玻璃 Bento 网格产品信息图，含 8 个模块

![Language-EN](https://img.shields.io/badge/Language-EN-blue)
![Featured](https://img.shields.io/badge/⭐-Featured-gold)

#### 📖 描述

使用 bento grid 8 模块布局创建信息图，用户可以指定食品、药品、科技等类别中的任何产品名称，选择语言、背景样式和主网格样式。

#### 📝 提示词

```
输入变量：[插入产品名称]
语言：[插入语言]

系统指令：
创建一个包含 8 个模块（卡片 2 到 8 只显示文本标题）的优质液态玻璃 Bento 网格产品信息图。
1) 产品分析：
→ 识别产品的主导自然色 → “主色调”
→ 识别类别：食品 / 药品 / 科技
2) 调色板（源自主色调）：
→ 产品 + 强调色：完全饱和的主色调
→ 图标、边框：柔和的主色调（30-40% 饱和度，绝不使用黑色）
3) 视觉风格：
→ 主打产品：真实摄影（真实、优质）、3D 玻璃版本 [二选一]
→ 卡片：Apple 液态玻璃（85-90% 透明），带有极细边框和微妙的阴影，营造浮动深度并反射背景颜色
→ 背景保持在卡片后面，卡片所在区域高度模糊 [二选一]：
  - 飘渺：产品精髓、柔和的焦散、抽象的光晕
  - 微距：产品纹理特写、高度模糊
  - 图案：产品柔和重复，不透明度为 10-15%
  - 情境：相关环境，模糊 + 去饱和
→ 添加微妙的动态效果
→ 不对称 Bento 网格，16:9 横向
→ 主卡片：28-30% | 信息模块：70-72%
4) 模块内容（8 张卡片）：
M1 — 主打：以真实照片 / 3D 玻璃 / 风格化诠释（三选一）的精美形式展示产品 + 产品名称标签
M2 — 核心优势：4 个独特优势 + 主色调图标
M3 — 使用方法：4 种使用方法 + 图标
M4 — 关键指标：5 个精确数据点
格式：[图标] [标签] [粗体值] [单位]
食品：卡路里：[X] 千卡/100 克，碳水化合物：[X] 克（膳食纤维 [X] 克，糖 [X] 克），蛋白质：[X] 克，[关键维生素]：[X] 毫克（每日摄入量 [X]%），[关键矿物质]：[X] 毫克（每日摄入量 [X]%）
药品：活性成分：[名称]，强度：[X] 毫克，起效时间：[X] 分钟，持续时间：[X] 小时，半衰期：[X] 小时
科技：芯片：[型号]，电池续航：[X] 小时，重量：[X] 克，[关键规格]：[值]，连接性：[协议]
M5 — 适用人群：4 组推荐人群，带有绿色对勾图标 | 3 组注意事项人群，带有琥珀色警告图标
M6 — 重要提示：4 项注意事项 + 警告图标
M7 — 快速参考：
→ 食品：血糖指数 + 带有图标的膳食标签
→ 药品：副作用 + 严重程度，带有图标
→ 科技：兼容性 + 认证，带有图标
M8 — 你知道吗：3 个事实（起源、科学、全球统计数据）+ 图标
输出：1 张图片，16:9 横向，超优质液态玻璃信息图。
```

#### 🖼️ 生成图片

##### Image 1

<div align="center">
<img src="https://cms-assets.youmind.com/media/1768962051381_l9uih4_537980579-6f29d32a-c786-40c4-bd5a-79c640737496.png" width="700" alt="高级液态玻璃 Bento 网格产品信息图，含 8 个模块 - Image 1">
</div>

##### Image 2

<div align="center">
<img src="https://cms-assets.youmind.com/media/1768962076321_nu4c5q_537981099-d18d0e38-f7ac-4781-a5da-6d68e2380885.png" width="700" alt="高级液态玻璃 Bento 网格产品信息图，含 8 个模块 - Image 2">
</div>

#### 📌 详情

- **作者:** [Mansi Sanghani](https://x.com/MansiSanghani1)
- **来源:** [Twitter Post](https://x.com/MansiSanghani1/status/2013550795224961492)
- **发布时间:** 2026年1月20日
- **多语言:** en

**[👉 立即尝试 →](https://youmind.com/zh-CN/nano-banana-pro-prompts?id=6847)**

---


## 📋 所有提示词

### No. 1: 个人资料 / 头像 - 严格保留身份特征的黄金时刻人像

![Language-EN](https://img.shields.io/badge/Language-EN-blue)

#### 📖 描述

创建一位身穿运动装、以日落为背景的女性逼真肖像，并严格执行对参考面部特征的还原。

#### 📝 提示词

```
一张逼真的年轻女性肖像，她约 22 岁，随意地坐在深色花岗岩台面上，直视镜头，带着轻松而含蓄的微笑。她身穿一套色彩拼接的运动装：一件短袖 T 恤，正面为纯白色，袖子和肩部为亮橙色，搭配同色系橙色短裤，短裤配有白色抽绳和侧边白色条纹。她的右腿抬起，右臂舒适地搭在膝盖上。她拥有自然优雅的女性气质，皮肤健康且富有光泽。

场景位于户外阳台或露台，配有黑色金属栏杆。背景中，迷人的黄金时刻日落照亮了宽阔的河流或湖泊，天空呈现出充满活力的暖橙色和黄色色调，并在水面上形成美丽的倒影，左侧可见郁郁葱葱的绿树。

使用 85mm 镜头拍摄，光圈 f/1.8，电影感黄金时刻布光，浅景深，优美的自然背景虚化，超写实皮肤纹理，柔和的皮肤光泽，真实的面部细节，自然色彩，专业摄影，高分辨率。

严格使用上传的参考图像来生成她的面部和身份特征。保持原始面部 100% 不变并与参考完全一致——相同的面部特征、面部结构、比例、肤色、眼形和颜色、鼻子、嘴唇、眉毛、下颌线、发型、发质、年龄和自然表情。不要美化、改变、重塑或理想化面部。保留参考图像中完全相同的身份和发型。最终图像必须看起来像是参考照片中的同一个女孩，只是置于这个新场景和服装中。

皮肤应具有自然健康的光泽，同时保持真实的皮肤纹理和毛孔。无面部扭曲，无身份改变，无人工美颜滤镜，无过度化妆，无面部修改。
```

#### 🖼️ 生成图片

##### Image 1

<div align="center">
<img src="https://cms-assets.youmind.com/media/1791182789986_5x7oxl_HTwdO5NaMAApOEZ.jpg" width="600" alt="个人资料 / 头像 - 严格保留身份特征的黄金时刻人像 - Image 1">
</div>

#### 📌 详情

- **作者:** [Kiran Ai](https://x.com/Kiran_AI1)
- **来源:** [Twitter Post](https://x.com/Kiran_AI1/status/2106590895575630035)
- **发布时间:** 2026年10月4日
- **多语言:** en

**[👉 立即尝试 →](https://youmind.com/zh-CN/nano-banana-pro-prompts?id=35920)**

---

### No. 95: 电商主图 - Nano Banana Pro 影棚人像提示词

![Language-EN](https://img.shields.io/badge/Language-EN-blue)
![Raycast](https://img.shields.io/badge/🚀-Raycast_Friendly-purple)

#### 📖 描述

一份详细的提示词，用于使用 Nano Banana Pro (GPT Image 2) 生成身着红色时尚服饰的女性逼真影棚肖像，重点在于光影、姿态和质感。

#### 📝 提示词

```
使用上传的参考图像中的面部特征。一位年轻女性的全身肖像（{argument name="age_range" default="23–27 岁"}，欧洲人外貌，轻微晒黑的皮肤带有柔和的古铜色底色，富有表现力的眼睛，自然的面部表情），坐在极简主义摄影工作室中，背景为无缝浅灰色弧形幕布。来自左上方大型柔光箱（45°）的柔和均匀光线，配合右下方的补光灯，在下巴和腿部下方形成柔和阴影。中全景构图（从膝盖到头顶），略低的视平线视角（约 100 cm），85 mm 镜头 f/2.0 光圈，浅景深——面部和身体清晰对焦，背景柔和虚化。相机角度向左前方 30°，椅子侧向面对相机。姿势：坐在带有红色座面和靠背的金属折叠椅上，躯干略微前倾，左臀位于椅边，右腿向前伸展，左膝弯曲，右手抬起触摸太阳穴附近的头发，左手自然放在大腿上，头转向相机，神情平静自信，带着淡淡的自然微笑。服装：光泽感红色短款皮革飞行员夹克，带有白色运动风贴花（包括“3”），未拉拉链，宽松穿着；白色棉质连体衣，腰部有醒目的红色 DIESEL 标志带；白色中筒袜，带有红色条纹；红色高跟凉鞋，配有细脚踝带（约 12 cm）。时尚杂志风格，自信且现代。超逼真影棚照片，8K RAW 画质，眼睛和皮肤纹理清晰对焦，自然的毛孔和微观细节，影棚灯光在皮肤上形成微妙高光，椅子和夹克上有金属反射，温暖的肤色，高对比度的红色点缀。
```

#### 🖼️ 生成图片

##### Image 1

<div align="center">
<img src="https://cms-assets.youmind.com/media/1789973008045_1a6l1t_HSkm3_0aIAAknFX.jpg" width="600" alt="电商主图 - Nano Banana Pro 影棚人像提示词 - Image 1">
</div>

##### Image 2

<div align="center">
<img src="https://cms-assets.youmind.com/media/1789973006635_3yt4bu_HSkm5YCaIAAZvk4.jpg" width="600" alt="电商主图 - Nano Banana Pro 影棚人像提示词 - Image 2">
</div>

##### Image 3

<div align="center">
<img src="https://cms-assets.youmind.com/media/1789973008025_2xgo4b_HSkm6_5agAAMdtm.jpg" width="600" alt="电商主图 - Nano Banana Pro 影棚人像提示词 - Image 3">
</div>

#### 📌 详情

- **作者:** [dreamy digital arts](https://x.com/dreamydigiarts)
- **来源:** [Twitter Post](https://x.com/dreamydigiarts/status/2101589681141871060)
- **发布时间:** 2026年9月20日
- **多语言:** en

**[👉 立即尝试 →](https://youmind.com/zh-CN/nano-banana-pro-prompts?id=35099)**

---

### No. 34: 信息图 / 教育视觉图 - 物体转建筑提示词

![Language-EN](https://img.shields.io/badge/Language-EN-blue)

#### 📖 描述

为 Nano Banana Pro 设计的逻辑工作流提示词，用于分析随机物体并基于体量与结构将其转化为合理的标志性建筑。

#### 📝 提示词

```
将随机物体转化为建筑。

2x2 网格布局，针对 4 个不同的随机物体执行此操作。概念：将物体转化为可能存在的标志性建筑。

1. 分析输入（体量与结构）：

体量：（整体式/碎片化/堆叠式/纤细型）

表面：（反射性/多孔性/层状/图案化）

机制：（静态/动态/模块化）

2. 自动选择建筑类型：

若为整体式 + 石质感 → 博物馆

若为反射性 + 空气动力学造型 → 摩天大楼

若为模块化 + 堆叠式 → 住宅综合体

若为多孔性 + 有机形态 → 植物温室

若为动态 + 机械结构 → 交通枢纽

3. 执行：
黄金时段外观渲染，包含人物以体现比例，使用合理材质，电影感广角镜头。
```

#### 🖼️ 生成图片

##### Image 1

<div align="center">
<img src="https://cms-assets.youmind.com/media/1790836512083_wy8lhe_HTRW_GWWEAAnc7S.jpg" width="600" alt="信息图 / 教育视觉图 - 物体转建筑提示词 - Image 1">
</div>

#### 📌 详情

- **作者:** [Gadgetify](https://x.com/Gdgtify)
- **来源:** [Twitter Post](https://x.com/Gdgtify/status/2105051745303114040)
- **发布时间:** 2026年9月29日
- **多语言:** en

**[👉 立即尝试 →](https://youmind.com/zh-CN/nano-banana-pro-prompts?id=35743)**

---

### No. 49: YouTube 缩略图 - 南极探险历史现实主义对比

![Language-EN](https://img.shields.io/badge/Language-EN-blue)

#### 📖 描述

使用历史现实主义提示词对 Nano Banana Pro 和 Flux 2 Pro 进行对比。该提示词已在推文文本中明确分享。

#### 📝 提示词

```
1923 年南极探险的原始档案黑白照片，带有颗粒感、划痕和闪光灯照明效果。疲惫的探险者身穿复古厚重冬装，震惊地凝视着一块巨大且结构复杂的发光金属巨石，它部分冻结在陡峭的冰洞内，照片级真实感，历史纪录片摄影风格，超精细纹理细节。
```

#### 🖼️ 生成图片

##### Image 1

<div align="center">
<img src="https://cms-assets.youmind.com/media/1790750134770_06nj5i_HTY2GKfX0AEWI56.jpg" width="600" alt="YouTube 缩略图 - 南极探险历史现实主义对比 - Image 1">
</div>

##### Image 2

<div align="center">
<img src="https://cms-assets.youmind.com/media/1790750134767_oifjv1_HTY2GK-WUAAJIWR.jpg" width="600" alt="YouTube 缩略图 - 南极探险历史现实主义对比 - Image 2">
</div>

#### 📌 详情

- **作者:** [Elian Iao](https://x.com/elio_ia)
- **来源:** [Twitter Post](https://x.com/elio_ia/status/2104929448155844935)
- **发布时间:** 2026年9月29日
- **多语言:** en

**[👉 立即尝试 →](https://youmind.com/zh-CN/nano-banana-pro-prompts?id=35664)**

---

