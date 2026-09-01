// 游戏引擎：开盒、装袋、直播订单与对对碰、下播结算。纯规则层，不碰 DOM。
import {
  DESIGNS, RARITIES, BOXES, BOX_KEYS, COIN_KEYS, CAT_KEYS,
  tierOf, GEMS, GEM_PRICE_MIN, GEM_PRICE_MAX, GEM_MARKET_SIZE,
  LIMITED_ORDER_BASE, LIMITED_FAN_BONUS, ORDER_BASE, ORDER_PER_BAG,
  TREND_MULT, EVAL_LEVELS, UNLOCK_GRANT, designById,
  STREAMS_PER_DAY, LUCKY_BUFF_BY_COLOR,
} from './data.js'
import { freshStats } from './state.js'

const rand = (n) => Math.floor(Math.random() * n)
const randInt = (a, b) => a + rand(b - a + 1)
const pick = (arr) => arr[rand(arr.length)]

// ---------- 工具 ----------

export function designsOf(cat, rarity) {
  return DESIGNS.filter((d) => d.cat === cat && d.rarity === rarity)
}

function rollRarity(odds) {
  let r = Math.random()
  for (const [key, p] of odds) {
    r -= p
    if (r < 0) return key
  }
  return odds[odds.length - 1][0]
}

// ---------- 开盲盒 ----------

// 开一箱某品类的盲盒；返回 { ok, cost, items }，items: [{ design, isNew, grant }]
export function rollBox(s, cat, tierKey) {
  const box = BOXES[tierKey]
  if (s.money < box.price) return { ok: false, reason: 'money' }
  s.money -= box.price
  const items = []
  for (const slot of box.slots) {
    for (let i = 0; i < slot.n; i++) {
      const rarity = slot.rarity === 'wild' ? rollRarity(slot.odds) : slot.rarity
      const pool = designsOf(cat, rarity)
      const design = pick(pool)
      const isNew = !s.codex.includes(design.id)
      if (isNew) {
        s.codex.push(design.id)
        s.stock[design.id] = (s.stock[design.id] || 0) + UNLOCK_GRANT
      } else {
        s.stock[design.id] = (s.stock[design.id] || 0) + RARITIES[rarity].restock
      }
      items.push({ design, isNew, grant: isNew ? UNLOCK_GRANT : RARITIES[rarity].restock })
    }
  }
  checkCodexBonus(s, cat)
  return { ok: true, cost: box.price, items }
}

// 整类图鉴集齐（限定除外）奖励
function checkCodexBonus(s, cat) {
  if (s.codexBonus.includes(cat)) return
  const all = DESIGNS.filter((d) => d.cat === cat && d.rarity !== 'limited')
  if (all.every((d) => s.codex.includes(d.id))) {
    s.codexBonus.push(cat)
    s.money += 300
    s.fans += 100
  }
}

// 商店单件补货
export function buyStock(s, designId, n = 1) {
  const d = designById(designId)
  const price = RARITIES[d.rarity].unitPrice * n
  if (s.money < price) return { ok: false, reason: 'money' }
  s.money -= price
  s.stock[designId] = (s.stock[designId] || 0) + n
  return { ok: true, cost: price }
}

// ---------- 装袋 ----------

// picks: designId 数组（袋内饰品顺序）；coinCounts: { coinKey: 数量 }，总和须等于袋数
export function packBags(s, cat, picks, coinCounts) {
  const total = picks.length
  if (total === 0) return { ok: false, reason: 'empty' }
  // 库存校验
  const need = {}
  for (const id of picks) need[id] = (need[id] || 0) + 1
  for (const [id, n] of Object.entries(need)) {
    if ((s.stock[id] || 0) < n) return { ok: false, reason: 'stock', designId: id }
  }
  // 硬币校验：总数一致即可（不设单色上限，同色越多对对碰越猛）
  let coinSum = 0
  for (const k of COIN_KEYS) coinSum += coinCounts[k] || 0
  if (coinSum !== total) return { ok: false, reason: 'coinSum' }
  // 扣库存
  for (const [id, n] of Object.entries(need)) s.stock[id] -= n
  // 硬币随机分配到袋
  const coinBag = []
  for (const k of COIN_KEYS) for (let i = 0; i < (coinCounts[k] || 0); i++) coinBag.push(k)
  for (let i = coinBag.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[coinBag[i], coinBag[j]] = [coinBag[j], coinBag[i]]
  }
  const bags = picks.map((id, i) => ({ a: id, c: coinBag[i] }))
  s.packed[cat] = [...(s.packed[cat] || []), ...bags]
  return { ok: true }
}

