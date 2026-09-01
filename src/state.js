// 游戏状态：可序列化单例 + setState/subscribe。直播中的临时会话不入档（见 engine.js）。
import { CAT_KEYS, STREAMS_PER_DAY } from './data.js'

const subs = new Set()
let state = null

export function freshState() {
  return {
    day: 1,
    money: 1000,
    fans: 100,
    trend: { cat: 'ring', lucky: 'red', style: null }, // 每日风向：流行品类 + 幸运色 + 指定款式（可为空）
    streamsLeft: STREAMS_PER_DAY, // 今日剩余开播场次
    stock: {},        // designId -> 库存数量
    codex: [],        // 已解锁款式 id
    codexBonus: [],   // 已发放整类集齐奖励的品类
    packed: {},       // cat -> [{ a: designId, c: coinKey }] 已装袋待售
    vault: [],        // 限定饰品 { uid, designId, gem, price }
    gems: [],         // 待镶嵌宝石 { gem, price }
    shop: [],         // 今日商店盲盒 { cat, tier, sold }（每天随机刷新）
    stats: null,      // 当日直播统计（跨场次累计，nextDay 清空）
    screen: 'intro',  // intro | day | live | settle
    dayTab: 'shop',   // 日间页签：shop | pack | codex | gem
    muted: false,
  }
}

export function initStore(initial) {
  state = initial
  subs.forEach((fn) => fn(state))
  return state
}

export function getState() {
  return state
}

export function setState(patch) {
  state = typeof patch === 'function' ? patch(state) : { ...state, ...patch }
  subs.forEach((fn) => fn(state))
  return state
}

export function subscribe(fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}

// 供存档使用的纯数据切片（去掉界面态）
export function snapshot(s = state) {
  const { screen, dayTab, ...rest } = s
  return JSON.parse(JSON.stringify(rest))
}

// 空统计（每天第一场开播时重置，跨场次累计）
export function freshStats() {
  return {
    earn: 0, earnBase: 0, earnBuff: 0,
    ordersDone: 0, bagsSold: 0, pairs: 0, luckyHits: 0,
    trendHits: 0, stockouts: 0, epicsPulled: 0, limitedSold: 0, evalBonus: 0,
    fansToday: 0, settledFans: 0, heatBonus: 0, bestPull: null, // bestPull: {rarity, name}
  }
}
