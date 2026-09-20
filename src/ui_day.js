// 日间界面：风向横幅 + 进货/装袋/图鉴/宝石四个页签 + 开播底栏。
import { getState, setState } from './state.js'
import {
  CATS, CAT_KEYS, RARITIES, DESIGNS, designById, BOXES,
  COINS, COIN_KEYS, GEMS, GEM_MARKET_FANS, ENABLE_GEM_CHANNEL, TREND_LINES, UNLOCK_GRANT,
  STREAMS_PER_DAY,
} from './data.js'
import {
  rollBox, buyStock, packBags, unpackCategory, autoPick,
  buyGem, craftLimited, rollShop, nextDay, rollTrendStyle, rollSaleStyle,
} from './engine.js'
import { designCard, icon, toast, openModal, refresh } from './ui.js'
import { sfx, burst, popIn, shake } from './fx.js'
import { saveNow } from './save.js'
import { startLive } from './ui_live.js'

// 装袋草稿（临时态，不入档；按天保留，切页签不丢）。counts: designId -> 数量
const draft = { day: 0, cat: null, counts: {}, coins: {} }
// 款式补货品类展开状态：默认全部折叠，记录被用户主动展开的品类 key
const expandedCats = new Set()

export function renderDay(root) {
  const s = getState()
  if (!ENABLE_GEM_CHANNEL && s.dayTab === 'gem') {
    s.dayTab = 'shop'
  }
  if (draft.day !== s.day) {
    draft.day = s.day
    draft.cat = null
    draft.counts = {}
    draft.coins = {}
  }
  // 兜底：商店为空或不是 10 盒时当场补齐/重掷，保证盲盒机始终有 10 个机位
  if (!Array.isArray(s.shop) || s.shop.length !== 10) s.shop = rollShop(s)
  s.shop.forEach((o) => {
    if (o && o.tier !== 'SSS') o.tier = 'SSS'
  })
  // 兜底：风向款式与今日特价缺失时当场补掷，保证始终可见
  if (!s.trend.style) s.trend.style = rollTrendStyle(s, s.trend.cat)
  if (!s.trend.saleStyle) s.trend.saleStyle = rollSaleStyle(s, s.trend.cat, s.trend.style)
  if (!s.trend.saleDiscount) s.trend.saleDiscount = 0.5
  const packedTotal = CAT_KEYS.reduce((n, k) => n + (s.packed[k] || []).length, 0)
  const styleName = s.trend.style ? designById(s.trend.style).name : null
  const styleUnlocked = s.trend.style && s.codex.includes(s.trend.style)
  const styleLabel = !styleName ? '款式待解锁'
    : styleUnlocked ? `「${styleName}」`
    : `【${styleName}】（未解锁）`
  root.innerHTML = `
    <div class="wind-banner">
      <div class="wind-head"><span class="wind-tag">今日风向</span>
        <span class="wind-cat"> ${icon(s.trend.cat, 16)} ${CATS[s.trend.cat].name}</span>
        <span class="wind-style"> ${styleLabel}</span>
        <span class="wind-lucky">幸运色 <i class="coin-dot sm" style="--cc:${COINS[s.trend.lucky].hex}">${COINS[s.trend.lucky].name}</i></span>
      </div>
      <p class="wind-line">${TREND_LINES[s.trend.cat]} 命中${CATS[s.trend.cat].name}订单营收 ×1.5；拆中「${styleName || '风向款式'}」每件粉丝 +1${styleName && !styleUnlocked ? '（先去把这款开出来！）' : ''}！</p>
    </div>
    <nav class="tabs">
      <button data-tab="shop" class="${s.dayTab === 'shop' ? 'on' : ''}">进货</button>
      <button data-tab="pack" class="${s.dayTab === 'pack' ? 'on' : ''}">装袋</button>
      <button data-tab="codex" class="${s.dayTab === 'codex' ? 'on' : ''}">图鉴</button>
      ${ENABLE_GEM_CHANNEL ? `<button data-tab="gem" class="${s.dayTab === 'gem' ? 'on' : ''}">宝石${s.fans >= GEM_MARKET_FANS ? '' : ' 🔒'}</button>` : ''}
    </nav>
    <div class="tab-body" id="tabBody"></div>
    <div class="day-bottom">
      <span class="db-info">已装袋 <b>${packedTotal}</b> 袋${s.heldOrders?.length ? ` · 保留单 <b>${s.heldOrders.length}</b>` : ''}</span>
      <button class="btn btn-primary btn-live" data-act="live" ${packedTotal === 0 ? 'disabled' : ''}>开播${s.streamsLeft < STREAMS_PER_DAY ? `（剩 ${s.streamsLeft} 场）` : ''}</button>
      <button class="btn btn-ghost btn-nextday" data-act="nextday">下一天</button>
    </div>`

  root.querySelectorAll('.tabs button').forEach((b) => {
    b.onclick = () => { sfx.tap(); setState({ dayTab: b.dataset.tab }) }
  })
  root.querySelector('[data-act="live"]').onclick = () => startLive()
  root.querySelector('[data-act="nextday"]').onclick = () => confirmNextDay(s)
  renderTab(root.querySelector('#tabBody'))
}

// 下一天确认弹窗
function confirmNextDay(s) {
  sfx.tap()
  const { close } = openModal(`
    <h3 class="m-title">进入下一天？</h3>
    <p class="nd-note">未卖完的盲袋会保留到明天；风向${ENABLE_GEM_CHANNEL ? '、今日盲盒与宝石市场' : '与今日盲盒'}将刷新。</p>
    <div class="nd-btns">
      <button class="btn btn-ghost" id="ndCancel">留在当天</button>
      <button class="btn btn-primary" id="ndOk">确认</button>
    </div>`, { closable: true })
  document.getElementById('ndCancel').onclick = () => { sfx.tap(); close() }
  document.getElementById('ndOk').onclick = () => {
    sfx.buy()
    close()
    nextDay(s)
    setState({ screen: 'day', dayTab: 'shop' })
    saveNow()
  }
}

function renderTab(body) {
  const s = getState()
  if (s.dayTab === 'shop') renderShop(body)
  else if (s.dayTab === 'pack') renderPack(body)
  else if (s.dayTab === 'codex') renderCodex(body)
  else if (ENABLE_GEM_CHANNEL && s.dayTab === 'gem') renderGem(body)
  else renderShop(body)
}