// 撤销某品类全部已装袋，饰品回库存
export function unpackCategory(s, cat) {
  for (const bag of s.packed[cat] || []) {
    s.stock[bag.a] = (s.stock[bag.a] || 0) + 1
  }
  s.packed[cat] = []
}

// 自动配货：从库存按品质从高到低轮流取
export function autoPick(s, cat, n) {
  const pool = []
  for (const d of DESIGNS) {
    if (d.cat !== cat) continue
    const cnt = s.stock[d.id] || 0
    for (let i = 0; i < cnt; i++) pool.push(d.id)
  }
  const order = ['legendary', 'epic', 'rare', 'common']
  pool.sort((a, b) => {
    const ra = RARITIES[designById(a).rarity], rb = RARITIES[designById(b).rarity]
    return order.indexOf(ra.key) - order.indexOf(rb.key)
  })
  return pool.slice(0, n)
}

// ---------- 直播 ----------

// 生成整场直播的订单计划：品类纯随机（从有货品类中抽），保底一单为当日风向品类
export function planStream(s) {
  const tier = tierOf(s.fans)
  const orders = []
  // 限定专场：有库存限定饰品时，作为第一单
  if (s.vault.length > 0) {
    orders.push({ type: 'limited', item: s.vault[0] })
  }
  const stocked = CAT_KEYS.filter((k) => (s.packed[k] || []).length > 0)
  if (stocked.length === 0) return orders
  let capLeft = tier.cap
  const count = randInt(tier.orders[0], tier.orders[1])
  let trendDone = false // 风向保底单
  for (let i = 0; i < count && capLeft > 0; i++) {
    let cat
    if (!trendDone && (s.packed[s.trend.cat] || []).length > 0) {
      cat = s.trend.cat
      trendDone = true
    } else {
      cat = pick(stocked)
    }
    const size = Math.min(randInt(tier.bags[0], tier.bags[1]), capLeft, (s.packed[cat] || []).length + 3)
    if (size <= 0) continue
    capLeft -= size
    // 订单幸运色每单随机（可与今日幸运色相同）
    orders.push({ type: 'bags', cat, size, lucky: pick(COIN_KEYS) })
  }
  return orders
}

// 每单的拆袋会话（临时态，不入档）
export function newOrderSession(order) {
  return {
    queue: order.type === 'bags' ? order.size : 0,
    tally: {},          // 本单内各色硬币计数（拆完后统一对碰）
    redMult: 0,         // 红币对碰累计加价
    greenMult: 0,       // 绿币对碰累计本单收入加成
    dailyRev: 0,        // 今日幸运色 buff 累计营收加成
    styleFans: 0,       // 风向指定款式拆中数（每件粉丝 +1）
    opened: [],         // 已拆 { design, coin, slot: 'order'|'bonus'|'stockout' }
    buffs: [],          // 本单触发的 buff（供展示）
    pairs: 0, luckyHits: 0, stockouts: 0,
    goldFans: 0, evalScore: 0,
    done: false,
  }
}

