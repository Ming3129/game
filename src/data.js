// 数据层：饰品图鉴、盲盒档位、硬币、粉丝等级、宝石市场等静态配置。

// 品质：restock=重复开出补货数；bonus=订单中每袋加价；unitPrice=商店单件补货价
export const RARITIES = {
  common:    { key: 'common',    name: '普通', color: '#2b5285', restock: 10, bonus: 0,  unitPrice: 1   },
  rare:      { key: 'rare',      name: '稀有', color: '#3c7834', restock: 5, bonus: 12, unitPrice: 5  },
  epic:      { key: 'epic',      name: '史诗', color: '#603872', restock: 2, bonus: 30, unitPrice: 15  },
  legendary: { key: 'legendary', name: '传说', color: '#a46206', restock: 1, bonus: 80, unitPrice: 30 },
  limited:   { key: 'limited',   name: '限定', color: '#9f130a', restock: 0, bonus: 0,  unitPrice: 0   },
}

export const CATS = {
  ring:     { key: 'ring',     name: '戒指' },
  necklace: { key: 'necklace', name: '项链' },
  bracelet: { key: 'bracelet', name: '手链' },
  earring:  { key: 'earring',  name: '耳环' },
}
export const CAT_KEYS = Object.keys(CATS)

// 图鉴：每类每品质 2 款 + 每类 1 款限定（宝石镶嵌解锁）
export const DESIGNS = [
//戒指
  { id: 'ring_c1',  cat: 'ring', rarity: 'common',    name: '素圈银戒' },
  { id: 'ring_c2',  cat: 'ring', rarity: 'common',    name: '宽版银戒' },
  { id: 'ring_c3',  cat: 'ring', rarity: 'common',    name: '扭纹银戒' },
  { id: 'ring_c4',  cat: 'ring', rarity: 'common',    name: '磨砂银戒' },
  { id: 'ring_c5',  cat: 'ring', rarity: 'common',    name: '小钻素戒' },
  { id: 'ring_c6',  cat: 'ring', rarity: 'common',    name: '贝母方戒' },
  { id: 'ring_c7',  cat: 'ring', rarity: 'common',    name: '小猫银戒' },
  { id: 'ring_c8',  cat: 'ring', rarity: 'common',    name: '糖纸银戒' },
  { id: 'ring_c9',  cat: 'ring', rarity: 'common',    name: '莫比乌斯环' },
  { id: 'ring_c10', cat: 'ring', rarity: 'common',   name: '蝴蝶结银戒' },
  { id: 'ring_c11', cat: 'ring', rarity: 'common',   name: '星星银戒' },

  { id: 'ring_r1',  cat: 'ring', rarity: 'rare',      name: '月光石戒' },
  { id: 'ring_r2',  cat: 'ring', rarity: 'rare',      name: '藤蔓缠指' },
  { id: 'ring_r3',  cat: 'ring', rarity: 'rare',      name: '拉丝蝴蝶' },
  { id: 'ring_r4',  cat: 'ring', rarity: 'rare',      name: '满钻排戒' },
  { id: 'ring_r5',  cat: 'ring', rarity: 'rare',      name: '珍珠银戒' },
  { id: 'ring_r6',  cat: 'ring', rarity: 'rare',      name: '椭圆宝石戒' },
  { id: 'ring_r7',  cat: 'ring', rarity: 'rare',      name: '方形宝石戒' },
  { id: 'ring_r8',  cat: 'ring', rarity: 'rare',      name: '红玫瑰银戒' },

  { id: 'ring_e1',  cat: 'ring', rarity: 'epic',      name: '海棠凝露' },
  { id: 'ring_e2',  cat: 'ring', rarity: 'epic',      name: '月桂缠枝' },
  { id: 'ring_e3',  cat: 'ring', rarity: 'epic',      name: '蔷薇荆棘' },
  { id: 'ring_e4',  cat: 'ring', rarity: 'epic',      name: '星轨密镶' },

  { id: 'ring_l1',  cat: 'ring', rarity: 'legendary', name: '泪滴蓝宝' },
  { id: 'ring_l2',  cat: 'ring', rarity: 'legendary', name: '凰羽鎏金' },

  { id: 'ring_x1', cat: 'ring', rarity: 'limited', name: '绯樱魔晶戒' },

//项链
  { id: 'nck_c1',   cat: 'necklace', rarity: 'common',    name: '珍珠锁骨链' },
  { id: 'nck_c2',   cat: 'necklace', rarity: 'common',    name: '细银十字链' },
  { id: 'nck_c3',   cat: 'necklace', rarity: 'common',    name: '细银圆链' },
  { id: 'nck_c4',   cat: 'necklace', rarity: 'common',    name: '简约蛇骨链' },
  { id: 'nck_c5',   cat: 'necklace', rarity: 'common',    name: '双层细链' },
  { id: 'nck_c6',   cat: 'necklace', rarity: 'common',    name: '小月牙银链' },
  { id: 'nck_c7',   cat: 'necklace', rarity: 'common',    name: '细珠叠链' },
  { id: 'nck_c8',   cat: 'necklace', rarity: 'common',    name: '小星星银链' },
  { id: 'nck_c9',   cat: 'necklace', rarity: 'common',    name: '心形细链' },
  { id: 'nck_c10',  cat: 'necklace', rarity: 'common',    name: '水滴银坠链' },
  { id: 'nck_c11',  cat: 'necklace', rarity: 'common',    name: '小金珠链' },

  { id: 'nck_r1',   cat: 'necklace', rarity: 'rare',      name: '海蓝泪坠' },
  { id: 'nck_r2',   cat: 'necklace', rarity: 'rare',      name: '四叶草颈链' },
  { id: 'nck_r3',   cat: 'necklace', rarity: 'rare',      name: '月光石坠' },
  { id: 'nck_r4',   cat: 'necklace', rarity: 'rare',      name: '蝴蝶银坠' },
  { id: 'nck_r5',   cat: 'necklace', rarity: 'rare',      name: '蔷薇花坠' },
  { id: 'nck_r6',   cat: 'necklace', rarity: 'rare',      name: '白贝母吊坠' },
  { id: 'nck_r7',   cat: 'necklace', rarity: 'rare',      name: '珍珠蝴蝶链' },
  { id: 'nck_r8',   cat: 'necklace', rarity: 'rare',      name: '星芒宝石坠' },

  { id: 'nck_e1',   cat: 'necklace', rarity: 'epic',      name: '银河碎钻' },
  { id: 'nck_e2',   cat: 'necklace', rarity: 'epic',      name: '天鹅湖坠链' },
  { id: 'nck_e3',   cat: 'necklace', rarity: 'epic',      name: '月桂星辉' },
  { id: 'nck_e4',   cat: 'necklace', rarity: 'epic',      name: '蔷薇星河' },

  { id: 'nck_l1',   cat: 'necklace', rarity: 'legendary', name: '心火红宝坠' },
  { id: 'nck_l2',   cat: 'necklace', rarity: 'legendary', name: '月神辉光' },

  { id: 'nck_x1',   cat: 'necklace', rarity: 'limited',   name: '深渊人鱼泪' },

//手链
  { id: 'brc_c1',   cat: 'bracelet', rarity: 'common',    name: '红绳编织链' },
  { id: 'brc_c2',   cat: 'bracelet', rarity: 'common',    name: '小银珠手链' },
  { id: 'brc_c3',   cat: 'bracelet', rarity: 'common',    name: '细银环手链' },
  { id: 'brc_c4',   cat: 'bracelet', rarity: 'common',    name: '双层细链' },
  { id: 'brc_c5',   cat: 'bracelet', rarity: 'common',    name: '小星银链' },
  { id: 'brc_c6',   cat: 'bracelet', rarity: 'common',    name: '月牙细链' },
  { id: 'brc_c7',   cat: 'bracelet', rarity: 'common',    name: '珍珠串珠链' },
  { id: 'brc_c8',   cat: 'bracelet', rarity: 'common',    name: '蝴蝶结细链' },
  { id: 'brc_c9',   cat: 'bracelet', rarity: 'common',    name: '银叶编织链' },
  { id: 'brc_c10',  cat: 'bracelet', rarity: 'common',    name: '小铃铛银链' },
  { id: 'brc_c11',  cat: 'bracelet', rarity: 'common',    name: '心形银链' },

  { id: 'brc_r1',   cat: 'bracelet', rarity: 'rare',      name: '粉晶招福链' },
  { id: 'brc_r2',   cat: 'bracelet', rarity: 'rare',      name: '铃兰垂坠链' },
  { id: 'brc_r3',   cat: 'bracelet', rarity: 'rare',      name: '月光石串链' },
  { id: 'brc_r4',   cat: 'bracelet', rarity: 'rare',      name: '蝴蝶流珠链' },
  { id: 'brc_r5',   cat: 'bracelet', rarity: 'rare',      name: '蔷薇缠枝链' },
  { id: 'brc_r6',   cat: 'bracelet', rarity: 'rare',      name: '贝母花瓣链' },
  { id: 'brc_r7',   cat: 'bracelet', rarity: 'rare',      name: '蓝晶水滴链' },
  { id: 'brc_r8',   cat: 'bracelet', rarity: 'rare',      name: '四叶幸运链' },

  { id: 'brc_e1',   cat: 'bracelet', rarity: 'epic',      name: '极光蛋白链' },
  { id: 'brc_e2',   cat: 'bracelet', rarity: 'epic',      name: '时之沙漏链' },
  { id: 'brc_e3',   cat: 'bracelet', rarity: 'epic',      name: '星河流光链' },
  { id: 'brc_e4',   cat: 'bracelet', rarity: 'epic',      name: '月桂秘银链' },

  { id: 'brc_l1',   cat: 'bracelet', rarity: 'legendary', name: '龙鳞鎏金链' },
  { id: 'brc_l2',   cat: 'bracelet', rarity: 'legendary', name: '圣白金铃链' },

  { id: 'brc_x1',   cat: 'bracelet', rarity: 'limited',   name: '永夜玫瑰链' },

//耳饰
  { id: 'ear_c1',   cat: 'earring', rarity: 'common',    name: '米粒珍珠钉' },
  { id: 'ear_c2',   cat: 'earring', rarity: 'common',    name: '几何银片坠' },
  { id: 'ear_c3',   cat: 'earring', rarity: 'common',    name: '细银圆环' },
  { id: 'ear_c4',   cat: 'earring', rarity: 'common',    name: '小星银钉' },
  { id: 'ear_c5',   cat: 'earring', rarity: 'common',    name: '月牙银坠' },
  { id: 'ear_c6',   cat: 'earring', rarity: 'common',    name: '小花银钉' },
  { id: 'ear_c7',   cat: 'earring', rarity: 'common',    name: '水滴银坠' },
  { id: 'ear_c8',   cat: 'earring', rarity: 'common',    name: '迷你蝴蝶钉' },
  { id: 'ear_c9',   cat: 'earring', rarity: 'common',    name: '银珠耳圈' },
  { id: 'ear_c10',  cat: 'earring', rarity: 'common',    name: '双珠细坠' },
  { id: 'ear_c11',  cat: 'earring', rarity: 'common',    name: '小叶银坠' },

  { id: 'ear_r1',   cat: 'earring', rarity: 'rare',      name: '星尘流苏坠' },
  { id: 'ear_r2',   cat: 'earring', rarity: 'rare',      name: '蝴蝶蓝宝坠' },
  { id: 'ear_r3',   cat: 'earring', rarity: 'rare',      name: '月光石耳坠' },
  { id: 'ear_r4',   cat: 'earring', rarity: 'rare',      name: '珍珠花瓣坠' },
  { id: 'ear_r5',   cat: 'earring', rarity: 'rare',      name: '蔷薇银枝坠' },
  { id: 'ear_r6',   cat: 'earring', rarity: 'rare',      name: '四叶宝石坠' },
  { id: 'ear_r7',   cat: 'earring', rarity: 'rare',      name: '蓝晶水滴坠' },
  { id: 'ear_r8',   cat: 'earring', rarity: 'rare',      name: '白贝母耳坠' },

  { id: 'ear_e1',   cat: 'earring', rarity: 'epic',      name: '极昼冰晶坠' },
  { id: 'ear_e2',   cat: 'earring', rarity: 'epic',      name: '黑天鹅羽坠' },
  { id: 'ear_e3',   cat: 'earring', rarity: 'epic',      name: '银河蝶影坠' },
  { id: 'ear_e4',   cat: 'earring', rarity: 'epic',      name: '月桂星辉坠' },

  { id: 'ear_l1',   cat: 'earring', rarity: 'legendary', name: '凤鸣金环' },
  { id: 'ear_l2',   cat: 'earring', rarity: 'legendary', name: '帝冠翡翠坠' },

  { id: 'ear_x1',   cat: 'earring', rarity: 'limited',   name: '晨曦之泪' },
]