// ---------- 进货（盲盒木架） ----------
function renderShop(body) {
  const s = getState()
  const shopList = s.shop || []
  const availableOffers = shopList.map((o, idx) => ({ ...o, idx })).filter((o) => !o.sold)
  const remainingCount = availableOffers.length
  const totalCostAll = availableOffers.reduce((sum, o) => sum + (o.price || 50), 0)
  const canRandomDraw = s.money >= 50 && remainingCount > 0
  const canBuyAll = remainingCount > 0 && s.money >= totalCostAll
  const canRefreshShelf = s.money >= 50

  const shelfSlotsHtml = shopList.map((o, i) => {
    const price = o.price || 50
    const canAfford = s.money >= price

    if (o.sold) {
      return `
        <div class="wood-slot sold">
          <div class="wood-slot-pedestal">
            <div class="wood-sold-stamp">已售出</div>
          </div>
          <div class="wood-box-price is-sold">¥${price}</div>
          <button class="btn btn-mini wood-btn-buy is-sold-btn" disabled>已售出</button>
        </div>`
    }

    return `
      <div class="wood-slot" data-offer="${i}">
        <div class="wood-box-display">
          <div class="wood-rect-box"></div>
        </div>
        <div class="wood-box-price">¥${price}</div>
        <button class="btn btn-mini wood-btn-buy ${canAfford ? 'btn-primary' : 'wood-btn-gray'}" data-offer="${i}" ${!canAfford ? 'disabled' : ''}>
          ${canAfford ? '购买' : '余额不足'}
        </button>
      </div>`
  }).join('')

  const restockRows = CAT_KEYS.map((cat) => {
    const list = DESIGNS.filter((d) => d.cat === cat && d.rarity !== 'limited' && s.codex.includes(d.id))
    if (list.length === 0) return ''
    // 特价款与风向款排在前面
    list.sort((a, b) => {
      const aPri = (a.id === s.trend?.saleStyle ? 2 : 0) + (a.id === s.trend?.style ? 1 : 0)
      const bPri = (b.id === s.trend?.saleStyle ? 2 : 0) + (b.id === s.trend?.style ? 1 : 0)
      return bPri - aPri
    })
    const isExpanded = expandedCats.has(cat)
    return `<div class="restock-cat ${isExpanded ? '' : 'collapsed'}" data-cat-id="${cat}">
      <div class="restock-head" data-toggle-cat="${cat}">
        <span class="rc-head-title">
          ${icon(cat, 18)}
          <b>${CATS[cat].name}补货</b>
        </span>
        <span class="rc-head-toggle">
          <span>${list.length} 款</span>
          <i class="rc-toggle-arrow">▼</i>
        </span>
      </div>
      <div class="restock-list">
        ${list.map((d) => {
          const origP = RARITIES[d.rarity].unitPrice
          const isTrendStyle = d.id === s.trend?.style
          const isSale = s.trend && s.trend.saleStyle === d.id
          const discount = s.trend?.saleDiscount || 0.5
          const p = isSale ? Math.max(1, Math.round(origP * discount)) : origP

          return `<div class="restock-row ${isTrendStyle ? 'row-trend' : ''} ${isSale ? 'row-sale' : ''}">
            <span class="rr-ic" style="color:${RARITIES[d.rarity].color};display:inline-flex;align-items:center;">${icon(d, 16)}</span>
            <div class="rr-name-wrap">
              <span class="rr-name">${d.name}</span>
              ${isTrendStyle ? '<span class="rr-badge-trend">🔥 风向款</span>' : ''}
              ${isSale ? '<span class="rr-badge-sale">🏷️ 今日特价 5折</span>' : ''}
            </div>
            <span class="rr-stock">库存 ${s.stock[d.id] || 0}</span>
            <span class="rr-price">
              ${isSale ? `<del class="rr-old-price">¥${origP}</del><b class="rr-sale-price">¥${p}</b>` : `¥${p}`}
            </span>
            <button class="btn btn-mini" data-buy="${d.id}" data-n="1" ${s.money < p ? 'disabled' : ''}>+1</button>
            <button class="btn btn-mini" data-buy="${d.id}" data-n="5" ${s.money < p * 5 ? 'disabled' : ''}>+5</button>
          </div>`
        }).join('')}
      </div>
    </div>`
  }).join('')

  const saleStyleObj = s.trend?.saleStyle ? designById(s.trend.saleStyle) : null

  body.innerHTML = `
    <!-- 盲盒展架 -->
    <div class="wood-shelf-rack">
      <div class="wood-rack-header">
        <div class="wood-title-sign">
          <span class="wood-sign-text">盲盒</span>
        </div>
        <div class="wood-header-actions">
          <button class="btn btn-mini wood-btn-refresh ${canRefreshShelf ? '' : 'wood-btn-gray'}" id="woodRefreshShelf" ${!canRefreshShelf ? 'disabled' : ''} title="花费 ¥50 重新生成整架 10 盒盲盒">
            刷新货架 ¥50
          </button>
          <button class="btn btn-mini ${canBuyAll ? 'btn-primary' : 'wood-btn-gray'}" id="woodBuyAll" ${!canBuyAll ? 'disabled' : ''} title="一键购买当前货架所有在售盲盒">
            一键购买${remainingCount > 0 ? ` (¥${totalCostAll})` : ' (已售空)'}
          </button>
        </div>
      </div>

      <!-- 层板陈列区 -->
      <div class="wood-rack-body">
        <div class="wood-slots-grid">
          ${shelfSlotsHtml}
        </div>
        <div class="wood-rack-footer">
          <span class="wood-stock-tag">在售 <b>${remainingCount}</b> / 10 盒</span>
        </div>
      </div>
    </div>

    <!-- 款式补货 -->
    <div class="restock-header-bar">
      <h4 class="sec-title" style="margin-bottom:0;">款式补货</h4>
      ${saleStyleObj ? `
      <div class="restock-trend-hint">
        <span>今日特价【<b class="text-sale">${saleStyleObj.name} 5折</b>】</span>
      </div>` : ''}
    </div>
    <div class="restock">${restockRows || '<p class="empty-hint">还没有解锁任何款式，先抽几个盲盒吧</p>'}</div>`

  // 刷新货架按钮（花50更新整个货架）
  const refreshShelfBtn = body.querySelector('#woodRefreshShelf')
  if (refreshShelfBtn) {
    refreshShelfBtn.onclick = () => {
      if (s.money < 50) return toast('余额不足，刷新货架需 ¥50', 'warn')
      s.money -= 50
      s.shop = rollShop(s)
      sfx.tear()
      sfx.coin()
      toast('已消耗 ¥50 刷新整个盲盒货架！', 'good')
      refresh()
    }
  }

  // 一键购买货架上所有盲盒
  const buyAllBtn = body.querySelector('#woodBuyAll')
  if (buyAllBtn) {
    buyAllBtn.onclick = () => {
      const avail = (s.shop || []).map((o, idx) => ({ ...o, idx })).filter((o) => !o.sold)
      if (avail.length === 0) return toast('当前货架盲盒已全部售空，可花 ¥50 刷新货架！', 'info')
      const totalCost = avail.reduce((sum, o) => sum + (o.price || 50), 0)
      if (s.money < totalCost) return toast(`余额不足，一键购买全架需 ¥${totalCost}`, 'warn')
      openMultiBoxModal(avail)
    }
  }

  // 随机盲抽按钮
  const randomDrawBtn = body.querySelector('#woodRandomDraw')
  if (randomDrawBtn) {
    randomDrawBtn.onclick = () => {
      const avail = (s.shop || []).map((o, idx) => ({ ...o, idx })).filter((o) => !o.sold)
      if (avail.length === 0) return toast('今日盲盒架已售空，请花 ¥50 刷新或明天再来！', 'info')
      if (s.money < 50) return toast('钱不够啦，单抽需 ¥50', 'warn')
      const chosen = avail[Math.floor(Math.random() * avail.length)]
      openBoxModal(chosen.cat, chosen.tier, chosen.idx)
    }
  }

  // 点击机位或者抽取按钮
  body.querySelectorAll('.wood-slot:not(.sold), .wood-btn-buy:not(.is-sold-btn)').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation()
      const offerIdx = Number(b.dataset.offer)
      const offer = s.shop[offerIdx]
      if (!offer || offer.sold) return
      if (s.money < (offer.price || 50)) return toast('钱不够啦，单抽需 ¥50', 'warn')
      openBoxModal(offer.cat, offer.tier, offerIdx)
    }
  })

  // 补货品类折叠/展开（默认折叠）
  body.querySelectorAll('[data-toggle-cat]').forEach((head) => {
    head.onclick = (e) => {
      e.stopPropagation()
      const catKey = head.dataset.toggleCat
      const catEl = head.closest('.restock-cat')
      if (expandedCats.has(catKey)) {
        expandedCats.delete(catKey)
        catEl?.classList.add('collapsed')
      } else {
        expandedCats.add(catKey)
        catEl?.classList.remove('collapsed')
      }
      sfx.click()
    }
  })

  body.querySelectorAll('[data-buy]').forEach((b) => {
    b.onclick = () => {
      const r = buyStock(s, b.dataset.buy, Number(b.dataset.n))
      if (!r.ok) return toast('钱不够啦', 'warn')
      sfx.buy()
      refresh()
    }
  })
}