// 拆一袋：返回事件 { slot, design?, coin?, bonus, luckyHit, dailyBuff?, styleHit? }；硬币只记账，对碰由 resolvePairs 统一结算
export function openBag(s, order, ctx) {
  if (ctx.done || ctx.queue <= 0) return null
  ctx.queue--
  const isBonus = ctx.opened.length >= order.size
  const bags = s.packed[order.cat] || []
  if (bags.length === 0) {
    // 缺货：奖励袋静默消失，正式袋记缺货
    if (!isBonus) {
      ctx.stockouts++
      ctx.opened.push({ slot: 'stockout' })
      return { slot: 'stockout' }
    }
    return { slot: 'void' }
  }
  const bag = bags.shift()
  const design = designById(bag.a)
  const coin = bag.c
  ctx.opened.push({ slot: isBonus ? 'bonus' : 'order', design, coin })
  const ev = { slot: isBonus ? 'bonus' : 'order', design, coin, bonus: isBonus, luckyHit: false, dailyBuff: null }

  // 稀有度统计（评价分只算紫币加成，史诗/传说单独计数）
  if (design.rarity === 'epic' || design.rarity === 'legendary') {
    if (!s.stats.bestPull || RARITIES[design.rarity].bonus > RARITIES[s.stats.bestPull.rarity].bonus) {
      s.stats.bestPull = { rarity: design.rarity, name: design.name }
    }
    s.stats.epicsPulled++
  }

  // 风向指定款式：拆中一件粉丝 +1
  if (s.trend.style && design.id === s.trend.style) {
    ctx.styleFans = (ctx.styleFans || 0) + 1
    ev.styleHit = true
  }

  // 幸运色：订单加一袋
  if (coin === order.lucky) {
    ctx.luckyHits++
    ctx.queue++
    ev.luckyHit = true
  }

  // 今日幸运色：触发该颜色专属 buff（与订单幸运色可同色，两者都触发）
  if (coin === s.trend.lucky) {
    const buff = LUCKY_BUFF_BY_COLOR[coin]
    ev.dailyBuff = buff
    ctx.buffs.push(buff)
    if (buff.key === 'rev') ctx.dailyRev += 0.3
    else if (buff.key === 'fan') ctx.goldFans += 30
    else if (buff.key === 'bag') ctx.queue++
    else if (buff.key === 'eval') ctx.evalScore += 2
    // key === 'heat' 的热度 buff 由界面处理（热度是场次临时态）
  }

  // 硬币只记账，对对碰延后到拆完全部队列统一结算（见 resolvePairs）
  ctx.tally[coin] = (ctx.tally[coin] || 0) + 1
  return ev
}

// 拆完全部队列后统一结算对对碰：所有颜色同时配对、不限对数；返回本次成对的颜色序列（供 UI 淡出），加袋写回 ctx.queue
export function resolvePairs(order, ctx) {
  const paired = []
  let guard = 0
  while (guard++ < 1000) {
    let hit = false
    for (const k of COIN_KEYS) {
      const n = ctx.tally[k] || 0
      if (n >= 2) {
        ctx.tally[k] = n - 2
        ctx.pairs++
        ctx.queue++ // 每对统一加拆一袋
        switch (k) {
          case 'red': ctx.redMult += 0.15; break
          case 'gold': ctx.goldFans += 8; break
          case 'purple': ctx.goldFans += 2; break
          case 'green': ctx.greenMult += 0.05; break
          // blue：热度由界面处理（热度是场次临时态）
        }
        paired.push(k)
        hit = true
      }
    }
    if (!hit) break
  }
  return paired
}

// 完成订单：结算价格与粉丝
export function finishOrder(s, order, ctx) {
  ctx.done = true
  if (order.type === 'limited') {
    const price = order.item.price
    s.money += price
    s.fans += LIMITED_FAN_BONUS
    s.vault.shift()
    s.stats.earn += price
    s.stats.earnBase = (s.stats.earnBase || 0) + price
    s.stats.limitedSold++
    s.stats.ordersDone++
    s.stats.fansToday += LIMITED_FAN_BONUS
    s.stats.bestPull = s.stats.bestPull || { rarity: 'limited', name: designById(order.item.designId).name }
    return { price, fans: LIMITED_FAN_BONUS }
  }
  const nBags = order.size // 初始盲袋数量（不含对碰加拆）
  const trendHit = order.cat === s.trend.cat
  if (trendHit) s.stats.trendHits++
  // 原本金额 = (10 + 初始袋数×2) × 风向品类加成 × 红币对碰
  const rawBase = (ORDER_BASE + nBags * ORDER_PER_BAG) * (trendHit ? TREND_MULT : 1) * (1 + ctx.redMult + ctx.greenMult)
  const base = Math.round(rawBase)
  const price = Math.round(rawBase * (1 + ctx.dailyRev))
  const fans = Math.round((5 + ctx.opened.filter((o) => o.design).length * 2 + ctx.pairs * 5) * tierOf(s.fans).fanMult) + ctx.goldFans + (ctx.styleFans || 0)
  s.money += price
  s.fans += fans
  s.stats.earn += price
  s.stats.earnBase = (s.stats.earnBase || 0) + base
  s.stats.earnBuff = (s.stats.earnBuff || 0) + (price - base)
  s.stats.ordersDone++
  s.stats.bagsSold += nBags
  s.stats.evalBonus = (s.stats.evalBonus || 0) + ctx.evalScore
  s.stats.pairs += ctx.pairs
  s.stats.luckyHits += ctx.luckyHits
  s.stats.stockouts += ctx.stockouts
  s.stats.fansToday += fans
  return { price, fans, trendHit, base, buffPart: price - base }
}

