// Existing project style instructions, moved without changing legacy optimization.
type PromptOptimizeStyleConfig = {
  label: string;
  temperature?: number;
  instructions: string[];
  rules: Record<string, unknown>;
};

export const promptOptimizeStyleConfigs: Record<string, PromptOptimizeStyleConfig> = {
  standard: {
    label: "标准风格",
    instructions: [
      "使用标准优化风格：在准确保留用户意图的基础上，让提示词更完整、更清晰、更适合直接生图。"
    ],
    rules: {
      balance: "clarity, usability, visual completeness"
    }
  },
  realistic: {
    label: "写实风格",
    temperature: 0.62,
    instructions: [
      "使用写实风格：强化真实摄影感，补充专业摄影词汇，如镜头焦段、景深、光线方向、曝光、质感和真实材质。",
      "画面应像真实拍摄或高质量商业摄影，不要加入卡通化、插画化或不符合现实物理的效果。"
    ],
    rules: {
      balance: "photorealism, lens, lighting, material realism",
      avoid: "cartoon, illustration, physically implausible effects"
    }
  },
  cinematic: {
    label: "电影风格",
    temperature: 0.78,
    instructions: [
      "使用电影风格：强化叙事感、镜头语言、构图层次、色调、光影反差、情绪氛围和场景张力。",
      "可以加入电影摄影常用表达，如 cinematic lighting、wide shot、close-up、depth of field、film grain、color grading，但必须服务用户主题。"
    ],
    rules: {
      balance: "storytelling, camera language, mood, color grading",
      avoid: "unrelated plot changes or excessive drama"
    }
  },
  anime: {
    label: "动漫风格",
    temperature: 0.72,
    instructions: [
      "使用动漫风格：面向二次元、动画、角色插画和日系/国风插画表达，补充线稿、赛璐璐上色、角色神态、画面层次和背景氛围。",
      "如果用户原始需求不是动漫或插画，也要保持主题和用途不变，只把视觉语言转向动漫插画。"
    ],
    rules: {
      balance: "anime illustration, character expression, line art, cel shading",
      avoid: "breaking the requested subject or intended use"
    }
  },
  artistic: {
    label: "艺术风格",
    temperature: 0.82,
    instructions: [
      "使用艺术风格：往绘画和艺术创作方向改写，加入媒介、艺术流派、笔触、肌理、色彩关系和画家风格参考。",
      "艺术化描述要与主题匹配，避免堆砌互相冲突的流派或画家风格。"
    ],
    rules: {
      balance: "art movement, painterly texture, brushwork, color harmony",
      avoid: "conflicting art styles"
    }
  },
  commercial: {
    label: "商业质感",
    temperature: 0.55,
    instructions: [
      "使用商业质感风格：突出品牌感、产品价值、视觉高级感、干净构图和可转化的商业表达。",
      "避免过度艺术化，优先让画面适合广告、海报、电商、运营或品牌展示。"
    ],
    rules: {
      balance: "brand value, premium look, conversion-oriented clarity",
      avoid: "overly abstract art direction"
    }
  },
  series: {
    label: "组图",
    temperature: 0.62,
    instructions: [
      "使用组图风格：把用户需求优化成适合连续生成多张图的一组提示词，核心是统一视觉系统、明确分图用途和稳定主体一致性。",
      "必须保留同一主体、品牌名、产品特征、角色设定、配色、光线、构图语言和视觉调性；每张图承担不同功能，不要只是重复同一张图。",
      "输出应是一个可直接复制使用的系列提示词，包含统一视觉约束和按编号排列的分图规划；不要生成拼图、九宫格或把多张图挤在同一画面里。"
    ],
    rules: {
      balance: "series consistency, shared visual system, distinct image roles",
      outputMode: "one reusable prompt with numbered image plan",
      avoid: "collage, grid layout, unrelated variations, changing subject identity"
    }
  },
  composition: {
    label: "构图",
    temperature: 0.64,
    instructions: [
      "使用构图优化：不改变用户指定画风和主题，重点根据提示词类型自动选择合适的构图手法。",
      "先判断原始提示词适合三分法、中心对称、引导线、框中框、对角线动势、留白构图、前景层次、黄金螺旋、近景裁切、平铺俯拍或其他主流构图，再补充匹配的主体位置、画幅倾向、镜头距离、视线动线、留白、前中后景和视觉层级。",
      "如果用户已明确指定构图、比例、机位或排版，必须优先保留；不要强行套用不匹配的构图手法。"
    ],
    rules: {
      balance: "composition selection, visual hierarchy, subject placement, framing",
      autoSelect: "rule of thirds, center symmetry, leading lines, frame within frame, diagonal dynamic, negative space, foreground depth, golden spiral, close crop, flat lay",
      avoid: "changing art style or forcing an unrelated composition technique"
    }
  },
  detailed: {
    label: "细节丰富",
    temperature: 0.75,
    instructions: [
      "使用细节丰富风格：重点补充主体细节、材质、光线、镜头、构图、背景层次、色彩和质感。",
      "细节要服务画面可执行性，不要堆砌互相冲突的形容词。"
    ],
    rules: {
      balance: "materials, lighting, lens, composition, scene depth",
      avoid: "conflicting adjectives"
    }
  },
  creative: {
    label: "创意强化",
    temperature: 0.9,
    instructions: [
      "使用创意强化风格：可以加入更有想象力的画面概念、氛围、叙事感和视觉张力。",
      "创意补充必须围绕用户原意展开，不要改变主题、用途、品牌、数量、比例和硬性约束。"
    ],
    rules: {
      balance: "imagination, atmosphere, visual tension",
      avoid: "changing required constraints"
    }
  }
};