// 一键批量购买并连拆所有盲盒
function openMultiBoxModal(availOffers) {
  const s = getState()
  const totalCost = availOffers.reduce((sum, o) => sum + (o.price || 50), 0)
  if (s.money < totalCost) return toast(`余额不足，一键购买需 ¥${totalCost}`, 'warn')

  const allItems = []
  let totalNew = 0

  for (const offer of availOffers) {
    const res = rollBox(s, offer.cat, offer.tier)
    if (res.ok) {
      if (offer.idx != null && s.shop[offer.idx]) s.shop[offer.idx].sold = true
      res.items.forEach((it) => {
        allItems.push({ ...it, cat: offer.cat })
        if (it.isNew) totalNew++
      })
    }
  }

  const boxCount = availOffers.length
  const { close } = openModal(`
    <div class="boxstage boxstage-multi">
      <div class="bm-modal-title">✨ 一键全购！连拆 ${boxCount} 盒盲盒...</div>
      <div class="box3d bm-mystery-3d-box" id="box3d">
        <div class="bm-modal-rect-box"></div>
      </div>
      <div class="box-reveal-banner" id="boxRevealBanner" style="display:none;"></div>
      <div class="box-items box-items-multi" id="boxItems"></div>
      <button class="btn btn-primary" id="boxOk" style="visibility:hidden">全部收下并入库</button>
    </div>`, { closable: false })

  const boxEl = document.getElementById('box3d')
  setTimeout(() => {
    boxEl.classList.add('shaking')
    sfx.tap()
  }, 60)

  setTimeout(() => {
    boxEl.classList.remove('shaking')
    boxEl.classList.add('opened')
    const rect = boxEl.getBoundingClientRect()
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2, ['#FFD98E', '#FF7EB6', '#7DE2D1', '#C77DFF'], 36)
    sfx.tear()

    const banner = document.getElementById('boxRevealBanner')
    if (banner) {
      banner.style.display = 'flex'
      banner.innerHTML = `<span class="reveal-text">大丰收！共拆出 <b>${allItems.length} 件</b> 饰品${totalNew > 0 ? `（包含 <b style="color:var(--pink)">${totalNew} 款新品</b>）` : ''}！</span>`
    }

    const wrap = document.getElementById('boxItems')
    let hasLegendary = false
    allItems.forEach((it, i) => {
      const div = document.createElement('div')
      div.className = 'box-item'
      div.innerHTML = `${designCard(it.design)}${it.isNew ? '<span class="new-badge">NEW</span>' : ''}
        <span class="grant">${it.isNew ? `解锁图鉴 +${it.grant} 件` : `补货 +${it.grant} 件`}</span>`
      wrap.appendChild(div)
      popIn(div, i * 70)
      const r = it.design.rarity
      if (r === 'legendary') hasLegendary = true
      setTimeout(() => {
        if (r === 'legendary') sfx.legendary()
        else if (r === 'epic') sfx.rare()
        else sfx.coin()
        if (r === 'epic' || r === 'legendary') {
          const d = div.getBoundingClientRect()
          burst(d.left + d.width / 2, d.top + d.height / 2, [RARITIES[r].color, '#FFF'], 10)
        }
      }, i * 70 + 100)
    })

    setTimeout(() => {
      document.getElementById('boxOk').style.visibility = 'visible'
      if (hasLegendary) sfx.legendary()
    }, allItems.length * 70 + 220)
  }, 900)

  document.getElementById('boxOk').onclick = () => {
    sfx.buy()
    close()
    refresh()
  }
}

