
// UI 骨架：屏幕路由、顶栏、弹窗/轻提示、通用卡片组件。
import { getState, setState, subscribe, freshState, snapshot } from './state.js'
import { RARITIES, tierOf, nextTier } from './data.js'
import { sfx, setMuted } from './fx.js'
import { rollGemMarket, rollShop, rollTrendStyle } from './engine.js'
import { saveNow } from './save.js'
import { renderDay } from './ui_day.js'
import { renderLive, renderSettle, clearLiveTimers } from './ui_live.js'

export const app = () => document.getElementById('app')

// ---------- 品类与品质线性图标 ----------
const ICON_PATHS = {
  ring: '<circle cx="12" cy="14.5" r="5.5"/><path d="M9.5 6.5 12 4l2.5 2.5L12 9z"/>',
  necklace: '<path d="M4.5 4c.8 6.5 3.6 9.5 7.5 9.5S18.7 10.5 19.5 4"/><circle cx="12" cy="17" r="2.4"/>',
  bracelet: '<circle cx="12" cy="12" r="7" stroke-dasharray="2.4 3"/><circle cx="12" cy="5" r="1.7"/>',
  earring: '<path d="M12 3v3.5"/><circle cx="12" cy="8.5" r="1.4"/><path d="M12 11c-2.4 1.6-3.4 3.4-3.4 4.9a3.4 3.4 0 0 0 6.8 0c0-1.5-1-3.3-3.4-4.9z"/>',
}