export const designById = (id) => DESIGNS.find((d) => d.id === id)

// 盲盒机：统一每个盲盒定价 50，等级固定为 SSS 顶级神秘盲盒；slots 描述开出内容；wild 按 odds 掷品质
export const BOX_PRICE = 50
export const BOXES = {
  SSS: { key: 'SSS', name: '神秘盲盒', price: 50, desc: '1 普通 + 3 稀有 + 1 史诗 + 2 随机', slots: [ { rarity: 'common', n: 1 }, { rarity: 'rare', n: 3 }, { rarity: 'epic', n: 1 }, { rarity: 'wild', n: 2, odds: [ ['epic', 0.9], ['legendary', 0.1] ] } ] },
}
export const BOX_KEYS = ['SSS']
export const UNLOCK_GRANT = 10 // 新款式解锁时一次入库数量

// 硬币：对对碰（同色成对）且为今日幸运色时触发增效；订单色币每枚多拆一袋
// 包含小隐藏（加拆1袋）与大隐藏（自选款式）
export const COINS = {
  red:      { key: 'red',      name: '红', hex: '#FF5A5A', type: 'moneyMult', val: 0.10, pair: '本单收入 +10%' },
  gold:     { key: 'gold',     name: '金', hex: '#FFD98E', type: 'fans',      val: 5,    pair: '粉丝 +5' },
  blue:     { key: 'blue',     name: '蓝', hex: '#5AA9FF', type: 'heat',      val: 1,    pair: '热度 +1' },
  purple:   { key: 'purple',   name: '紫', hex: '#C77DFF', type: 'fans',      val: 2,    pair: '粉丝 +2' },
  green:    { key: 'green',    name: '绿', hex: '#7DE2D1', type: 'moneyMult', val: 0.05, pair: '本单收入 +5%' },
  secret_s: { key: 'secret_s', name: '秘', hex: '#C2D1E5', type: 'addBag',    val: 1,    pair: '小隐藏 · 加拆1袋', isSecret: 'small' },
  secret_b: { key: 'secret_b', name: '幻', hex: '#FF5EC8', type: 'pickStyle', val: 1,    pair: '大隐藏 · 自选款式', isSecret: 'big' },
}
export const COIN_KEYS = Object.keys(COINS)
export const STANDARD_COIN_KEYS = ['red', 'gold', 'blue', 'purple', 'green']