// 盲盒开盒动画弹窗（购买商店 offer 时标记售罄，开盒揭晓品类与饰品）
function openBoxModal(cat, tierKey = 'SSS', offerIdx = null) {
  const s = getState()
  const result = rollBox(s, cat, tierKey)
  if (!result.ok) return toast('钱不够啦，单抽需 ¥50', 'warn')
  if (offerIdx != null && s.shop[offerIdx]) s.shop[offerIdx].sold = true

  const { close } = openModal(`
    <div class="boxstage">
      <div class="bm-modal-title">拆开神秘盲盒...</div>
      <div class="box3d bm-mystery-3d-box" id="box3d">
        <div class="bm-modal-rect-box"></div>
      </div>
      <div class="box-reveal-banner" id="boxRevealBanner" style="display:none;"></div>
      <div class="box-items" id="boxItems"></div>
      <button class="btn btn-primary" id="boxOk" style="visibility:hidden">收下并入库</button>
    </div>`, { closable: false })
  const boxEl = document.getElementById('box3d')
  setTimeout(() => {
    boxEl.classList.add('shaking')
    sfx.tap()
  }, 60)
  setTimeout(() => {
    boxEl.classList.remove('shaking')
    boxEl.classList.add('opened')
    const rect = boxEl.getBoundingClientRect()
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2, ['#FFD98E', '#FF7EB6', '#7DE2D1', '#C77DFF'], 24)
    sfx.tear()

    // 揭晓盲盒真实品类！
    const banner = document.getElementById('boxRevealBanner')
    if (banner) {
      banner.style.display = 'flex'
      banner.innerHTML = `<span class="reveal-text">恭喜抽中 <b>${icon(cat, 18)} ${CATS[cat].name}盲盒</b>！</span>`
    }

    const wrap = document.getElementById('boxItems')
    result.items.forEach((it, i) => {
      const div = document.createElement('div')
      div.className = 'box-item'
      div.innerHTML = `${designCard(it.design)}${it.isNew ? '<span class="new-badge">NEW</span>' : ''}
        <span class="grant">${it.isNew ? `解锁图鉴 +${it.grant} 件` : `补货 +${it.grant} 件`}</span>`
      wrap.appendChild(div)
      popIn(div, i * 160)
      const r = it.design.rarity
      setTimeout(() => {
        if (r === 'legendary') sfx.legendary()
        else if (r === 'epic') sfx.rare()
        else sfx.coin()
        if (r === 'epic' || r === 'legendary') {
          const d = div.getBoundingClientRect()
          burst(d.left + d.width / 2, d.top + d.height / 2, [RARITIES[r].color, '#FFF'], 12)
        }
      }, i * 160 + 200)
    })
    setTimeout(() => {
      document.getElementById('boxOk').style.visibility = 'visible'
      if (result.items.some((i) => i.design.rarity === 'legendary')) sfx.legendary()
    }, result.items.length * 160 + 300)
  }, 900)
  document.getElementById('boxOk').onclick = () => { sfx.buy(); close(); refresh() }
}

// ---------- 装袋 ----------
function renderPack(body) {
  const s = getState()
  const heldNotice = (s.heldOrders && s.heldOrders.length > 0)
    ? `<div class="held-pack-notice">📌 <b>有 ${s.heldOrders.length} 个保留订单</b> 待下一场开播：${s.heldOrders.map((ho) => `${CATS[ho.cat].name} ×${ho.size}袋`).join('、')}，请记得装袋备货！</div>`
    : ''
  body.innerHTML = heldNotice + `<p class="pack-hint">每袋装 <b>1 件饰品 + 1 枚硬币</b>。自由匹配硬币。</p>` +
    CAT_KEYS.map((cat) => {
      const packed = s.packed[cat] || []
      const stockN = CAT_KEYS_stockOf(s, cat)
      const open = draft.cat === cat
      return `<div class="pack-card ${open ? 'open' : ''}">
        <button class="pack-head" data-cat="${cat}">
          ${icon(cat, 20)}<span>${CATS[cat].name}</span>
          <em>库存 ${stockN} · 已装 ${packed.length} 袋</em><i class="arr">${open ? '▾' : '▸'}</i>
        </button>
        ${packedSummary(s, cat, open)}
        ${open ? packPanel(s, cat) : ''}
      </div>`
    }).join('')

  body.querySelectorAll('.pack-head').forEach((b) => {
    b.onclick = () => {
      sfx.tap()
      const cat = b.dataset.cat
      draft.cat = draft.cat === cat ? null : cat
      draft.counts = {}
      draft.coins = {}
      renderTab(body.closest('.tab-body'))
    }
  })
  wirePackPanel(body)
  wirePackedActions(body)
}

function CAT_KEYS_stockOf(s, cat) {
  return DESIGNS.filter((d) => d.cat === cat).reduce((n, d) => n + (s.stock[d.id] || 0), 0)
}

function packedSummary(s, cat, open = false) {
  const packed = s.packed[cat] || []
  if (packed.length === 0) return ''
  const byDesign = {}
  const byCoin = {}
  for (const b of packed) {
    byDesign[b.a] = (byDesign[b.a] || 0) + 1
    byCoin[b.c] = (byCoin[b.c] || 0) + 1
  }
  return `<div class="packed-sum ${open ? 'in-open' : ''}">
    <div class="ps-row ps-header">
      <span class="packed-sum-tag">已装袋</span>
      <button class="btn btn-mini btn-danger" data-unpack="${cat}">撤回全部</button>
    </div>
    <div class="ps-row ps-designs">
      ${Object.entries(byDesign).map(([id, n]) => `<span class="chip">${designById(id).name} ×${n}</span>`).join('')}
    </div>
    <div class="ps-row ps-coins">
      ${Object.entries(byCoin).map(([k, n]) => `<span class="chip"><i class="coin-dot sm" style="--cc:${COINS[k].hex}">${COINS[k].name}</i> ×${n}</span>`).join('')}
    </div>
  </div>`
}

function packPanel(s, cat) {
  const rows = DESIGNS.filter((d) => d.cat === cat && d.rarity !== 'limited' && s.codex.includes(d.id))
    .map((d) => {
      const stock = s.stock[d.id] || 0
      const n = draft.counts[d.id] || 0
      return `<div class="pack-row ${stock === 0 ? 'off' : ''}">
        <span class="pr-ic" style="color:${RARITIES[d.rarity].color};display:inline-flex;align-items:center;">${icon(d, 16)}</span>
        <span class="pr-name">${d.name}</span>
        <span class="pr-stock">库存 ${stock}</span>
        <div class="pr-step">
          <button class="cs-btn cs-btn-quick" data-zero="${d.id}" ${n === 0 ? 'disabled' : ''} title="一键清空"><<</button>
          <button class="cs-btn" data-dec="${d.id}" ${n === 0 ? 'disabled' : ''} title="减少1件"><</button>
          <b class="cs-n">${n}</b>
          <button class="cs-btn" data-inc="${d.id}" ${stock === 0 || n >= stock ? 'disabled' : ''} title="增加1件">></button>
          <button class="cs-btn cs-btn-quick" data-max="${d.id}" ${stock === 0 || n >= stock ? 'disabled' : ''} title="一键加满">>></button>
        </div>
      </div>`
    }).join('')
  const n = draftTotal()
  const coinSum = COIN_KEYS.reduce((a, k) => a + (draft.coins[k] || 0), 0)
  const coinAdds = COIN_KEYS.map((k) => `
    <button class="coin-add" data-addcoin="${k}" ${n === 0 || coinSum >= n ? 'disabled' : ''} title="点一下放一枚：${COINS[k].pair}">
      <i class="coin-dot" style="--cc:${COINS[k].hex}">${COINS[k].name}</i>
      <b>×${draft.coins[k] || 0}</b>
      <em>${COINS[k].pair}</em>
    </button>`).join('')
  const coinChips = COIN_KEYS.flatMap((k) =>
    Array.from({ length: draft.coins[k] || 0 }, () =>
      `<button class="coin-added" data-rmcoin="${k}" title="点一下取回一枚"><i class="coin-dot sm" style="--cc:${COINS[k].hex}">${COINS[k].name}</i></button>`)
  ).join('')
  const ready = n > 0 && coinSum === n
  return `<div class="pack-panel">
    <div class="pp-sec"><label>选饰品（每款用 ± 调数量）</label>
      <div class="pack-rows">${rows || '<span class="empty-hint">该品类还没有解锁款式，先去进货</span>'}</div>
      ${n ? `<span class="pp-count">共 ${n} 袋</span>` : ''}
    </div>
    <div class="pp-sec"><label>配硬币（点硬币加入，点下方已放的取回；总数须 = ${n || 0}）<button class="btn btn-mini" data-act="autocoin" ${n === 0 ? 'disabled' : ''}>自动配币</button></label>
      <div class="coin-adds">${coinAdds}</div>
      <div class="coin-added-row">${coinChips || '<span class="empty-hint">还没放硬币，点上面加入</span>'}</div>
      <span class="pp-count ${coinSum === n ? '' : 'warn'}">硬币 ${coinSum} / ${n}</span>
    </div>
    <div class="pp-actions">
      <button class="btn btn-ghost" data-act="autofill" data-cat="${cat}" ${CAT_KEYS_stockOf(s, cat) === 0 ? 'disabled' : ''}>一键装袋</button>
      <button class="btn btn-primary" data-act="confirm" data-cat="${cat}" ${ready ? '' : 'disabled'}>确认装袋</button>
    </div>
  </div>`
}