// 细分等级（品质）图标：各品类随品质提升（普通、稀有、史诗、传说、限定）呈现由简至奢的不同外观
const ICON_RARITY_PATHS = {
  ring: {
    common:    '<circle cx="12" cy="14" r="5.5"/><rect x="10" y="7" width="4" height="2" rx="0.5"/>',
    rare:      '<circle cx="12" cy="14.5" r="5.5"/><path d="M9.5 6.5 12 4l2.5 2.5L12 9z"/><path d="M9.5 6.5h5"/>',
    epic:      '<circle cx="12" cy="15" r="5"/><path d="M8 7.5 12 3l4 4.5-4 3.5z"/><line x1="8" y1="7.5" x2="16" y2="7.5"/><line x1="12" y1="3" x2="12" y2="11"/><path d="M5.5 5.5 7 7m11.5-1.5L17 7"/>',
    legendary: '<circle cx="12" cy="15.5" r="4.8"/><path d="M7 8.5 9 5.5l3-2.5 3 2.5 2 3-5 3.5z"/><path d="M9 5.5h6"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor"/><path d="M4 10.5l2.5-1m13.5 1-2.5-1"/>',
    limited:   '<circle cx="12" cy="15" r="5"/><path d="M12 2l1.8 3.2L17 6l-3.2 1.8L12 11l-1.8-3.2L7 6l3.2-.8z"/><circle cx="12" cy="6" r="1.2" fill="currentColor"/><path d="M4.5 9.5l2 1m13-1-2 1"/>',
  },
  necklace: {
    common:    '<path d="M4.5 5c.8 6 3.5 9 7.5 9s6.7-3 7.5-9"/><circle cx="12" cy="17" r="2.2"/><path d="M12 14v1"/>',
    rare:      '<path d="M4.5 4.5c.8 6.5 3.6 9.5 7.5 9.5s6.7-3 7.5-9.5"/><path d="M12 14v1.5"/><path d="M12 15.5c-2 2-2 3.5-1 4.5 1 1 3 1 4 0 1-1 1-2.5-1-4.5z"/><circle cx="12" cy="18" r="0.8" fill="currentColor"/>',
    epic:      '<path d="M5 4c.6 5 3.2 8 7 8s6.4-3 7-8"/><path d="M7.5 4c.5 6 2.2 9.5 4.5 9.5s4-3.5 4.5-9.5"/><path d="M12 13.5v2"/><path d="M12 15.5l2.2 2.2-2.2 3.3-2.2-3.3z"/><path d="M10 17.7h4"/>',
    legendary: '<path d="M4 4c1 7 4 10.5 8 10.5s7-3.5 8-10.5"/><path d="M12 14.5v1.5"/><path d="M8.5 18l3.5-3 3.5 3-3.5 4.5z"/><circle cx="12" cy="18" r="1.3" fill="currentColor"/><circle cx="7" cy="10" r="1.2" fill="currentColor"/><circle cx="17" cy="10" r="1.2" fill="currentColor"/>',
    limited:   '<path d="M4 4.5c.8 6.5 3.6 9.5 8 9.5s7.2-3 8-9.5"/><path d="M12 14v1.5"/><path d="M8.5 19c0-2.8 3.5-6 3.5-6s3.5 3.2 3.5 6a3.5 3.5 0 0 1-7 0z"/><circle cx="12" cy="18.5" r="1.2" fill="currentColor"/><path d="M3.5 12l2 1m15-1-2 1M12 21.5v2"/>',
  },
  bracelet: {
    common:    '<circle cx="12" cy="12" r="7" stroke-dasharray="2 2.5"/><circle cx="12" cy="5" r="1.6"/>',
    rare:      '<circle cx="12" cy="11.5" r="6.8"/><path d="M12 18.3v2.2"/><circle cx="12" cy="22" r="1.5"/><path d="M6 9.5l-1.5-1m13.5 1 1.5-1"/>',
    epic:      '<ellipse cx="12" cy="12" rx="7.5" ry="5.5"/><ellipse cx="12" cy="12" rx="5.5" ry="7.5" stroke-dasharray="3 2"/><circle cx="12" cy="4.5" r="1.6" fill="currentColor"/><circle cx="12" cy="19.5" r="1.6" fill="currentColor"/><path d="M4.5 12h2m11 0h2"/>',
    legendary: '<path d="M6.5 15.5A7 7 0 1 1 17.5 15.5"/><path d="M5.5 14l2 2-2 2m13-4-2 2 2 2"/><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="5" r="0.9" fill="currentColor"/><path d="M9 7.5 7.5 9m7.5-1.5 1.5 1.5"/>',
    limited:   '<circle cx="12" cy="12" r="7"/><path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/><path d="M5 7.5l2 1m10-1-2 1M5 16.5l2-1m10 1-2-1"/>',
  },
  earring: {
    common:    '<path d="M12 3.5v4"/><circle cx="12" cy="7.5" r="1.5"/><path d="M12 9v3"/><circle cx="12" cy="15" r="3"/>',
    rare:      '<path d="M12 3v3.5"/><circle cx="12" cy="8" r="1.5"/><path d="M12 10c-2.5 1.8-3.5 3.5-3.5 5.2a3.5 3.5 0 0 0 7 0c0-1.7-1-3.4-3.5-5.2z"/><circle cx="12" cy="14.5" r="1" fill="currentColor"/>',
    epic:      '<path d="M12 3v2.5"/><circle cx="12" cy="7" r="1.3"/><path d="M12 8.5 8.5 13l3.5 4.5 3.5-4.5z"/><path d="M8.5 13h7"/><path d="M12 17.5v3.5"/><circle cx="12" cy="22" r="1" fill="currentColor"/>',
    legendary: '<path d="M12 3a2.5 2.5 0 0 0-2.5 2.5v2a2.5 2.5 0 0 0 5 0v-2A2.5 2.5 0 0 0 12 3z"/><circle cx="12" cy="11.5" r="1.2" fill="currentColor"/><path d="M7 14.5l5-2 5 2-2.5 5.5-2.5 2.5-2.5-2.5z"/><path d="M9.5 16.5h5"/><path d="M12 18.5v3.5"/>',
    limited:   '<path d="M12 3v3"/><circle cx="12" cy="8" r="1.5"/><path d="M12 10.5v1.5"/><path d="M12 12l2.8 2.8-2.8 4.2-2.8-4.2z"/><path d="M9.2 14.8h5.6"/><path d="M5.5 15l2 .5m9-.5 2 .5"/><circle cx="12" cy="15" r="1" fill="currentColor"/>',
  }
}

export function icon(catOrDesign, size = 22, rarity = null) {
  let cat = catOrDesign
  let r = rarity
  if (typeof catOrDesign === 'object' && catOrDesign !== null) {
    cat = catOrDesign.cat
    r = r || catOrDesign.rarity
  }
  const path = (r && ICON_RARITY_PATHS[cat]?.[r]) || ICON_PATHS[cat] || ''
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`
}

// ---------- 通用：饰品卡片 ----------
export function designCard(d, { count, locked, sub } = {}) {
  const r = RARITIES[d.rarity]
  const name = locked ? '？？？' : d.name
  const subText = sub ?? `${r.name}${count != null ? ` · 库存 ${count}` : ''}`
  return `<div class="dcard rc-${d.rarity}${locked ? ' locked' : ''}">
    <div class="dcard-ic">${icon(d, 24)}</div>
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

// ---------- 音效状态图标 ----------
export function volumeIcon(muted, size = 16) {
  if (muted) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>`
  }
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
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
      <button class="tb-btn" data-act="mute" title="音效">${volumeIcon(s.muted)}</button>
      <button class="tb-btn" data-act="help" title="玩法">?</button>
    </div>`
  el.querySelector('[data-act="mute"]').onclick = function () {
    const muted = !getState().muted
    setMuted(muted)
    setState({ muted })
    this.innerHTML = volumeIcon(muted)
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
        <span>对对碰</span><span>限定镶嵌</span>
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
