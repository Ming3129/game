// 数据层：饰品图鉴、盲盒档位、硬币、粉丝等级、宝石市场等静态配置。

// 品质：restock=重复开出补货数；bonus=订单中每袋加价；unitPrice=商店单件补货价
export const RARITIES = {
  common:    { key: 'common',    name: '普通', color: '#9AA3B2', restock: 5, bonus: 0,  unitPrice: 6   },
  rare:      { key: 'rare',      name: '稀有', color: '#7DE2D1', restock: 3, bonus: 12, unitPrice: 15  },
  epic:      { key: 'epic',      name: '史诗', color: '#C77DFF', restock: 2, bonus: 30, unitPrice: 40  },
  legendary: { key: 'legendary', name: '传说', color: '#FFD98E', restock: 1, bonus: 80, unitPrice: 100 },
  limited:   { key: 'limited',   name: '限定', color: '#FF7EB6', restock: 0, bonus: 0,  unitPrice: 0   },
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
  { id: 'ring_c1',  cat: 'ring',     rarity: 'common',    name: '素圈银戒' },
  { id: 'ring_c2',  cat: 'ring',     rarity: 'common',    name: '贝母方戒' },
  { id: 'ring_r1',  cat: 'ring',     rarity: 'rare',      name: '月光石戒' },
  { id: 'ring_r2',  cat: 'ring',     rarity: 'rare',      name: '藤蔓缠指' },
  { id: 'ring_e1',  cat: 'ring',     rarity: 'epic',      name: '蔷薇荆棘' },
  { id: 'ring_e2',  cat: 'ring',     rarity: 'epic',      name: '星轨密镶' },
  { id: 'ring_l1',  cat: 'ring',     rarity: 'legendary', name: '泪滴蓝宝' },
  { id: 'ring_l2',  cat: 'ring',     rarity: 'legendary', name: '凰羽鎏金' },
  { id: 'ring_x1',  cat: 'ring',     rarity: 'limited',   name: '绯樱魔晶戒' },

  { id: 'nck_c1',   cat: 'necklace', rarity: 'common',    name: '珍珠锁骨链' },
  { id: 'nck_c2',   cat: 'necklace', rarity: 'common',    name: '细银十字链' },
  { id: 'nck_r1',   cat: 'necklace', rarity: 'rare',      name: '海蓝泪坠' },
  { id: 'nck_r2',   cat: 'necklace', rarity: 'rare',      name: '四叶草颈链' },
  { id: 'nck_e1',   cat: 'necklace', rarity: 'epic',      name: '银河碎钻' },
  { id: 'nck_e2',   cat: 'necklace', rarity: 'epic',      name: '天鹅湖坠链' },
  { id: 'nck_l1',   cat: 'necklace', rarity: 'legendary', name: '心火红宝坠' },
  { id: 'nck_l2',   cat: 'necklace', rarity: 'legendary', name: '月神辉光' },
  { id: 'nck_x1',   cat: 'necklace', rarity: 'limited',   name: '深渊人鱼泪' },

  { id: 'brc_c1',   cat: 'bracelet', rarity: 'common',    name: '红绳编织链' },
  { id: 'brc_c2',   cat: 'bracelet', rarity: 'common',    name: '小银珠手链' },
  { id: 'brc_r1',   cat: 'bracelet', rarity: 'rare',      name: '粉晶招福链' },
  { id: 'brc_r2',   cat: 'bracelet', rarity: 'rare',      name: '铃兰垂坠链' },
  { id: 'brc_e1',   cat: 'bracelet', rarity: 'epic',      name: '极光蛋白链' },
  { id: 'brc_e2',   cat: 'bracelet', rarity: 'epic',      name: '时之沙漏链' },
  { id: 'brc_l1',   cat: 'bracelet', rarity: 'legendary', name: '龙鳞鎏金链' },
  { id: 'brc_l2',   cat: 'bracelet', rarity: 'legendary', name: '圣白金铃链' },
  { id: 'brc_x1',   cat: 'bracelet', rarity: 'limited',   name: '永夜玫瑰链' },

  { id: 'ear_c1',   cat: 'earring',  rarity: 'common',    name: '米粒珍珠钉' },
  { id: 'ear_c2',   cat: 'earring',  rarity: 'common',    name: '几何银片坠' },
  { id: 'ear_r1',   cat: 'earring',  rarity: 'rare',      name: '星尘流苏坠' },
  { id: 'ear_r2',   cat: 'earring',  rarity: 'rare',      name: '蝴蝶蓝宝坠' },
  { id: 'ear_e1',   cat: 'earring',  rarity: 'epic',      name: '极昼冰晶坠' },
  { id: 'ear_e2',   cat: 'earring',  rarity: 'epic',      name: '黑天鹅羽坠' },
  { id: 'ear_l1',   cat: 'earring',  rarity: 'legendary', name: '凤鸣金环' },
  { id: 'ear_l2',   cat: 'earring',  rarity: 'legendary', name: '帝冠翡翠坠' },
  { id: 'ear_x1',   cat: 'earring',  rarity: 'limited',   name: '晨曦之泪' },
]

export const designById = (id) => DESIGNS.find((d) => d.id === id)