export const promptOptimizeSubStyleConfigs: Record<string, PromptOptimizeStyleConfig> = {
  "realistic:portrait-photography": {
    label: "人像摄影",
    temperature: 0.6,
    instructions: [
      "子风格方向：人像摄影。强化浅景深、自然肤质、眼神情绪、面部光影、背景虚化和真实摄影质感。",
      "如果包含人物，优先补充镜头焦段、光源位置、肤色质感、服装细节和情绪表达。"
    ],
    rules: { subStyle: "portrait photography", balance: "skin texture, shallow depth of field, emotional lighting" }
  },
  "realistic:commercial-product": {
    label: "商业产品",
    temperature: 0.54,
    instructions: [
      "子风格方向：商业产品摄影。强化干净背景、精准布光、产品材质、边缘高光、阴影控制和卖点呈现。",
      "画面应适合电商详情页、广告主图或品牌展示，不要让背景抢走主体。"
    ],
    rules: { subStyle: "commercial product photography", balance: "clean background, controlled lighting, material highlights" }
  },
  "realistic:documentary-street": {
    label: "纪实街拍",
    temperature: 0.66,
    instructions: [
      "子风格方向：纪实街拍。强化自然光、抓拍瞬间、生活现场感、轻微颗粒和真实环境细节。",
      "避免过度摆拍和棚拍感，让画面像真实街头或日常场景中捕捉到的瞬间。"
    ],
    rules: { subStyle: "documentary street photography", balance: "available light, candid moment, film grain" }
  },
  "realistic:landscape-blockbuster": {
    label: "风光大片",
    temperature: 0.66,
    instructions: [
      "子风格方向：风光大片。强化黄金时段、广角视野、壮阔层次、云影、地貌尺度和空气透视。",
      "画面应有强空间感和自然景观震撼力，同时保留用户指定地点或主体。"
    ],
    rules: { subStyle: "epic landscape photography", balance: "golden hour, wide angle, scale, atmospheric perspective" }
  },
  "realistic:macro-closeup": {
    label: "微距特写",
    temperature: 0.58,
    instructions: [
      "子风格方向：微距特写。强化极近距离、细小纹理、焦外虚化、微小高光和局部细节。",
      "主体应清晰可识别，背景可高度虚化，但不要丢失用户指定的关键元素。"
    ],
    rules: { subStyle: "macro close-up", balance: "extreme detail, bokeh, tiny textures" }
  },
  "realistic:fashion-editorial": {
    label: "时尚大片",
    temperature: 0.68,
    instructions: [
      "子风格方向：时尚大片。强化杂志质感、高级造型、姿态、服装材质、大片布光和精致构图。",
      "优先呈现高级、克制、利落的视觉表达，不要堆砌廉价装饰。"
    ],
    rules: { subStyle: "fashion editorial", balance: "premium styling, magazine lighting, pose, wardrobe texture" }
  },
  "cinematic:hollywood-blockbuster": {
    label: "好莱坞大片",
    temperature: 0.8,
    instructions: [
      "子风格方向：好莱坞大片。强化史诗规模、强对比、英雄式构图、动作张力、大场面光影和视觉冲击。",
      "可以补充 dramatic backlight、epic wide shot、high contrast、large-scale set pieces 等表达，但不要改变主体设定。"
    ],
    rules: { subStyle: "hollywood blockbuster", balance: "epic scale, high contrast, visual impact" }
  },
  "cinematic:cyberpunk": {
    label: "赛博朋克",
    temperature: 0.84,
    instructions: [
      "子风格方向：赛博朋克。强化霓虹灯、雨夜反光、未来都市、电子屏、金属材质、潮湿街道和冷暖色冲突。",
      "保持用户主题不变，将视觉语言转向高科技与低生活感并存的未来城市氛围。"
    ],
    rules: { subStyle: "cyberpunk", balance: "neon, rainy night, futuristic city, reflective surfaces" }
  },
  "cinematic:film-noir": {
    label: "黑色电影",
    temperature: 0.72,
    instructions: [
      "子风格方向：黑色电影。强化高反差黑白、硬光阴影、百叶窗光、悬疑感、烟雾和低调构图。",
      "画面应克制、紧张、带有经典悬疑电影的阴影叙事。"
    ],
    rules: { subStyle: "film noir", balance: "black and white, hard shadows, suspense, low-key lighting" }
  },
  "cinematic:european-art-house": {
    label: "欧洲文艺",
    temperature: 0.7,
    instructions: [
      "子风格方向：欧洲文艺。强化自然光、慢节奏、真实克制的表演感、生活化场景和留白构图。",
      "避免夸张戏剧化，画面应更安静、细腻、带有人文气质。"
    ],
    rules: { subStyle: "european art-house cinema", balance: "natural light, restraint, quiet composition" }
  },
  "cinematic:horror-thriller": {
    label: "恐怖惊悚",
    temperature: 0.82,
    instructions: [
      "子风格方向：恐怖惊悚。强化低照度、压抑空间、冷色阴影、未知威胁、诡异细节和紧张氛围。",
      "保持主题边界，不要加入血腥暴力或与用户需求无关的恐怖元素。"
    ],
    rules: { subStyle: "horror thriller", balance: "low light, oppressive mood, uncanny details" }
  },
  "cinematic:historical-epic": {
    label: "古装史诗",
    temperature: 0.78,
    instructions: [
      "子风格方向：古装史诗。强化历史质感、宫廷或战场规模、服饰纹样、年代材质、宏大构图和庄重光影。",
      "补充时代氛围时要服务用户主题，不要编造冲突的年代、阵营或文化元素。"
    ],
    rules: { subStyle: "historical epic", balance: "period texture, grand scale, costume detail, solemn lighting" }
  },
  "cinematic:sci-fi-space": {
    label: "科幻太空",
    temperature: 0.8,
    instructions: [
      "子风格方向：科幻太空。强化宇宙尺度、飞船结构、未来科技界面、冷色金属、星云和太空光影。",
      "科技设定要清晰可信，避免让装饰性元素破坏主体可读性。"
    ],
    rules: { subStyle: "sci-fi space", balance: "spaceships, cosmic scale, futuristic technology, metallic surfaces" }
  },
  "anime:ghibli": {
    label: "吉卜力",
    temperature: 0.72,
    instructions: [
      "子风格方向：自然温暖的手绘动画感。强化柔和自然、田园场景、手绘水彩质感、温暖光线和童话般生活气息。",
      "不要使用受版权保护的角色或标志，只提炼自然、温暖、细腻的动画视觉语言。"
    ],
    rules: { subStyle: "warm hand-drawn animation", balance: "nature, watercolor softness, gentle atmosphere" }
  },
  "anime:shonen-action": {
    label: "少年热血",
    temperature: 0.78,
    instructions: [
      "子风格方向：少年热血。强化高速动作、夸张姿态、速度线、爆炸特效、能量冲击和强烈表情。",
      "动作要清晰有力，避免让特效遮住主体。"
    ],
    rules: { subStyle: "shonen action", balance: "dynamic pose, impact effects, speed lines, expressive face" }
  },
  "anime:shinkai": {
    label: "新海诚",
    temperature: 0.72,
    instructions: [
      "子风格方向：唯美现实动画感。强化光晕、逆光、细腻天空、城市背景、玻璃反光、空气感和清透色彩。",
      "不要直接模仿在世创作者的个人画风，只保留光影、背景精细度和唯美现实氛围。"
    ],
    rules: { subStyle: "lyrical realistic anime", balance: "glow, detailed background, sky, reflective light" }
  },
  "anime:cel-animation": {
    label: "赛璐璐",
    temperature: 0.68,
    instructions: [
      "子风格方向：赛璐璐。强化复古动画平涂、干净线稿、明确色块、少量阴影和胶片时代动画质感。",
      "色彩和边线要清晰稳定，避免过度真实渲染。"
    ],
    rules: { subStyle: "cel animation", balance: "flat color, clean line art, limited shadows, retro anime" }
  },
  "anime:mecha-battle": {
    label: "机甲战斗",
    temperature: 0.78,
    instructions: [
      "子风格方向：机甲战斗。强化硬核机械结构、装甲分件、关节细节、能量武器、战斗姿态和工业尺度。",
      "不要使用具体受版权保护的机体名称或标志，重点描述原创机械设计语言。"
    ],
    rules: { subStyle: "mecha battle", balance: "armor plates, mechanical joints, weapons, industrial scale" }
  },
  "anime:shojo-dreamy": {
    label: "少女唯美",
    temperature: 0.74,
    instructions: [
      "子风格方向：少女唯美。强化柔和粉色、花卉、闪光、轻盈服饰、梦幻背景和温柔表情。",
      "保持画面清爽甜美，不要过度堆叠装饰。"
    ],
    rules: { subStyle: "dreamy shojo", balance: "pastel color, flowers, sparkle, gentle expression" }
  },
  "anime:dark-gothic": {
    label: "暗黑哥特",
    temperature: 0.8,
    instructions: [
      "子风格方向：暗黑哥特。强化地下城、哥特建筑、冷暗配色、神秘符号、暗影层次和奇诡氛围。",
      "可以加入黑暗幻想感，但不要偏离用户指定主体。"
    ],
    rules: { subStyle: "dark gothic anime", balance: "gothic architecture, dark fantasy, shadow layers" }
  },
  "artistic:classical-oil": {
    label: "油画古典",
    temperature: 0.78,
    instructions: [
      "子风格方向：油画古典。强化古典油画媒介、厚重明暗、伦勃朗式光影、文艺复兴构图和细腻肌理。",
      "艺术参考要统一，不要混入冲突的现代数字特效。"
    ],
    rules: { subStyle: "classical oil painting", balance: "chiaroscuro, renaissance composition, oil texture" }
  },
  "artistic:watercolor-illustration": {
    label: "水彩插画",
    temperature: 0.76,
    instructions: [
      "子风格方向：水彩插画。强化透明颜料、湿润晕染、轻盈边缘、纸张纹理和柔和留白。",
      "保持画面清透，不要加入厚重油画或高反差金属质感。"
    ],
    rules: { subStyle: "watercolor illustration", balance: "transparent wash, bloom, paper texture, lightness" }
  },
  "artistic:concept-art": {
    label: "概念艺术",
    temperature: 0.84,
    instructions: [
      "子风格方向：概念艺术。强化游戏/影视概念设计、清晰剪影、世界观信息、设计逻辑、场景尺度和视觉探索。",
      "补充设定时要让主体更可执行，不要只堆形容词。"
    ],
    rules: { subStyle: "concept art", balance: "design logic, silhouette, worldbuilding, production art" }
  },
  "artistic:pop-art": {
    label: "波普艺术",
    temperature: 0.82,
    instructions: [
      "子风格方向：波普艺术。强化高饱和色块、重复图案、网点印刷、强图形感和广告文化视觉。",
      "保持主体轮廓醒目，避免复杂纹样影响识别。"
    ],
    rules: { subStyle: "pop art", balance: "high saturation, repeated pattern, halftone, graphic contrast" }
  },
  "artistic:minimalism": {
    label: "极简主义",
    temperature: 0.62,
    instructions: [
      "子风格方向：极简主义。强化几何构成、大面积留白、纯色块、少量关键元素和清晰秩序。",
      "尽量减少无关细节，让用户指定主体以最少元素被准确表达。"
    ],
    rules: { subStyle: "minimalism", balance: "geometry, negative space, simple color blocks" }
  },
  "artistic:surrealism": {
    label: "超现实主义",
    temperature: 0.9,
    instructions: [
      "子风格方向：超现实主义。强化梦境逻辑、尺度错位、象征元素、意外组合和奇异空间关系。",
      "创意变化必须围绕用户原始主题，不能替换主体或关键约束。"
    ],
    rules: { subStyle: "surrealism", balance: "dream logic, symbolic objects, unexpected scale" }
  },
  "artistic:pixel-art": {
    label: "像素艺术",
    temperature: 0.7,
    instructions: [
      "子风格方向：像素艺术。强化 8-bit/16-bit 复古游戏感、有限色板、清晰像素块、等距或横版构图。",
      "确保主体在低分辨率视觉语言下仍然可读。"
    ],
    rules: { subStyle: "pixel art", balance: "limited palette, visible pixels, retro game readability" }
  },
  "commercial:ecommerce-product": {
    label: "电商产品",
    temperature: 0.52,
    instructions: [
      "子风格方向：电商产品。强化简洁背景、清晰卖点、主体居中、材质展示、可购买感和信息直达。",
      "画面应服务商品转化，不要加入分散注意力的复杂剧情。"
    ],
    rules: { subStyle: "ecommerce product", balance: "clean background, selling points, product clarity" }
  },
  "commercial:brand-advertising": {
    label: "品牌广告",
    temperature: 0.58,
    instructions: [
      "子风格方向：品牌广告。强化高端调性、视觉统一、品牌价值、情绪场景、版式留白和广告大片感。",
      "如果有品牌名或文字内容，必须保留并服务统一调性。"
    ],
    rules: { subStyle: "brand advertising", balance: "premium tone, brand consistency, campaign visual" }
  },
  "commercial:social-media": {
    label: "社交媒体",
    temperature: 0.72,
    instructions: [
      "子风格方向：社交媒体。强化高饱和抓眼、活泼构图、明确焦点、短平快传播感和移动端可读性。",
      "画面要第一眼吸引注意，但不要牺牲主体识别。"
    ],
    rules: { subStyle: "social media visual", balance: "eye-catching color, mobile readability, energetic composition" }
  },
  "commercial:corporate-promo": {
    label: "企业宣传",
    temperature: 0.54,
    instructions: [
      "子风格方向：企业宣传。强化专业、可信、大气、整洁办公或行业场景、稳重配色和清晰信息层级。",
      "避免过度娱乐化，让画面适合官网、展会或企业介绍。"
    ],
    rules: { subStyle: "corporate promotion", balance: "professional, trustworthy, clean hierarchy" }
  },
  "series:marketing-campaign": {
    label: "营销套图",
    temperature: 0.58,
    instructions: [
      "子风格方向：营销套图。将需求拆成主视觉、核心卖点、使用场景、活动氛围、封面或收尾图等不同用途。",
      "每张图要共享品牌调性、配色、主体和光影，但构图与信息重点要有差异，适合一次生成多张用于同一活动。"
    ],
    rules: { subStyle: "marketing campaign series", balance: "hero visual, selling points, scenes, campaign consistency" }
  },
  "series:ecommerce-detail": {
    label: "电商详情",
    temperature: 0.54,
    instructions: [
      "子风格方向：电商详情。将产品需求拆成主图、材质细节、使用场景、卖点说明、规格对比或包装展示。",
      "强调商品可购买感、主体清晰、背景干净和细节可信；不要让每张图都变成同一角度的重复产品照。"
    ],
    rules: { subStyle: "ecommerce detail series", balance: "main image, detail close-up, usage scene, selling point breakdown" }
  },
  "series:social-content": {
    label: "社媒内容",
    temperature: 0.68,
    instructions: [
      "子风格方向：社媒内容。将需求拆成封面、正文配图、步骤图、对比图、情绪图或结尾引导图。",
      "画面要适合移动端浏览，重点清晰、节奏有变化，保持同一套颜色、字体氛围和视觉记忆点。"
    ],
    rules: { subStyle: "social content series", balance: "cover, feed image, step visual, comparison, mobile readability" }
  },
  "series:brand-visual": {
    label: "品牌延展",
    temperature: 0.56,
    instructions: [
      "子风格方向：品牌延展。将需求拆成品牌主视觉、海报、Banner、包装或空间应用等延展画面。",
      "品牌名称、视觉符号、色彩系统和高级感要稳定统一，所有分图应像同一品牌项目下的系列物料。"
    ],
    rules: { subStyle: "brand visual extension", balance: "key visual, poster, banner, packaging, brand applications" }
  },
  "series:storyboard": {
    label: "故事分镜",
    temperature: 0.7,
    instructions: [
      "子风格方向：故事分镜。将同一角色、产品或场景拆成连续镜头，明确起承转合、镜头距离和场景变化。",
      "必须保持角色外观、产品形态、服装、道具和世界观一致；每张图推进一个动作或情绪节点。"
    ],
    rules: { subStyle: "storyboard series", balance: "same subject, sequential shots, scene progression, camera distance" }
  },
  "series:logo-design": {
    label: "Logo设计",
    temperature: 0.5,
    instructions: [
      "子风格方向：Logo设计。生成一组 logo 方案或品牌延展图，而不是单张拼图；保持品牌名称、行业、调性和核心符号一致。",
      "分图应覆盖主标志、图形符号、字标组合、黑白版或反白版、名片/包装/门头等应用场景；适合多张连续生成后挑选和延展。",
      "明确避免复杂小字、难识别细节、仿冒知名品牌或受版权保护的商标；如果用户给了品牌名，必须原样保留品牌名。"
    ],
    rules: {
      subStyle: "logo design series",
      balance: "logo concepts, symbol mark, wordmark, monochrome, brand applications",
      avoid: "tiny unreadable text, trademark imitation, over-detailed marks"
    }
  },
  "composition:rule-of-thirds": {
    label: "三分法",
    temperature: 0.62,
    instructions: [
      "子风格方向：三分法构图。将主体或关键视觉焦点放在三分线交点附近，平衡主体、环境和留白。",
      "画面要稳定、自然、有呼吸感，不要让主体贴边或落在无意义的位置。"
    ],
    rules: { subStyle: "rule of thirds composition", balance: "thirds grid, balanced subject placement, natural negative space" }
  },
  "composition:center-symmetry": {
    label: "中心对称",
    temperature: 0.56,
    instructions: [
      "子风格方向：中心对称构图。强化居中主体、轴线对称、左右平衡、稳定秩序和仪式感。",
      "适合需要正式、庄重、产品级或建筑秩序的画面；避免无意义的倾斜和杂乱背景。"
    ],
    rules: { subStyle: "centered symmetry composition", balance: "center focus, symmetry axis, visual order" }
  },
  "composition:leading-lines": {
    label: "引导线",
    temperature: 0.64,
    instructions: [
      "子风格方向：引导线构图。使用道路、栏杆、建筑线条、光束、河流或视线方向把观看者目光导向主体。",
      "线条必须服务主体和空间深度，不要为了线条而破坏主题。"
    ],
    rules: { subStyle: "leading lines composition", balance: "visual path, directional lines, depth, subject guidance" }
  },
  "composition:frame-within-frame": {
    label: "框中框",
    temperature: 0.66,
    instructions: [
      "子风格方向：框中框构图。使用门窗、拱门、树枝、前景物、屏幕或建筑结构形成天然画框，集中注意力。",
      "框架元素应增强层次和叙事，不要遮挡主体关键信息。"
    ],
    rules: { subStyle: "frame within frame composition", balance: "foreground frame, subject focus, depth layering" }
  },
  "composition:diagonal-dynamic": {
    label: "对角线动势",
    temperature: 0.72,
    instructions: [
      "子风格方向：对角线动势构图。用斜向主体、倾斜线条、动作轨迹或光影方向制造速度感、冲突感和画面张力。",
      "动势要清晰可读，避免让主体失衡或关键元素被切碎。"
    ],
    rules: { subStyle: "diagonal dynamic composition", balance: "diagonal movement, tension, action direction" }
  },
  "composition:negative-space": {
    label: "留白构图",
    temperature: 0.58,
    instructions: [
      "子风格方向：留白构图。使用大面积干净背景、空白区域或低信息区突出主体、情绪和文字空间。",
      "留白应有设计感和呼吸感，不要变成主体太小或信息不足。"
    ],
    rules: { subStyle: "negative space composition", balance: "minimal background, breathing room, clear focus" }
  },
  "composition:foreground-depth": {
    label: "前景层次",
    temperature: 0.66,
    instructions: [
      "子风格方向：前景层次构图。安排前景遮挡、中景主体和远景背景，强化空间纵深、透视和沉浸感。",
      "前景只能辅助层次，不要喧宾夺主或挡住核心主体。"
    ],
    rules: { subStyle: "foreground depth composition", balance: "foreground, midground, background, perspective depth" }
  },
  "composition:golden-spiral": {
    label: "黄金螺旋",
    temperature: 0.66,
    instructions: [
      "子风格方向：黄金螺旋构图。用弧线、旋转动线或元素尺度递进组织画面，让视觉自然汇聚到主体。",
      "螺旋关系要自然融入画面，不要显得机械或刻意。"
    ],
    rules: { subStyle: "golden spiral composition", balance: "spiral flow, visual rhythm, focal convergence" }
  },
  "composition:close-crop": {
    label: "近景裁切",
    temperature: 0.62,
    instructions: [
      "子风格方向：近景裁切构图。通过大胆近景、局部裁切、边缘切入和大主体比例强化细节、表情、质感或冲击力。",
      "裁切要有设计目的，不能切掉用户明确要求完整展示的关键信息。"
    ],
    rules: { subStyle: "close crop composition", balance: "tight framing, detail impact, intentional crop" }
  },
  "composition:flat-lay": {
    label: "平铺俯拍",
    temperature: 0.6,
    instructions: [
      "子风格方向：平铺俯拍构图。采用俯视视角、平面排列、网格秩序、间距控制和图案化关系组织主体。",
      "元素摆放要清晰、有节奏，避免堆叠混乱。"
    ],
    rules: { subStyle: "flat lay composition", balance: "top-down view, grid order, spacing rhythm, pattern layout" }
  },
  "detailed:material-texture": {
    label: "材质纹理",
    temperature: 0.7,
    instructions: [
      "子风格方向：材质纹理。重点强化布料、金属、玻璃、皮肤、木材、石材等真实表面质感和触感细节。",
      "材质描述要和主体匹配，不要给不相关元素强行添加纹理。"
    ],
    rules: { subStyle: "material texture", balance: "surface detail, tactile quality, realistic material" }
  },
  "detailed:lighting-enhancement": {
    label: "光影强化",
    temperature: 0.7,
    instructions: [
      "子风格方向：光影强化。重点补充主光、辅光、轮廓光、阴影层次、反射、高光和明暗节奏。",
      "光源方向要清晰一致，避免互相冲突的光影描述。"
    ],
    rules: { subStyle: "lighting enhancement", balance: "key light, rim light, shadow hierarchy, highlights" }
  },
  "detailed:environment-atmosphere": {
    label: "环境氛围",
    temperature: 0.76,
    instructions: [
      "子风格方向：环境氛围。重点强化烟雾、粒子、体积光、空气湿度、背景层次和场景包裹感。",
      "氛围要服务主题，不要让环境特效遮挡主体。"
    ],
    rules: { subStyle: "environment atmosphere", balance: "fog, particles, volumetric light, scene depth" }
  },
  "creative:surreal-collage": {
    label: "超现实拼贴",
    temperature: 0.92,
    instructions: [
      "子风格方向：超现实拼贴。强化打破常规的元素组合、拼贴层次、异质材质并置和奇异叙事感。",
      "拼贴元素必须围绕用户原意展开，不能变成无关概念集合。"
    ],
    rules: { subStyle: "surreal collage", balance: "unexpected combination, layered collage, concept coherence" }
  },
  "creative:double-exposure": {
    label: "双重曝光",
    temperature: 0.84,
    instructions: [
      "子风格方向：双重曝光。强化两个影像层的叠加融合、轮廓承载画面、透明过渡和诗意关联。",
      "两层影像要有清晰关系，避免主体变得不可辨认。"
    ],
    rules: { subStyle: "double exposure", balance: "image blending, silhouette, translucent layers" }
  },
  "creative:glitch-art": {
    label: "故障艺术",
    temperature: 0.86,
    instructions: [
      "子风格方向：故障艺术。强化数字噪点、扫描线、色彩错位、数据破碎、屏幕失真和科技不稳定感。",
      "故障效果要增强风格，不要破坏关键信息和主体轮廓。"
    ],
    rules: { subStyle: "glitch art", balance: "digital noise, chromatic offset, scanlines, distortion" }
  },
  "creative:fantasy-world": {
    label: "奇幻世界观",
    temperature: 0.92,
    instructions: [
      "子风格方向：奇幻世界观。强化架空世界、异世界规则、独特建筑、生物、符号系统和沉浸式场景设定。",
      "世界观补充要围绕用户主题，保留数量、比例、用途和硬性约束。"
    ],
    rules: { subStyle: "fantasy worldbuilding", balance: "fictional world, architecture, symbols, immersive setting" }
  }
};