// 动态获取硬币对碰数值与类型：支持直接修改 pair 文本（如 "本单收入 +25%"、"粉丝 +10"），也支持直接修改 val
export function getCoinPairEffect(coinKey) {
  const c = COINS[coinKey]
  if (!c) return { type: 'none', val: 0 }
  if (c.type === 'addBag' || c.key === 'secret_s') return { type: 'addBag', val: 1 }
  if (c.type === 'pickStyle' || c.key === 'secret_b') return { type: 'pickStyle', val: 1 }
  const text = c.pair || ''

  // 1. 检查百分比加成（如 "本单收入 +15%"）
  const pctMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*%/)
  if (pctMatch) {
    return { type: 'moneyMult', val: parseFloat(pctMatch[1]) / 100 }
  }

  // 2. 检查热度加成（如 "热度 +3"）
  if (text.includes('热度') || c.type === 'heat') {
    const m = text.match(/([0-9]+)/)
    return { type: 'heat', val: m ? parseInt(m[1], 10) : (c.val ?? 1) }
  }

  // 3. 检查粉丝加成（如 "粉丝 +10"）
  if (text.includes('粉丝') || c.type === 'fans') {
    const m = text.match(/([0-9]+)/)
    return { type: 'fans', val: m ? parseInt(m[1], 10) : (c.val ?? 2) }
  }

  return { type: c.type || 'none', val: c.val || 0 }
}