// 盲盒档位：slots 描述开出内容；wild 按 odds 掷品质
export const BOXES = {
  S:   { key: 'S',   name: 'S 盲盒',   price: 80,  desc: '1 普通 + 1 稀有', slots: [ { rarity: 'common', n: 1 }, { rarity: 'rare', n: 1 } ] },
  SS:  { key: 'SS',  name: 'SS 盲盒',  price: 180, desc: '1 普通 + 2 稀有 + 1 惊喜', slots: [ { rarity: 'common', n: 1 }, { rarity: 'rare', n: 2 }, { rarity: 'wild', n: 1, odds: [ ['rare', 0.9], ['epic', 0.1] ] } ] },
  SSS: { key: 'SSS', name: 'SSS 盲盒', price: 360, desc: '1 普通 + 3 稀有 + 1 史诗 + 1 大惊喜', slots: [ { rarity: 'common', n: 1 }, { rarity: 'rare', n: 3 }, { rarity: 'epic', n: 1 }, { rarity: 'wild', n: 1, odds: [ ['epic', 0.7], ['legendary', 0.3] ] } ] },
}
export const BOX_KEYS = ['S', 'SS', 'SSS']
export const UNLOCK_GRANT = 10 // 新款式解锁时一次入库数量

// 硬币：对对碰（同色成对）触发的增效；幸运色币每枚多拆一袋
export const COINS = {
  red:    { key: 'red',    name: '红', hex: '#FF5A5A', pair: '本单收入 +15%' },
  gold:   { key: 'gold',   name: '金', hex: '#FFD98E', pair: '粉丝 +8' },
  blue:   { key: 'blue',   name: '蓝', hex: '#5AA9FF', pair: '热度 +1' },
  purple: { key: 'purple', name: '紫', hex: '#C77DFF', pair: '粉丝 +2' },
  green:  { key: 'green',  name: '绿', hex: '#7DE2D1', pair: '本单收入 +5%' },
}
export const COIN_KEYS = Object.keys(COINS)

// 粉丝等级：orders=订单数区间，bags=每单袋数区间（下限 4），cap=单场订单袋数上限，fanMult=粉丝成长倍率
export const TIERS = [
  { key: 'rookie', name: '新人主播', fans: 100,    orders: [1, 3],  bags: [4, 6], cap: 50,  fanMult: 2 },
  { key: 'small',  name: '小主播',   fans: 1000,   orders: [3, 5],  bags: [4, 7], cap: 100, fanMult: 6 },
  { key: 'waist',  name: '腰部主播', fans: 10000,  orders: [5, 8],  bags: [4, 8], cap: 150, fanMult: 15 },
  { key: 'big',    name: '大主播',   fans: 100000, orders: [8, 10], bags: [4, 9], cap: 200, fanMult: 40 },
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

// 订单定价：10 + 初始盲袋数×2，命中风向 ×1.5，红币对碰每对 +15%，今日幸运营收 buff 叠乘
export const ORDER_BASE = 10
export const ORDER_PER_BAG = 2 // 按订单初始袋数计
export const TREND_MULT = 1.5

// 直播规则：每天可开播场次；每单开袋保底（不足时一袋一袋加拆）
export const STREAMS_PER_DAY = 3
export const GUARANTEE_MIN = 8

// 拆到「今日幸运色」触发该颜色专属 buff：不同颜色不同效果
export const LUCKY_BUFF_BY_COLOR = {
  red:    { key: 'rev',  name: '人气爆棚', desc: '本单营收 +30%' },
  gold:   { key: 'fan',  name: '圈粉时刻', desc: '粉丝 +30' },
  blue:   { key: 'bag',  name: '加量装袋', desc: '多拆一袋' },
  purple: { key: 'eval', name: '好评如潮', desc: '评价 +2' },
  green:  { key: 'heat', name: '气氛火热', desc: '热度 +10' },
}

// 直播热度：初始热度 = 粉丝数 ×15%，每拆一袋 +1；当场热度 > 粉丝数 → 总粉丝 +5%
export const HEAT_START_RATE = 0.15
export const HEAT_FAN_BONUS = 0.05

// 观众评价
export const EVAL_LEVELS = [
  { min: 11,  name: '全场爆满', mult: 1.8, stars: 5, comments: ['今天这间直播间我愿称之为神！', '已下单三单，钱包已阵亡', '主播手气也太好了吧，关注了！'] },
  { min: 6,   name: '观众满意', mult: 1.3, stars: 4, comments: ['拆袋过程很上头，明天还来', '对对碰那下我直接站起来了', '饰品成色不错，值回票价'] },
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
  pair:    ['对对碰！！', '硬币成对了！', '主播手气无敌！', '又碰上了！'],
  epic:    ['史诗！！', '卧槽，出金了！', '这袋子有毒吧！', '羡慕住了'],
  legendary: ['传说！！！', '全网第一欧！', '我也要抽这个！', '主播嫁我！'],
  stockout:['缺货了？就这？', '备货不足啊主播', '下播去补货吧'],
  limited: ['限定！限定！', '这个必须冲！', '绝版好嘛，买！'],
  generic: ['好看好看', '已拍已拍', '求上项链！', '硬币是什么颜色？', '主播加油！', '蹲一个传说'],
}