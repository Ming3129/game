
// UI 骨架：屏幕路由、顶栏、弹窗/轻提示、通用卡片组件。
import { getState, setState, subscribe, freshState, snapshot } from './state.js'
import { RARITIES, tierOf, nextTier } from './data.js'
import { sfx, setMuted } from './fx.js'
import { rollGemMarket, rollShop, rollTrendStyle } from './engine.js'
import { saveNow } from './save.js'
import { renderDay } from './ui-day.js'
import { renderLive, renderSettle, clearLiveTimers } from './ui-live.js'

export const app = () => document.getElementById('app')

// ---------- 品类线性图标 ----------
const ICON_PATHS = {
  ring: '<circle cx="12" cy="14.5" r="5.5"/><path d="M9.5 6.5 12 4l2.5 2.5L12 9z"/>',
  necklace: '<path d="M4.5 4c.8 6.5 3.6 9.5 7.5 9.5S18.7 10.5 19.5 4"/><circle cx="12" cy="17" r="2.4"/>',
  bracelet: '<circle cx="12" cy="12" r="7" stroke-dasharray="2.4 3"/><circle cx="12" cy="5" r="1.7"/>',
  earring: '<path d="M12 3v3.5"/><circle cx="12" cy="8.5" r="1.4"/><path d="M12 11c-2.4 1.6-3.4 3.4-3.4 4.9a3.4 3.4 0 0 0 6.8 0c0-1.5-1-3.3-3.4-4.9z"/>',
}
export function icon(cat, size = 22) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[cat] || ''}</svg>`
}

// ---------- 通用：饰品卡片 ----------
export function designCard(d, { count, locked, sub } = {}) {
  const r = RARITIES[d.rarity]
  const name = locked ? '？？？' : d.name
  const subText = sub ?? `${r.name}${count != null ? ` · 库存 ${count}` : ''}`
  return `<div class="dcard rc-${d.rarity}${locked ? ' locked' : ''}">
    <div class="dcard-ic">${icon(d.cat, 24)}</div>
    <div class="dcard-nm">${name}</div>
    <div class="dcard-sub">${subText}</div>
  </div>`
}

// ---------- 轻提示 ----------
export function toast(msg, kind = 'info') {
  const t = document.createElement('div')
  t.className = `toast toast-${kind}`
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.classList.add('show'), 10)
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300) }, 1800)
}

// ---------- 弹窗 ----------
export function openModal(inner, { closable = true } = {}) {
  const mask = document.createElement('div')
  mask.className = 'modal-mask'
  mask.innerHTML = `<div class="modal">${inner}</div>`
  document.body.appendChild(mask)
  requestAnimationFrame(() => mask.classList.add('show'))
  const close = () => {
    mask.classList.remove('show')
    setTimeout(() => mask.remove(), 220)
  }
  if (closable) {
    mask.addEventListener('click', (e) => { if (e.target === mask) close() })
  }
  return { el: mask, close }
}

// ---------- 顶栏 ----------
function buildTopbar(s) {
  const tier = tierOf(s.fans)
  const nt = nextTier(s.fans)
  const el = document.createElement('header')
  el.className = 'topbar'
  el.innerHTML = `
    <div class="tb-left">
      <span class="tb-day">第 ${s.day} 天</span>
      <span class="tb-tier">${tier.name}</span>
    </div>
    <div class="tb-right">
      <span class="tb-money">¥ <b>${s.money}</b></span>
      <span class="tb-fans" title="${nt ? `距${nt.name}还差 ${nt.fans - s.fans} 粉` : '已满级'}">粉丝 <b>${s.fans}</b></span>
      <button class="tb-btn" data-act="mute" title="音效">${s.muted ? '🔇' : '🔊'}</button>
      <button class="tb-btn" data-act="help" title="玩法">?</button>
    </div>`
  el.querySelector('[data-act="mute"]').onclick = function () {
    const muted = !getState().muted
    setMuted(muted)
    setState({ muted })
    this.textContent = muted ? '🔇' : '🔊'
    sfx.tap()
  }
  el.querySelector('[data-act="help"]').onclick = () => showHelp()
  return el
}

export function updateTopbarNumbers(s) {
  const m = document.querySelector('.tb-money b')
  const f = document.querySelector('.tb-fans b')
  if (m) m.textContent = s.money
  if (f) f.textContent = s.fans
}

function showHelp() {
  sfx.tap()
  openModal(`
    <h3 class="m-title">玩法说明</h3>
    <div class="help-body">
      <p><b>白天</b>：商店买盲盒（开出新款式解锁图鉴并入库 10 件）→ 装袋：每袋 1 件饰品 + 1 枚硬币，单色硬币不超过总数的40%。</p>
      <p><b>直播</b>：粉丝数量制定订单数量。拆袋时——拆到<b>幸运色</b>硬币多拆一袋；同色硬币<b>凑成对</b>触发「对对碰」：多拆一袋 + 增效。木盘全部碰空还有「清盘」奖励三袋。</p>
      <p><b>下播</b>：按订单结算收入，观众评价影响粉丝加成。当日风向品类订单收入 + 50%。</p>
      <p><b>后期</b>：1万粉解锁宝石市场，买宝石镶嵌限定饰品，直接上架直播间卖高价。</p>
    </div>
    <button class="btn btn-primary m-close">知道了</button>
  `, { closable: true }).el.querySelector('.m-close').onclick = function () { this.closest('.modal-mask').classList.remove('show'); setTimeout(() => this.closest('.modal-mask').remove(), 220) }
}

// ---------- 开场屏 ----------
function renderIntro(root) {
  const s = getState()
  const hasSave = s.day > 1 || s.money !== 1000 || s.codex.length > 0
  root.innerHTML = `
    <div class="intro">
      <div class="intro-spot"></div>
      <div class="intro-badge">饰品盲袋 · 经营直播</div>
      <h1 class="intro-title">今夜拆什么</h1>
      <p class="intro-sub">开播饰品对对碰 </p>
      <div class="intro-actions">
        ${hasSave ? '<button class="btn btn-primary btn-big" data-act="continue">继续经营</button><button class="btn btn-ghost" data-act="new">重新开店</button>'
                  : '<button class="btn btn-primary btn-big" data-act="new">开业！</button>'}
      </div>
      <div class="intro-tips">
        <span>🪙 对对碰</span><span>💎 限定镶嵌</span>
      </div>
    </div>`
  root.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = () => {
      sfx.buy()
      if (b.dataset.act === 'new') {
        const fresh = freshState()
        rollGemMarket(fresh)
        fresh.shop = rollShop(fresh)
        fresh.trend.style = rollTrendStyle(fresh, fresh.trend.cat)
        setState({ ...fresh, screen: 'day', dayTab: 'shop' })
      } else {
        const s2 = getState()
        if (!Array.isArray(s2.shop) || s2.shop.length === 0) s2.shop = rollShop(s2)
        if (!s2.trend.style) s2.trend.style = rollTrendStyle(s2, s2.trend.cat)
        setState({ screen: 'day', dayTab: 'shop' })
      }
      saveNow(snapshot(getState()))
    }
  })
}

// ---------- 路由 ----------
let lastKey = ''
export function renderScreen() {
  const s = getState()
  clearLiveTimers()
  const root = app()
  root.innerHTML = ''
  root.appendChild(buildTopbar(s))
  const main = document.createElement('section')
  main.className = `screen sc-${s.screen}`
  root.appendChild(main)
  if (s.screen === 'intro') renderIntro(main)
  else if (s.screen === 'day') renderDay(main)
  else if (s.screen === 'live') renderLive(main)
  else if (s.screen === 'settle') renderSettle(main)
}

export function refresh() {
  lastKey = ''
  renderScreen()
}

export function mount() {
  subscribe(() => {
    const s = getState()
    const key = `${s.screen}:${s.dayTab}`
    if (key === lastKey) return
    lastKey = key
    renderScreen()
  })
  lastKey = ''
  renderScreen()
}