// 粉丝等级：orders=订单数区间，bags=每单袋数区间（下限 4），cap=单场订单袋数上限，fanMult=粉丝成长倍率
export const TIERS = [
  { key: 'rookie', name: '新人主播', fans: 100,    orders: [1, 3],  bags: [4, 6], cap: 50,  fanMult: 1 },
  { key: 'small',  name: '小主播',   fans: 1000,   orders: [3, 5],  bags: [4, 7], cap: 100, fanMult: 2 },
  { key: 'waist',  name: '腰部主播', fans: 10000,  orders: [5, 8],  bags: [4, 8], cap: 150, fanMult: 4 },
  { key: 'big',    name: '大主播',   fans: 100000, orders: [8, 10], bags: [4, 9], cap: 200, fanMult: 7 },
]
export function tierOf(fans) {
  let t = TIERS[0]
  for (const x of TIERS) if (fans >= x.fans) t = x
  return t
}
export function nextTier(fans) {
  return TIERS.find((t) => t.fans > fans) || null
}

// 宝石市场（腰部主播解锁）
export const GEMS = [
  { key: 'ruby',     name: '红宝石', hex: '#FF5A5A' },
  { key: 'sapphire', name: '蓝宝石', hex: '#5AA9FF' },
  { key: 'emerald',  name: '翡翠',   hex: '#7DE2D1' },
  { key: 'diamond',  name: '钻石',   hex: '#F5EFE6' },
  { key: 'catseye',  name: '猫眼石', hex: '#FFD98E' },
]
export const GEM_PRICE_MIN = 200
export const GEM_PRICE_MAX = 800
export const GEM_MARKET_SIZE = 3
export const LIMITED_ORDER_BASE = 300   // 限定专场订单基础价
export const LIMITED_FAN_BONUS = 50     // 售出限定饰品粉丝奖励
export const GEM_MARKET_FANS = 10000    // 宝石市场解锁粉丝数
export const ENABLE_GEM_CHANNEL = false // 暂时关闭宝石通道

