// 入口：连接平台 SDK，读档或开新档，挂载界面。
import { initStore, freshState, getState, snapshot } from './state.js'
import { bindSdk, load, saveNow } from './save.js'
import { rollGemMarket, rollShop, rollTrendStyle } from './engine.js'
import { mount } from './ui.js'
import { setMuted } from './fx.js'
import { STREAMS_PER_DAY } from './data.js'

// 旧档迁移：补齐新版本字段、修正越界/非有限数值，避免 undefined 参与运算产生 NaN
function migrate(s) {
  const finite = (v, fb) => (Number.isFinite(v) ? v : fb)
  s.money = finite(s.money, 1000)
  s.fans = finite(s.fans, 100)
  s.day = finite(s.day, 1)
  s.streamsLeft = finite(s.streamsLeft, STREAMS_PER_DAY)
  s.trend = {
    cat: s.trend?.cat || 'ring',
    lucky: s.trend?.lucky || 'red',
    style: s.trend?.style ?? null,
  }
  // 旧档没有风向款式时补掷一个，保证「1 品类 2 款式」始终可见
  if (!s.trend.style) s.trend.style = rollTrendStyle(s, s.trend.cat)
  if (!Array.isArray(s.codex)) s.codex = []
  if (!Array.isArray(s.codexBonus)) s.codexBonus = []
  if (!Array.isArray(s.vault)) s.vault = []
  if (!Array.isArray(s.gems)) s.gems = []
  if (typeof s.stock !== 'object' || !s.stock) s.stock = {}
  if (typeof s.packed !== 'object' || !s.packed) s.packed = {}
  return s
}

async function main() {
  let sdk = null
  try {
    sdk = await GameSDK.init()
    console.log('[game] ready, gameId =', sdk.context.gameId)
  } catch (e) {
    console.warn('[game] SDK init failed, running in local fallback', e)
  }
  bindSdk(sdk)

  // 读档：有档则恢复经营数据，回到开场屏由玩家选择继续或重开
  let s = freshState()
  const data = await load()
  if (data && typeof data.day === 'number') {
    s = { ...s, ...data, screen: 'intro', stats: null }
    s = migrate(s)
  }
  if (!Array.isArray(s.gems) || s.gems.length === 0) rollGemMarket(s)
  if (!Array.isArray(s.shop) || s.shop.length === 0) s.shop = rollShop(s)
  setMuted(!!s.muted)
  initStore(s)

  // 关键节点自动存档（结算/开播时由界面触发，这里兜底存一份初始档）
  saveNow(snapshot(getState()))
  mount()
}

main()