function draftTotal() {
  return Object.values(draft.counts).reduce((a, b) => a + b, 0)
}

// 草稿数量 → designId 数组
function draftPicks() {
  const picks = []
  for (const [id, n] of Object.entries(draft.counts)) {
    for (let i = 0; i < n; i++) picks.push(id)
  }
  return picks
}

function wirePackPanel(body) {
  body.querySelectorAll('[data-inc]').forEach((b) => {
    b.onclick = () => {
      const s = getState()
      const id = b.dataset.inc
      const next = (draft.counts[id] || 0) + 1
      if (next > (s.stock[id] || 0)) return toast('该款式库存不够啦', 'warn')
      sfx.tap()
      draft.counts[id] = next
      renderTab(body.closest('.tab-body'))
    }
  })
  body.querySelectorAll('[data-dec]').forEach((b) => {
    b.onclick = () => {
      sfx.tap()
      const id = b.dataset.dec
      draft.counts[id] = Math.max(0, (draft.counts[id] || 0) - 1)
      if (draft.counts[id] === 0) delete draft.counts[id]
      renderTab(body.closest('.tab-body'))
    }
  })
  body.querySelectorAll('[data-zero]').forEach((b) => {
    b.onclick = () => {
      sfx.tap()
      const id = b.dataset.zero
      delete draft.counts[id]
      renderTab(body.closest('.tab-body'))
    }
  })
  body.querySelectorAll('[data-max]').forEach((b) => {
    b.onclick = () => {
      const s = getState()
      const id = b.dataset.max
      const stock = s.stock[id] || 0
      if (stock <= 0) return
      sfx.tap()
      draft.counts[id] = stock
      renderTab(body.closest('.tab-body'))
    }
  })
  body.querySelectorAll('[data-addcoin]').forEach((b) => {
    b.onclick = () => {
      const s = getState()
      const k = b.dataset.addcoin
      const n = draftTotal()
      const coinSum = COIN_KEYS.reduce((a, c) => a + (draft.coins[c] || 0), 0)
      if (coinSum >= n) return toast('硬币总数要等于袋数', 'warn')
      sfx.coin()
      draft.coins[k] = (draft.coins[k] || 0) + 1
      renderTab(body.closest('.tab-body'))
    }
  })
  body.querySelectorAll('[data-rmcoin]').forEach((b) => {
    b.onclick = () => {
      sfx.tap()
      const k = b.dataset.rmcoin
      draft.coins[k] = Math.max(0, (draft.coins[k] || 0) - 1)
      if (draft.coins[k] === 0) delete draft.coins[k]
      renderTab(body.closest('.tab-body'))
    }
  })
  const auto = body.querySelector('[data-act="autocoin"]')
  if (auto) auto.onclick = () => {
    sfx.tap()
    draft.coins = autoDistribute(draftTotal())
    renderTab(body.closest('.tab-body'))
  }
  const fill = body.querySelector('[data-act="autofill"]')
  if (fill) fill.onclick = () => {
    const s = getState()
    const cat = fill.dataset.cat
    const picks = autoPick(s, cat, CAT_KEYS_stockOf(s, cat))
    const coins = autoDistribute(picks.length)
    const r = packBags(s, cat, picks, coins)
    if (!r.ok) return toast('装袋失败', 'warn')
    playPackModal(cat, picks.length, picks, coins)
    draft.counts = {}
    draft.coins = {}
  }
  const confirm = body.querySelector('[data-act="confirm"]')
  if (confirm) confirm.onclick = () => {
    const s = getState()
    const cat = confirm.dataset.cat
    const picks = draftPicks()
    const coins = { ...draft.coins }
    const r = packBags(s, cat, picks, coins)
    if (!r.ok) {
      if (r.reason === 'coinSum') return toast('硬币总数要等于袋数', 'warn')
      return toast('库存不足', 'warn')
    }
    playPackModal(cat, picks.length, picks, coins)
    draft.counts = {}
    draft.coins = {}
  }
}

