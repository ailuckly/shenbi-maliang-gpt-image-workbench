// Style text appended to prompts for built-in style packs (自写). GPT image models follow
// natural-language art direction better than keyword prefixes, so each pack contributes one
// descriptive sentence as a suffix. `legacyPrefix` is the auto-generated value from
// style_packs v1; rows still carrying it (and no suffix) are upgraded once.
export type StylePackPreset = { legacyPrefix: string; suffix: string; negative?: string };

export const STYLE_PACK_PRESETS: Record<string, StylePackPreset> = {
  "system:standard": { legacyPrefix: "", suffix: "" },

  "system:realistic": { legacyPrefix: "写实风格", suffix: "整体为真实摄影质感：自然准确的光影与透视，真实材质与细节，色彩还原克制，画面清晰锐利。", negative: "塑料感、过度磨皮、卡通化" },
  "system:realistic:portrait-photography": { legacyPrefix: "portrait photography", suffix: "风格为专业人像摄影：85mm 定焦浅景深，柔和的主光与轮廓光，皮肤保留真实纹理，眼神清晰有神，背景简洁虚化。", negative: "过度磨皮、五官变形、多余手指" },
  "system:realistic:commercial-product": { legacyPrefix: "commercial product photography", suffix: "风格为高端商业产品摄影：棚拍柔光箱布光，干净的背景与精确的反射控制，材质和边缘细节锐利，构图简洁，有杂志广告质感。", negative: "杂乱背景、廉价塑料感、过曝" },
  "system:realistic:documentary-street": { legacyPrefix: "documentary street photography", suffix: "风格为纪实街头摄影：自然光，抓拍瞬间的真实感，35mm 视角，轻微胶片颗粒，色调克制。", negative: "摆拍感、过度修饰" },
  "system:realistic:landscape-blockbuster": { legacyPrefix: "epic landscape photography", suffix: "风格为风光大片：黄金时段侧光，广角带出纵深与层次，前中远景分明，天空与地貌细节丰富，色彩饱满而不失真。", negative: "雾蒙蒙的灰度、地平线歪斜" },
  "system:realistic:macro-closeup": { legacyPrefix: "macro close-up", suffix: "风格为微距摄影：极近距离，主体纹理纤毫毕现，焦外柔和虚化，光线细腻。", negative: "对焦不清、噪点" },
  "system:realistic:fashion-editorial": { legacyPrefix: "fashion editorial", suffix: "风格为时尚杂志大片：强烈的造型感与姿态，精致的棚拍或外景布光，配色高级统一，具有 Vogue 式编辑质感。", negative: "廉价服装感、姿态僵硬" },

  "system:cinematic": { legacyPrefix: "电影风格", suffix: "整体为电影级画面：宽银幕构图，有叙事感的布光与明暗对比，统一的电影调色，细节丰富。", negative: "平光、画面平淡" },
  "system:cinematic:hollywood-blockbuster": { legacyPrefix: "hollywood blockbuster", suffix: "风格为好莱坞大片：史诗感的场面调度，强烈的明暗与冷暖对比，体积光，青橙调色，视觉冲击力强。" },
  "system:cinematic:cyberpunk": { legacyPrefix: "cyberpunk", suffix: "风格为赛博朋克：雨夜都市，霓虹灯的品红与青色反射在湿润路面，高密度城市细节，冷暖霓虹对比。" },
  "system:cinematic:film-noir": { legacyPrefix: "film noir", suffix: "风格为黑色电影：高反差黑白影调，硬朗的侧光与百叶窗投影，深重阴影，悬疑氛围。" },
  "system:cinematic:european-art-house": { legacyPrefix: "european art-house cinema", suffix: "风格为欧洲文艺电影：自然光，安静克制的构图与留白，低饱和柔和色调，细腻的情绪。" },
  "system:cinematic:horror-thriller": { legacyPrefix: "horror thriller", suffix: "风格为恐怖惊悚片：低调光，阴冷偏绿或偏蓝的色调，压迫感构图，局部光源制造悬念。", negative: "血腥特写" },
  "system:cinematic:historical-epic": { legacyPrefix: "historical epic", suffix: "风格为古装史诗片：考究的服饰与场景道具，宏大的场面，暖金色的自然光与烟尘氛围，厚重的历史质感。" },
  "system:cinematic:sci-fi-space": { legacyPrefix: "sci-fi space", suffix: "风格为科幻太空电影：硬科幻的工业设计细节，冷色调与局部暖色光源，宏大的空间尺度感。" },

  "system:anime": { legacyPrefix: "动漫风格", suffix: "整体为高质量日系动画画风：干净流畅的线条，精致的上色与光影，角色比例协调。", negative: "崩坏的手部、线条杂乱" },
  "system:anime:ghibli": { legacyPrefix: "warm hand-drawn animation", suffix: "风格为温暖的手绘动画：水彩般的柔和背景，自然光与微风感，色彩温润，充满生活气息的细节。" },
  "system:anime:shonen-action": { legacyPrefix: "shonen action", suffix: "风格为少年热血动画：动态透视与速度线，强烈的动作张力，高饱和配色与爆发性的特效光。" },
  "system:anime:shinkai": { legacyPrefix: "lyrical realistic anime", suffix: "风格为写实抒情动画：通透的天空与云层，细腻的光线散射和镜头光晕，背景高度写实，色彩清透。" },
  "system:anime:cel-animation": { legacyPrefix: "cel animation", suffix: "风格为赛璐璐动画：清晰的勾线，平涂色块与硬边阴影，经典动画的明快配色。" },
  "system:anime:mecha-battle": { legacyPrefix: "mecha battle", suffix: "风格为机甲动画：精密的机械结构与面板分割，金属质感，战斗中的推进器光效与烟尘。" },
  "system:anime:shojo-dreamy": { legacyPrefix: "dreamy shojo", suffix: "风格为少女漫画唯美画风：柔和的粉彩色调，闪烁的光点与花瓣点缀，细腻的眼神与发丝。" },
  "system:anime:dark-gothic": { legacyPrefix: "dark gothic anime", suffix: "风格为暗黑哥特动画：深色调与暗红点缀，哥特建筑与蕾丝服饰细节，神秘冷峻的氛围。" },

  "system:artistic": { legacyPrefix: "艺术风格", suffix: "整体为有艺术表现力的绘画作品：明确的媒介笔触，讲究的构图与色彩关系。" },
  "system:artistic:classical-oil": { legacyPrefix: "classical oil painting", suffix: "风格为古典油画：厚涂笔触与画布肌理，伦勃朗式明暗，温暖深沉的色调，博物馆藏品质感。" },
  "system:artistic:watercolor-illustration": { legacyPrefix: "watercolor illustration", suffix: "风格为水彩插画：透明的水色晕染与纸张纹理，留白自然，色彩清新轻盈。" },
  "system:artistic:concept-art": { legacyPrefix: "concept art", suffix: "风格为游戏电影概念设计：清晰的形体与剪影，氛围透视，专业数字绘画质感，设计感强。" },
  "system:artistic:pop-art": { legacyPrefix: "pop art", suffix: "风格为波普艺术：高饱和撞色，网点印刷纹理，粗黑轮廓线，大胆的平面化构图。" },
  "system:artistic:minimalism": { legacyPrefix: "minimalism", suffix: "风格为极简主义：大面积留白，极少的元素与几何秩序，2 到 3 种克制的颜色，干净利落。" },
  "system:artistic:surrealism": { legacyPrefix: "surrealism", suffix: "风格为超现实主义：梦境般的不合理组合，写实的质感描绘不可能的场景，安静而诡谲。" },
  "system:artistic:pixel-art": { legacyPrefix: "pixel art", suffix: "风格为像素艺术：清晰锐利的像素网格，有限调色板，复古游戏质感，无抗锯齿模糊。" },

  "system:commercial": { legacyPrefix: "商业风格", suffix: "整体为专业商业视觉设计：信息层级清晰，品牌感强，配色统一克制，排版精致，可直接用于商业发布。" },
  "system:commercial:ecommerce-product": { legacyPrefix: "ecommerce product", suffix: "风格为电商主图：产品居中清晰完整，干净浅色背景，柔和均匀布光与自然投影，材质真实，适合详情页与主图。", negative: "杂乱道具、产品变形" },
  "system:commercial:brand-advertising": { legacyPrefix: "brand advertising", suffix: "风格为品牌广告大片：明确的创意概念，高级的配色与光影，精致的排版与留白，国际一线品牌的视觉水准。" },
  "system:commercial:social-media": { legacyPrefix: "social media visual", suffix: "风格为社交媒体视觉：主体醒目，色彩明快有记忆点，标题文字清晰易读，适合手机屏幕浏览。" },
  "system:commercial:corporate-promo": { legacyPrefix: "corporate promotion", suffix: "风格为企业宣传视觉：专业可信，现代简洁的版式，商务蓝灰或品牌色，信息层级清楚。" },

  "system:series": { legacyPrefix: "组图风格", suffix: "整组图片保持统一的配色、字体、光线和视觉语言，每张图主题明确且彼此呼应。" },
  "system:series:marketing-campaign": { legacyPrefix: "marketing campaign series", suffix: "作为一套营销活动视觉：统一的主视觉元素、配色与字体系统，各张图按传播用途区分重点，整体有品牌一致性。" },
  "system:series:ecommerce-detail": { legacyPrefix: "ecommerce detail series", suffix: "作为一套电商详情页图：统一的背景与布光，分别展示产品整体、细节、卖点和使用场景，排版风格一致。" },
  "system:series:social-content": { legacyPrefix: "social content series", suffix: "作为一组社交媒体内容：统一的版式模板与配色，每张一个清晰要点，标题醒目，适合连续发布。" },
  "system:series:brand-visual": { legacyPrefix: "brand visual extension", suffix: "作为品牌视觉延展：沿用同一套色彩、图形元素与字体，在不同载体上保持一致的品牌识别。" },
  "system:series:storyboard": { legacyPrefix: "storyboard series", suffix: "作为一组故事分镜：角色造型与场景保持一致，镜头景别有变化，叙事连贯。" },
  "system:series:logo-design": { legacyPrefix: "logo design series", suffix: "作为 Logo 设计方案：图形简洁可识别，矢量扁平风格，纯色背景展示，几何比例严谨，可缩放使用。", negative: "复杂渐变、照片元素、杂乱文字" },

  "system:composition": { legacyPrefix: "构图风格", suffix: "构图讲究：主体突出，视觉动线清晰，前中后景层次分明。" },
  "system:composition:rule-of-thirds": { legacyPrefix: "rule of thirds composition", suffix: "构图采用三分法：主体位于三分线交点，画面平衡且留有呼吸空间。" },
  "system:composition:center-symmetry": { legacyPrefix: "centered symmetry composition", suffix: "构图采用中心对称：主体居中，左右严格对称，庄重稳定。" },
  "system:composition:leading-lines": { legacyPrefix: "leading lines composition", suffix: "构图运用引导线：道路、建筑或光线的线条把视线引向主体。" },
  "system:composition:frame-within-frame": { legacyPrefix: "frame within frame composition", suffix: "构图采用框中框：利用门窗、拱洞等前景框住主体，增强纵深。" },
  "system:composition:diagonal-dynamic": { legacyPrefix: "diagonal dynamic composition", suffix: "构图采用对角线：主体与线条沿对角线展开，画面富有动感。" },
  "system:composition:negative-space": { legacyPrefix: "negative space composition", suffix: "构图大面积留白：主体小而精致，背景干净，适合放置标题文字。" },
  "system:composition:foreground-depth": { legacyPrefix: "foreground depth composition", suffix: "构图加入虚化的前景元素，形成明显的前中后景层次与空间纵深。" },
  "system:composition:golden-spiral": { legacyPrefix: "golden spiral composition", suffix: "构图遵循黄金螺旋：视觉元素沿螺旋线汇聚到主体。" },
  "system:composition:close-crop": { legacyPrefix: "close crop composition", suffix: "构图采用近景大胆裁切：主体充满画面，突出局部细节与张力。" },
  "system:composition:flat-lay": { legacyPrefix: "flat lay composition", suffix: "构图采用正上方俯拍平铺：物品整齐有序排列，柔和顶光，背景干净。" },

  "system:detailed": { legacyPrefix: "细节风格", suffix: "画面细节丰富锐利：材质、纹理与光影层次清晰可辨。" },
  "system:detailed:material-texture": { legacyPrefix: "material texture", suffix: "强调材质纹理：金属、织物、木材、皮革等表面细节真实可触，反射与粗糙度准确。" },
  "system:detailed:lighting-enhancement": { legacyPrefix: "lighting enhancement", suffix: "强化光影设计：主光、辅光与轮廓光层次分明，明暗过渡细腻，有体积感。" },
  "system:detailed:environment-atmosphere": { legacyPrefix: "environment atmosphere", suffix: "强化环境氛围：空气透视、薄雾、尘埃或光束营造空间感与情绪。" },

  "system:creative": { legacyPrefix: "创意风格", suffix: "整体有鲜明的创意概念：出人意料的视觉组合，但画面完成度高、主题清晰。" },
  "system:creative:surreal-collage": { legacyPrefix: "surreal collage", suffix: "风格为超现实拼贴：不同尺度与材质的元素拼贴组合，剪纸边缘与层叠阴影，编辑设计感。" },
  "system:creative:double-exposure": { legacyPrefix: "double exposure", suffix: "风格为双重曝光：人物或主体剪影与风景、纹理自然融合，边缘过渡柔和，背景干净。" },
  "system:creative:glitch-art": { legacyPrefix: "glitch art", suffix: "风格为故障艺术：RGB 通道错位、扫描线与数字噪点，霓虹色调，赛博质感。" },
  "system:creative:fantasy-world": { legacyPrefix: "fantasy worldbuilding", suffix: "风格为奇幻世界观插画：宏大的奇幻场景与独特建筑，魔法光效，丰富的世界细节。" }
};