// 订单定价：15 + 初始盲袋数×3，命中风向 ×1.5，幸运红/绿币对碰分别 +10%/+5%
export const ORDER_BASE = 15
export const ORDER_PER_BAG = 3 // 按订单初始袋数计
export const TREND_MULT = 1.5

// 直播规则：每天可开播场次；每单开袋保底（不足时一袋一袋加拆）
export const STREAMS_PER_DAY = 3
export const GUARANTEE_MIN = 8

// 直播热度：初始热度 = 粉丝数 ×15%，每拆一袋 +1；当场热度 > 粉丝数 → 总粉丝 +1%
export const HEAT_START_RATE = 0.15
export const HEAT_FAN_BONUS = 0.01

// 观众评价
export const EVAL_LEVELS = [
  { min: 11,  name: '全场爆满', mult: 1.3, stars: 5, comments: ['今天这间直播间我愿称之为神！', '已下单三单，钱包已阵亡', '主播手气也太好了吧，关注了！'] },
  { min: 6,   name: '观众满意', mult: 1.1, stars: 4, comments: ['拆袋过程很上头，明天还来', '对对碰那下我直接站起来了', '饰品成色不错，值回票价'] },
  { min: 2,   name: '反应平平', mult: 1.0, stars: 3, comments: ['还行吧，希望明天上点新款式', '运气一般，隔壁直播间更欧', '袋子有点少，没抢到想要的'] },
  { min: -99, name: '有点翻车', mult: 0.6, stars: 2, comments: ['缺货算怎么回事？取关了', '就这？我等了半小时', '今天风向都没看就开播？'] },
]

// 风向播报文案
export const TREND_LINES = {
  ring:     '今天戒指卖爆了，姐妹们都在求戒指盲袋！',
  necklace: '项链是今天的顶流，锁骨链话题度拉满！',
  bracelet: '手链热度飙升，编绳款被抢疯了！',
  earring:  '今天耳环是流量密码，耳饰控集体出动！',
}

// 弹幕池
export const DANMAKU = {
  enter:   ['来了来了！', '主播晚上好~', '今天拆什么？', '前排围观！', '钱包已就位'],
  order:   ['新订单来了！', '这单我要看！', '冲冲冲！', '接单接单！'],
  lucky:   ['幸运色！多拆一袋！', '欧气满满！', '这波血赚！'],
  pair:    ['对对碰！！', '碰一碰！', '主播手气无敌！', '又碰上了！'],
  epic:    ['史诗！！', '出金了！', '这袋子有毒吧！', '羡慕住了'],
  legendary: ['传说！！！', '全网第一欧！', '我也要抽这个！', '主播嫁我！'],
  stockout:['缺货了？就这？', '备货不足啊主播', '下播去补货吧'],
  secret_s:['出小隐藏了！多加一袋！', '小隐藏！！欧气爆表！', '加拆加拆！老板大气！', '吸吸小隐藏欧气！'],
  secret_b:['全场起立！！大隐藏降临！', '出大隐藏了！', '单主快选款！！羡慕哭了', '天选单主！大隐藏绝杀！'],
  limited: ['限定！限定！', '这个必须冲！', '绝版好嘛，买！'],
  generic: ['好看好看', '已拍已拍', '求上项链！', '硬币是什么颜色？', '主播加油！', '蹲一个传说'],
}