// 互动装袋弹窗：咬口式彩色自封袋（盲袋），支持拖入饰品与硬币后，沿咬口从左往右滑动封袋
function playPackModal(cat, n, picks = [], coins = {}) {
  const s = getState()
  const design = (picks && picks[0] && designById(picks[0]))
    || DESIGNS.find((d) => d.cat === cat && d.rarity !== 'limited' && s.codex.includes(d.id))
    || DESIGNS.find((d) => d.cat === cat)
    || { id: cat, name: CATS[cat]?.name || '精美饰品', cat, rarity: 'rare' }

  let coinKey = Object.keys(coins).find((k) => coins[k] > 0) || s.trend?.lucky || 'gold'
  const coin = COINS[coinKey] || COINS.gold

  const { close } = openModal(`
    <div class="pack-interactive-stage">
      <div class="pack-header">
        <b class="pack-title" id="packTitle">装袋</b>
        <span class="pack-num">${CATS[cat].name}盲袋 × ${n}</span>
        <p class="pack-guide-hint" id="packGuideHint">拖动饰品与硬币放入自封袋</p>
      </div>

      <div class="pack-workarea" id="packWorkarea">
        <!-- 弹窗关闭前直接在中央弹出的装袋成功浮层 -->
        <div class="pack-success-popup" id="packSuccessPopup">装袋成功！</div>

        <!-- 左边：咬口式彩色自封盲袋 -->
        <div class="ziplock-bag-col" id="packBagDropzone">
          <div class="ziplock-pack-bag pack-anim" id="packBag">
            <!-- 顶部挂孔与撕裂凹槽 -->
            <div class="zpb-top-rim">
              <div class="zpb-notch left"></div>
              <div class="zpb-hang-hole"></div>
              <div class="zpb-notch right"></div>
            </div>

            <!-- 咬口自封条轨道（实色银色线条互动滑动条） -->
            <div class="zpb-track-container" id="zipTrackContainer">
              <div class="zpb-track-groove">
                <div class="zpb-track-sealed" id="zipTrackSealed"></div>
              </div>
              <div class="zpb-slider-thumb" id="zipSliderThumb">
                <div class="zpb-thumb-grip">
                  <svg class="zpb-thumb-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="8 5 15 12 8 19"></polyline>
                  </svg>
                </div>
              </div>
              <div class="zpb-slide-hint" id="zbSlideHint">
                
                <span class="zpb-hint-text">从左向右滑动封口</span>
              </div>
            </div>

            <!-- 半透明彩色袋身 -->
            <div class="zpb-body" id="zpbBody">
              <div class="zpb-weld left"></div>
              <div class="zpb-weld right"></div>
              <div class="zpb-weld bottom"></div>

              <!-- 品类中央印花 -->
              <div class="zpb-watermark" id="zpbWatermark">
                <span class="zpb-wm-ic">${icon(cat, 48)}</span>
              </div>
              <div class="zpb-sheen"></div>
            </div>
          </div>
        </div>

        <!-- 右边：上面饰品图案（透明背景），下面硬币（透明背景） -->
        <div class="pack-items-col" id="packItemsCol">
          <!-- 饰品图案（透明背景） -->
          <div class="pack-drag-item" id="dragJewel" data-type="jewel" title="拖动或点击装入饰品">
            <div class="pack-jewel-preview" style="color: ${RARITIES[design.rarity]?.color || 'var(--pink-deep)'};">
              ${icon(design, 52)}
            </div>
          </div>

          <!-- 下面硬币（透明背景） -->
          <div class="pack-drag-item" id="dragCoin" data-type="coin" data-key="${coinKey}" title="拖动或点击装入硬币">
            <span class="pack-coin-preview ${coinKey === 'blue' ? 'coin-is-blue' : ''}" style="--cc:${coin.hex}">
              <span class="pack-coin-tint"></span>
            </span>
          </div>
        </div>
      </div>

      <button class="btn btn-primary" id="packOk" style="display:none; margin-top: 14px;">收下</button>
    </div>`, { closable: false })

  const bagDropzone = document.getElementById('packBagDropzone')
  const packBag = document.getElementById('packBag')
  const packTitle = document.getElementById('packTitle')
  const packGuideHint = document.getElementById('packGuideHint')
  const packStatusTag = document.getElementById('packStatusTag')
  const packWorkarea = document.getElementById('packWorkarea')
  const dragJewel = document.getElementById('dragJewel')
  const dragCoin = document.getElementById('dragCoin')
  const packOk = document.getElementById('packOk')

  const zipTrackContainer = document.getElementById('zipTrackContainer')
  const zipSliderThumb = document.getElementById('zipSliderThumb')
  const zipTrackSealed = document.getElementById('zipTrackSealed')

  let jewelPacked = false
  let coinPacked = false
  let readyToSeal = false
  let isSealed = false

  function onItemPacked(type) {
    if (type === 'jewel') jewelPacked = true
    if (type === 'coin') coinPacked = true

    const total = (jewelPacked ? 1 : 0) + (coinPacked ? 1 : 0)
    if (total === 1) {
      if (packStatusTag) packStatusTag.textContent = '已装入 (1/2)'
      packGuideHint.textContent = jewelPacked ? '太棒了！接着把硬币装入袋中' : '太棒了！接着把饰品装入袋中'
    } else if (total === 2 && !readyToSeal) {
      readyToSeal = true
      if (packStatusTag) {
        packStatusTag.textContent = '待封口'
        packStatusTag.className = 'pack-status-tag ready-seal'
      }
      packGuideHint.textContent = '👉 物品已装好！从左向右滑动封口'
      packTitle.textContent = '滑动咬口封袋'

      setTimeout(() => {
        packWorkarea.classList.add('center-bag')
        if (zipTrackContainer) zipTrackContainer.classList.add('ready-to-seal')
        sfx.tap()
      }, 320)
    }
  }

  // 绑定从左往右滑咬口封袋交互：拉到底直接弹出装袋成功并关闭弹窗
  function initZipSlider() {
    if (!zipTrackContainer || !zipSliderThumb) return

    const getTrackBounds = () => {
      const rect = zipTrackContainer.getBoundingClientRect()
      const thumbW = zipSliderThumb.offsetWidth || 32
      const maxDist = Math.max(10, rect.width - thumbW)
      return { rect, thumbW, maxDist }
    }

    let isSliding = false
    let lastZipTick = -1
    let currentRatio = 0
    let startPointerX = 0
    let startThumbPos = 0
    let activePointerId = null

    // 封口成功：轻快咬合，直接提示装袋成功并关闭弹窗
    function triggerSealSuccess() {
      if (isSealed) return
      isSealed = true
      isSliding = false
      currentRatio = 1

      if (activePointerId !== null) {
        try { zipTrackContainer.releasePointerCapture(activePointerId) } catch (_) {}
        activePointerId = null
      }

      const { maxDist } = getTrackBounds()

      // 滑块吸合到最右端
      zipSliderThumb.style.transition = 'left 0.12s cubic-bezier(0.18, 1, 0.3, 1)'
      zipTrackSealed.style.transition = 'width 0.12s cubic-bezier(0.18, 1, 0.3, 1)'
      zipSliderThumb.style.left = `${maxDist}px`
      zipTrackSealed.style.width = '100%'

      zipTrackContainer.classList.remove('sliding')
      zipTrackContainer.classList.add('sealed-done')
      packBag.classList.add('sealed-done')

      // 轻快密封音效
      if (sfx.seal) sfx.seal()
      else sfx.buy()

      // 核心：在弹窗关闭之前，先在弹窗中央与状态栏醒目弹出“装袋成功”！
      const packSuccessPopup = document.getElementById('packSuccessPopup')
      if (packSuccessPopup) {
        packSuccessPopup.classList.add('show')
      }
      packTitle.textContent = '🎉 装袋成功！'
      packGuideHint.textContent = '🎉 装袋成功！已放入库房'
      if (packStatusTag) {
        packStatusTag.textContent = '已封装'
        packStatusTag.className = 'pack-status-tag ready-seal'
      }

      // 全局轻提示
      toast('🎉 装袋成功！')

      // 在用户清晰看到“装袋成功”弹出并感知完成后，再优雅关闭弹窗
      setTimeout(() => {
        close()
        refresh()
      }, 620)
    }

    const updateSlideByDelta = (pointerX) => {
      if (isSealed) return
      const { maxDist } = getTrackBounds()
      const dx = pointerX - startPointerX
      const targetX = Math.max(0, Math.min(maxDist, startThumbPos + dx))
      currentRatio = maxDist > 0 ? targetX / maxDist : 1

      zipSliderThumb.style.left = `${targetX}px`
      zipTrackSealed.style.width = `${currentRatio * 100}%`

      // 咬合齿轮微音效
      const tick = Math.floor(currentRatio * 6)
      if (tick !== lastZipTick) {
        lastZipTick = tick
        if (sfx.zip) sfx.zip()
        else sfx.tap()
      }

      // 拉到接近终点（>= 82% 或距右端小于 16px）时，立即完成封口！
      if (currentRatio >= 0.82 || targetX >= maxDist - 16) {
        triggerSealSuccess()
      }
    }

    const onPointerDown = (e) => {
      if (!readyToSeal || isSealed) return
      isSliding = true
      lastZipTick = -1
      activePointerId = e.pointerId
      try { zipTrackContainer.setPointerCapture(activePointerId) } catch (_) {}

      const { rect, thumbW, maxDist } = getTrackBounds()
      const clickX = e.clientX - rect.left

      startPointerX = e.clientX
      const curLeft = parseFloat(zipSliderThumb.style.left) || 0

      if (clickX > curLeft + thumbW + 10) {
        startThumbPos = Math.max(0, Math.min(maxDist, clickX - thumbW / 2))
      } else {
        startThumbPos = curLeft
      }

      zipTrackContainer.classList.add('sliding')
      zipSliderThumb.style.transition = 'none'
      zipTrackSealed.style.transition = 'none'

      updateSlideByDelta(e.clientX)
    }

    const onPointerMove = (e) => {
      if (!isSliding || isSealed) return
      updateSlideByDelta(e.clientX)
    }

    const onPointerUp = (e) => {
      if (!isSliding || isSealed) return
      isSliding = false
      if (activePointerId !== null) {
        try { zipTrackContainer.releasePointerCapture(activePointerId) } catch (_) {}
        activePointerId = null
      }
      zipTrackContainer.classList.remove('sliding')

      // 松手时如果超过 75% 也直接判定封口成功
      if (currentRatio >= 0.75) {
        triggerSealSuccess()
      } else {
        // 未到底，平滑阻尼回弹
        currentRatio = 0
        zipSliderThumb.style.transition = 'left 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)'
        zipTrackSealed.style.transition = 'width 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)'
        zipSliderThumb.style.left = '0px'
        zipTrackSealed.style.width = '0%'
        packGuideHint.textContent = '从左向右滑动封口哦～ 👉'
        setTimeout(() => {
          if (!isSealed) {
            zipSliderThumb.style.transition = ''
            zipTrackSealed.style.transition = ''
          }
        }, 260)
      }
    }

    zipTrackContainer.addEventListener('pointerdown', onPointerDown)
    zipTrackContainer.addEventListener('pointermove', onPointerMove)
    zipTrackContainer.addEventListener('pointerup', onPointerUp)
    zipTrackContainer.addEventListener('pointercancel', onPointerUp)
  }

  initZipSlider()

  // 顺滑飞入装袋动画：饰品与硬币拖到盲袋后直接消失入袋
  function flyItemIntoBag(el, type, curVisualRect) {
    el.dataset.packed = 'true'
    el.classList.remove('dragging')
    el.style.pointerEvents = 'none'
    el.style.opacity = '0'

    const bagRect = packBag.getBoundingClientRect()
    const targetCenterX = bagRect.left + bagRect.width / 2
    const targetCenterY = bagRect.top + bagRect.height / 2 + 10

    // 创建飞行代理克隆节点，从松手当前位置平滑滑向袋口中心缩放消失
    const clone = el.cloneNode(true)
    clone.id = ''
    clone.style.position = 'fixed'
    clone.style.left = `${curVisualRect.left}px`
    clone.style.top = `${curVisualRect.top}px`
    clone.style.width = `${curVisualRect.width}px`
    clone.style.height = `${curVisualRect.height}px`
    clone.style.zIndex = '9999'
    clone.style.pointerEvents = 'none'
    clone.style.margin = '0'
    clone.style.opacity = '1'
    clone.style.transform = 'scale(1)'
    clone.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease-in'
    document.body.appendChild(clone)

    const deltaX = targetCenterX - (curVisualRect.left + curVisualRect.width / 2)
    const deltaY = targetCenterY - (curVisualRect.top + curVisualRect.height / 2)

    requestAnimationFrame(() => {
      clone.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.2)`
      clone.style.opacity = '0'
    })

    setTimeout(() => {
      clone.remove()
      if (type === 'coin') {
        sfx.coin()
      } else {
        sfx.tap()
      }
      bagDropzone.classList.add('swallow')
      setTimeout(() => bagDropzone.classList.remove('swallow'), 300)
      onItemPacked(type)
    }, 260)
  }

  function bindDraggable(el, type) {
    let isDown = false
    let isDragging = false
    let startX = 0
    let startY = 0
    let pointerId = null

    const onPointerDown = (e) => {
      if (el.dataset.packed === 'true' || readyToSeal) return
      isDown = true
      isDragging = false
      startX = e.clientX
      startY = e.clientY
      pointerId = e.pointerId
      try { el.setPointerCapture(pointerId) } catch (_) {}
      el.style.transition = 'none'
    }

    const onPointerMove = (e) => {
      if (!isDown || e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (!isDragging && Math.hypot(dx, dy) > 4) {
        isDragging = true
        el.classList.add('dragging')
      }
      if (isDragging) {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(1.15)`
        const bagRect = packBag.getBoundingClientRect()
        const isOver = (
          e.clientX >= bagRect.left - 20 &&
          e.clientX <= bagRect.right + 20 &&
          e.clientY >= bagRect.top - 20 &&
          e.clientY <= bagRect.bottom + 20
        )
        bagDropzone.classList.toggle('drag-over', isOver)
      }
    }

    const onPointerUp = (e) => {
      if (!isDown || e.pointerId !== pointerId) return
      isDown = false
      try { el.releasePointerCapture(pointerId) } catch (_) {}
      bagDropzone.classList.remove('drag-over')

      const curRect = el.getBoundingClientRect()
      const bagRect = packBag.getBoundingClientRect()
      const isOver = (
        e.clientX >= bagRect.left - 25 &&
        e.clientX <= bagRect.right + 25 &&
        e.clientY >= bagRect.top - 25 &&
        e.clientY <= bagRect.bottom + 25
      )
      const isTap = !isDragging || Math.hypot(e.clientX - startX, e.clientY - startY) < 6

      if (isOver || isTap) {
        flyItemIntoBag(el, type, curRect)
      } else {
        el.classList.remove('dragging')
        el.style.transition = 'transform 0.25s cubic-bezier(0.2, 1.2, 0.4, 1)'
        el.style.transform = ''
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
  }

  bindDraggable(dragJewel, 'jewel')
  bindDraggable(dragCoin, 'coin')
}

function autoDistribute(n) {
  const coins = {}
  COIN_KEYS.forEach((k) => { coins[k] = 0 })
  const stdKeys = ['red', 'gold', 'blue', 'purple', 'green']
  for (let i = 0; i < n; i++) {
    if (i === 0 && Math.random() < 0.25) {
      coins['secret_s']++
    } else if (i === 1 && Math.random() < 0.15) {
      coins['secret_b']++
    } else {
      coins[stdKeys[i % stdKeys.length]]++
    }
  }
  return coins
}

function wirePackedActions(body) {
  body.querySelectorAll('[data-unpack]').forEach((b) => {
    b.onclick = () => {
      const s = getState()
      unpackCategory(s, b.dataset.unpack)
      sfx.tap()
      refresh()
    }
  })
}

// ---------- 图鉴 ----------
function renderCodex(body) {
  const s = getState()
  body.innerHTML = CAT_KEYS.map((cat) => {
    const list = DESIGNS.filter((d) => d.cat === cat)
    const got = list.filter((d) => s.codex.includes(d.id) || (d.rarity === 'limited' && s.vault.some((v) => v.designId === d.id))).length
    return `<div class="codex-cat">
      <div class="codex-head">${icon(cat, 18)}<span>${CATS[cat].name}</span><em>${got}/${list.length}</em></div>
      <div class="codex-grid">
        ${list.map((d) => {
          const unlocked = s.codex.includes(d.id)
          if (d.rarity === 'limited') {
            if (!unlocked) {
              const subText = ENABLE_GEM_CHANNEL ? '宝石镶嵌解锁' : '暂未开放'
              return `<div class="dcard rc-limited locked"><div class="dcard-ic">${icon(d, 24)}</div><div class="dcard-nm">？？？</div><div class="dcard-sub">${subText}</div></div>`
            }
            const held = s.vault.filter((v) => v.designId === d.id).length
            return designCard(d, { sub: `限定 · 待售 ${held}` })
          }
          return designCard(d, { locked: !unlocked, count: unlocked ? (s.stock[d.id] || 0) : null })
        }).join('')}
      </div>
    </div>`
  }).join('')
}

// ---------- 宝石市场 ----------
function renderGem(body) {
  const s = getState()
  if (s.fans < GEM_MARKET_FANS) {
    body.innerHTML = `<div class="gem-locked">
      <div class="gem-lock-ic">💎</div>
      <h3>宝石市场尚未开放</h3>
      <p>粉丝达到 <b>10,000</b>（腰部主播）后解锁：<br>购买宝石 → 镶嵌成限定饰品 → 直接上架直播间卖高价。</p>
      <p class="gem-progress">当前粉丝：${s.fans}</p>
    </div>`
    return
  }
  const market = s.gems.map((g, i) => {
    const gem = GEMS.find((x) => x.key === g.gem)
    return `<div class="gem-offer">
      <i class="gem-dot" style="--cc:${gem.hex}"></i>
      <span>${gem.name}</span>
      <b>¥${g.price}</b>
      <button class="btn btn-mini btn-primary" data-gbuy="${i}" ${s.money < g.price ? 'disabled' : ''}>买下</button>
    </div>`
  }).join('')
  const myGems = s.gems.length === 0 ? '<span class="empty-hint">背包空空，先去市场买宝石</span>' : ''
  const vaultList = s.vault.length === 0
    ? '<p class="empty-hint">还没有限定饰品。镶一颗试试？</p>'
    : s.vault.map((v) => {
      const d = designById(v.designId)
      const gem = GEMS.find((x) => x.key === v.gem)
      return `<div class="vault-row">
        <span style="color:var(--pink-deep);display:inline-flex;align-items:center;">${icon(d, 18)}</span><span class="vr-name">${d.name}</span>
        <i class="gem-dot sm" style="--cc:${gem.hex}"></i>
        <span class="vr-price">订单价 ¥${v.price}</span>
        <em>已上架</em>
      </div>`
    }).join('')

  body.innerHTML = `
    <h4 class="sec-title">今日宝石 <small>每天刷新，价格随机</small></h4>
    <div class="gem-market">${market}</div>
    <h4 class="sec-title">镶嵌台 <small>宝石 + 已解锁饰品 = 限定饰品（直接上架直播间）</small></h4>
    <div class="craft">
      <label>选择宝石</label>
      <div class="chips" id="gemChips"></div>
      <label>选择饰品</label>
      <select id="craftSel" class="sel">
        ${CAT_KEYS.map((c) => {
          const list = DESIGNS.filter((d) => d.cat === c && d.rarity !== 'limited' && s.codex.includes(d.id))
          if (list.length === 0) return ''
          return `<optgroup label="${CATS[c].name}">${list.map((d) => `<option value="${d.id}">${d.name}（${RARITIES[d.rarity].name}）</option>`).join('')}</optgroup>`
        }).join('')}
      </select>
      <button class="btn btn-primary" id="craftBtn" disabled>镶嵌成限定</button>
    </div>
    <h4 class="sec-title">我的限定饰品 <small>直播时自动出现「限定专场」订单</small></h4>
    <div class="vault">${vaultList}</div>`

  let selGem = -1
  const gemChips = body.querySelector('#gemChips')
  const craftBtn = body.querySelector('#craftBtn')
  function renderGemChips() {
    gemChips.innerHTML = s.gems.map((g, i) => {
      const gem = GEMS.find((x) => x.key === g.gem)
      return `<button class="chip chip-gem ${selGem === i ? 'on' : ''}" data-g="${i}"><i class="gem-dot sm" style="--cc:${gem.hex}"></i>${gem.name}</button>`
    }).join('') || myGems
    gemChips.querySelectorAll('[data-g]').forEach((b) => {
      b.onclick = () => { sfx.tap(); selGem = Number(b.dataset.g); renderGemChips(); craftBtn.disabled = false }
    })
  }
  renderGemChips()
  body.querySelectorAll('[data-gbuy]').forEach((b) => {
    b.onclick = () => {
      const r = buyGem(s, Number(b.dataset.gbuy))
      if (!r.ok) return toast('钱不够啦', 'warn')
      sfx.buy()
      refresh()
    }
  })
  craftBtn.onclick = () => {
    if (selGem < 0) return
    const r = craftLimited(s, selGem, body.querySelector('#craftSel').value)
    if (!r.ok) return toast('镶嵌失败', 'warn')
    sfx.legendary()
    toast(`限定饰品完成！订单价 ¥${r.price}`)
    refresh()
  }
}