// ---------- 宝石市场 ----------

export function rollGemMarket(s) {
  s.gems = []
  for (let i = 0; i < GEM_MARKET_SIZE; i++) {
    const g = pick(GEMS)
    s.gems.push({ gem: g.key, price: randInt(GEM_PRICE_MIN, GEM_PRICE_MAX) })
  }
}

export function buyGem(s, idx) {
  const offer = s.gems[idx]
  if (!offer || s.money < offer.price) return { ok: false, reason: 'money' }
  s.money -= offer.price
  s.gems.splice(idx, 1)
  s.gems.push({ gem: pick(GEMS).key, price: randInt(GEM_PRICE_MIN, GEM_PRICE_MAX) })
  return { ok: true, gem: offer }
}

// 镶嵌：宝石 + 同品类任意已解锁款式 -> 限定饰品（直接入 vault 上架直播间）
export function craftLimited(s, gemIdx, designId) {
  const offer = s.gems[gemIdx]
  const d = designById(designId)
  if (!offer || !d || d.rarity === 'limited') return { ok: false, reason: 'bad' }
  s.gems.splice(gemIdx, 1)
  if (!s.codex.includes(d.id)) s.codex.push(d.id)
  const price = LIMITED_ORDER_BASE + offer.price * 2
  s.vault.push({ uid: `L${Date.now()}${rand(999)}`, designId: d.id, gem: offer.gem, price })
  checkCodexBonus(s, d.cat)
  return { ok: true, price }
}

// ---------- 结算与日循环 ----------

export function evalOf(score) {
  return EVAL_LEVELS.find((l) => score >= l.min)
}

// 下播结算：好评加成只按上次结算后的涨粉增量计算；isLastStream 时才做救济
export function settleDay(s, { isLastStream = false } = {}) {
  const score = s.stats.trendHits * 2 + s.stats.pairs + s.stats.epicsPulled + s.stats.evalBonus + s.stats.limitedSold * 2 - s.stats.stockouts * 2
  const level = evalOf(score)
  const delta = s.stats.fansToday - (s.stats.settledFans || 0)
  const fanBonus = Math.round(delta * (level.mult - 1))
  s.fans += fanBonus
  s.stats.settledFans = s.stats.fansToday
  let mercy = false
  if (isLastStream && s.money < BOXES.S.price && totalStockAll(s) === 0) {
    s.money += 150
    mercy = true
  }
  return { score, level, fanBonus, mercy }
}

function totalStockAll(s) {
  let n = 0
  for (const k of CAT_KEYS) n += (s.packed[k] || []).length
  for (const v of Object.values(s.stock)) n += v
  return n
}

// 进入下一天：日期+1、重掷风向（固定带款式）与商店/宝石市场、恢复场次、清空当日统计
export function nextDay(s) {
  s.day++
  const cat = pick(CAT_KEYS)
  s.trend = { cat, lucky: pick(COIN_KEYS), style: rollTrendStyle(s, cat) }
  s.streamsLeft = STREAMS_PER_DAY
  s.stats = null
  s.shop = rollShop(s)
  rollGemMarket(s)
}

// 风向固定指定一款该品类款式（全库可选，未解锁的作为「目标款式」展示）
export function rollTrendStyle(s, cat) {
  const pool = DESIGNS.filter((d) => d.cat === cat && d.rarity !== 'limited')
  return pool.length > 0 ? pick(pool).id : null
}

// 每日商店：随机 5 盒盲盒（保底 2 盒风向品类），买完即售罄
export function rollShop(s) {
  const offers = []
  for (let i = 0; i < 2; i++) offers.push({ cat: s.trend.cat, tier: pick(BOX_KEYS), sold: false })
  for (let i = 0; i < 3; i++) offers.push({ cat: pick(CAT_KEYS), tier: pick(BOX_KEYS), sold: false })
  return offers
}

export { freshStats }
