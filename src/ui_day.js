// 日间界面：风向横幅 + 进货/装袋/图鉴/宝石四个页签 + 开播底栏。
import { getState, setState } from './state.js'
import {
  CATS, CAT_KEYS, RARITIES, DESIGNS, designById, BOXES,
  COINS, COIN_KEYS, GEMS, GEM_MARKET_FANS, TREND_LINES, UNLOCK_GRANT,
  STREAMS_PER_DAY,
} from './data.js'
import {
  rollBox, buyStock, packBags, unpackCategory, autoPick,
  buyGem, craftLimited, rollShop, nextDay, rollTrendStyle,
} from './engine.js'
import { designCard, icon, toast, openModal, refresh } from './ui.js'
import { sfx, burst, popIn } from './fx.js'
import { saveNow } from './save.js'
import { startLive } from './ui-live.js'

// 装袋草稿（临时态，不入档；按天保留，切页签不丢）。counts: designId -> 数量
const draft = { day: 0, cat: null, counts: {}, coins: {} }

export function renderDay(root) {
  const s = getState()
  if (draft.day !== s.day) {
    draft.day = s.day
    draft.cat = null
    draft.counts = {}
    draft.coins = {}
  }
  // 兜底：商店为空（旧档/异常路径）时当场补掷，保证首页始终有盲盒
  if (!Array.isArray(s.shop) || s.shop.length === 0) s.shop = rollShop(s)
  // 兜底：风向款式缺失时当场补掷，保证「1 品类 2 款式」始终可见
  if (!s.trend.style) s.trend.style = rollTrendStyle(s, s.trend.cat)
  const packedTotal = CAT_KEYS.reduce((n, k) => n + (s.packed[k] || []).length, 0)
  const styleName = s.trend.style ? designById(s.trend.style).name : null
  const styleUnlocked = s.trend.style && s.codex.includes(s.trend.style)
  const styleLabel = !styleName ? '款式待解锁'
    : styleUnlocked ? `「${styleName}」`
    : `【${styleName}】（未解锁）`
  root.innerHTML = `
    <div class="wind-banner">
      <div class="wind-head"><span class="wind-tag">今日风向</span>
        <span class="wind-cat">1 · ${icon(s.trend.cat, 16)} ${CATS[s.trend.cat].name}</span>
        <span class="wind-style">2 · ${styleLabel}</span>
        <span class="wind-lucky">幸运色 <i class="coin-dot sm" style="--cc:${COINS[s.trend.lucky].hex}">${COINS[s.trend.lucky].name}</i></span>
      </div>
      <p class="wind-line">${TREND_LINES[s.trend.cat]} 命中${CATS[s.trend.cat].name}订单营收 ×1.5；拆中「${styleName || '风向款式'}」每件粉丝 +1${styleName && !styleUnlocked ? '（先去把这款开出来！）' : ''}！</p>
    </div>
    <nav class="tabs">
      <button data-tab="shop" class="${s.dayTab === 'shop' ? 'on' : ''}">进货</button>
      <button data-tab="pack" class="${s.dayTab === 'pack' ? 'on' : ''}">装袋</button>
      <button data-tab="codex" class="${s.dayTab === 'codex' ? 'on' : ''}">图鉴</button>
      <button data-tab="gem" class="${s.dayTab === 'gem' ? 'on' : ''}">宝石${s.fans >= GEM_MARKET_FANS ? '' : ' 🔒'}</button>
    </nav>
    <div class="tab-body" id="tabBody"></div>
    <div class="day-bottom">
      <span class="db-info">已装袋 <b>${packedTotal}</b> 袋</span>
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
    <p class="nd-note">未卖完的盲袋会保留到明天；风向、今日盲盒与宝石市场将刷新。</p>
    <div class="nd-btns">
      <button class="btn btn-ghost" id="ndCancel">再播一天</button>
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
  else renderGem(body)
}

// ---------- 进货 ----------
function renderShop(body) {
  const s = getState()
  const offers = (s.shop || []).map((o, i) => {
    const b = BOXES[o.tier]
    const isTrend = o.cat === s.trend.cat
    return `<div class="shop-offer ${o.sold ? 'sold' : ''}">
      <span class="so-ic">${icon(o.cat, 22)}</span>
      <div class="so-main">
        <b class="so-name bk-${o.tier}">${b.name} · ${CATS[o.cat].name}</b>
        <span class="so-desc">${b.desc}</span>
      </div>
      ${isTrend ? '<span class="so-badge">风向</span>' : ''}
      <span class="so-price">¥${b.price}</span>
      ${o.sold
        ? '<button class="btn btn-mini" disabled>已售出</button>'
        : `<button class="btn btn-mini btn-primary" data-offer="${i}" ${s.money < b.price ? 'disabled' : ''}>购买</button>`}
    </div>`
  }).join('')

  const restockRows = CAT_KEYS.map((cat) => {
    const list = DESIGNS.filter((d) => d.cat === cat && d.rarity !== 'limited' && s.codex.includes(d.id))
    if (list.length === 0) return ''
    return `<div class="restock-cat">
      <div class="restock-head">${icon(cat, 16)}${CATS[cat].name}补货</div>
      ${list.map((d) => {
        const p = RARITIES[d.rarity].unitPrice
        return `<div class="restock-row">
          <i class="rr-dot" style="--cc:${RARITIES[d.rarity].color}"></i>
          <span class="rr-name">${d.name}</span>
          <span class="rr-stock">库存 ${s.stock[d.id] || 0}</span>
          <span class="rr-price">¥${p}</span>
          <button class="btn btn-mini" data-buy="${d.id}" data-n="1" ${s.money < p ? 'disabled' : ''}>+1</button>
          <button class="btn btn-mini" data-buy="${d.id}" data-n="5" ${s.money < p * 5 ? 'disabled' : ''}>+5</button>
        </div>`
      }).join('')}
    </div>`
  }).join('')

  body.innerHTML = `
    <h4 class="sec-title">今日盲盒 <small>每天随机刷新 5 盒（保底 2 盒风向款），买完即售罄</small></h4>
    <div class="shop-offers">${offers}</div>
    <h4 class="sec-title">款式补货</h4>
    <div class="restock">${restockRows || '<p class="empty-hint">还没有解锁任何款式，先开几个盲盒吧</p>'}</div>`

  body.querySelectorAll('[data-offer]').forEach((b) => {
    b.onclick = () => {
      const offer = s.shop[Number(b.dataset.offer)]
      openBoxModal(offer.cat, offer.tier, Number(b.dataset.offer))
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

// 开盒动画弹窗（购买商店 offer 时标记售罄）
function openBoxModal(cat, tierKey, offerIdx = null) {
  const s = getState()
  const box = BOXES[tierKey]
  const result = rollBox(s, cat, tierKey)
  if (!result.ok) return toast('钱不够啦', 'warn')
  if (offerIdx != null && s.shop[offerIdx]) s.shop[offerIdx].sold = true
  const { close } = openModal(`
    <div class="boxstage">
      <div class="box3d bk-${tierKey}" id="box3d"><span>${box.name}</span><em>${CATS[cat].name}</em></div>
      <div class="box-items" id="boxItems"></div>
      <button class="btn btn-primary" id="boxOk" style="visibility:hidden">收下</button>
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
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2, ['#FFD98E', '#FF7EB6', '#7DE2D1'], 22)
    sfx.tear()
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
  body.innerHTML = `<p class="pack-hint">每袋装 <b>1 件饰品 + 1 枚硬币</b>。硬币想怎么配就怎么配——同色硬币越多，对对碰连得越狠。</p>` +
    CAT_KEYS.map((cat) => {
      const packed = s.packed[cat] || []
      const stockN = CAT_KEYS_stockOf(s, cat)
      const open = draft.cat === cat
      return `<div class="pack-card ${open ? 'open' : ''}">
        <button class="pack-head" data-cat="${cat}">
          ${icon(cat, 20)}<span>${CATS[cat].name}</span>
          <em>库存 ${stockN} · 已装 ${packed.length} 袋</em><i class="arr">${open ? '▾' : '▸'}</i>
        </button>
        ${open ? packPanel(s, cat) : packedSummary(s, cat)}
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

function packedSummary(s, cat) {
  const packed = s.packed[cat] || []
  if (packed.length === 0) return ''
  const byDesign = {}
  const byCoin = {}
  for (const b of packed) {
    byDesign[b.a] = (byDesign[b.a] || 0) + 1
    byCoin[b.c] = (byCoin[b.c] || 0) + 1
  }
  return `<div class="packed-sum">
    ${Object.entries(byDesign).map(([id, n]) => `<span class="chip">${designById(id).name} ×${n}</span>`).join('')}
    <span class="chip coins">${Object.entries(byCoin).map(([k, n]) => `<i class="coin-dot sm" style="--cc:${COINS[k].hex}">${COINS[k].name}${n}</i>`).join('')}</span>
    <button class="btn btn-mini btn-danger" data-unpack="${cat}">撤回</button>
  </div>`
}

function packPanel(s, cat) {
  const rows = DESIGNS.filter((d) => d.cat === cat && d.rarity !== 'limited' && s.codex.includes(d.id))
    .map((d) => {
      const stock = s.stock[d.id] || 0
      const n = draft.counts[d.id] || 0
      return `<div class="pack-row ${stock === 0 ? 'off' : ''}">
        <i class="rr-dot" style="--cc:${RARITIES[d.rarity].color}"></i>
        <span class="pr-name">${d.name}</span>
        <span class="pr-stock">库存 ${stock}</span>
        <div class="pr-step">
          <button class="cs-btn" data-dec="${d.id}" ${n === 0 ? 'disabled' : ''}>−</button>
          <b class="cs-n">${n}</b>
          <button class="cs-btn" data-inc="${d.id}" ${stock === 0 || n >= stock ? 'disabled' : ''}>＋</button>
        </div>
      </div>`
    }).join('')
  const n = draftTotal()
  const coinSum = COIN_KEYS.reduce((a, k) => a + (draft.coins[k] || 0), 0)
  const coinRows = COIN_KEYS.map((k) => `
    <div class="coin-step">
      <i class="coin-dot" style="--cc:${COINS[k].hex}">${COINS[k].name}</i>
      <span class="coin-eff">${COINS[k].pair}</span>
      <button class="cs-btn" data-coin="${k}" data-d="-1">−</button>
      <b class="cs-n">${draft.coins[k] || 0}</b>
      <button class="cs-btn" data-coin="${k}" data-d="1">＋</button>
    </div>`).join('')
  const ready = n > 0 && coinSum === n
  return `<div class="pack-panel">
    <div class="pp-sec"><label>选饰品（每款用 ± 调数量）</label>
      <div class="pack-rows">${rows || '<span class="empty-hint">该品类还没有解锁款式，先去进货</span>'}</div>
      ${n ? `<span class="pp-count">共 ${n} 袋</span>` : ''}
    </div>
    <div class="pp-sec"><label>配硬币（总数须 = ${n || 0}，同色越多对对碰越猛）<button class="btn btn-mini" data-act="autocoin" ${n === 0 ? 'disabled' : ''}>自动配币</button></label>
      <div class="coin-steps">${coinRows}</div>
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
  body.querySelectorAll('[data-coin]').forEach((b) => {
    b.onclick = () => {
      sfx.tap()
      const k = b.dataset.coin
      draft.coins[k] = Math.max(0, (draft.coins[k] || 0) + Number(b.dataset.d))
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
    const r = packBags(s, cat, picks, autoDistribute(picks.length))
    if (!r.ok) return toast('装袋失败', 'warn')
    playPackModal(cat, picks.length)
    draft.counts = {}
    draft.coins = {}
  }
  const confirm = body.querySelector('[data-act="confirm"]')
  if (confirm) confirm.onclick = () => {
    const s = getState()
    const cat = confirm.dataset.cat
    const picks = draftPicks()
    const r = packBags(s, cat, picks, { ...draft.coins })
    if (!r.ok) {
      if (r.reason === 'coinSum') return toast('硬币总数要等于袋数', 'warn')
      return toast('库存不足', 'warn')
    }
    playPackModal(cat, picks.length)
    draft.counts = {}
    draft.coins = {}
  }
}

// 装袋动画弹窗：银袋收拢晃动 → 完成
function playPackModal(cat, n) {
  const { close } = openModal(`
    <div class="boxstage">
      <div class="bag silver pack-anim" id="packBag"><div class="bag-body"><span class="bag-cat">${icon(cat, 22)}</span></div></div>
      <b class="pack-title">正在装袋…</b>
      <span class="pack-num">${CATS[cat].name}盲袋 × ${n}</span>
      <button class="btn btn-primary" id="packOk" style="visibility:hidden">收下</button>
    </div>`, { closable: false })
  const el = document.getElementById('packBag')
  setTimeout(() => {
    el.classList.add('shaking')
    sfx.tap()
  }, 80)
  setTimeout(() => {
    el.classList.remove('shaking')
    el.classList.add('done')
    const rect = el.getBoundingClientRect()
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2, ['#FFD98E', '#FF7EB6'], 16)
    sfx.buy()
    document.querySelector('.pack-title').textContent = '装好啦！'
    document.getElementById('packOk').style.visibility = 'visible'
    document.getElementById('packOk').onclick = () => { close(); refresh() }
  }, 950)
}

function autoDistribute(n) {
  const coins = {}
  COIN_KEYS.forEach((k) => { coins[k] = 0 })
  for (let i = 0; i < n; i++) coins[COIN_KEYS[i % COIN_KEYS.length]]++
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
              return `<div class="dcard rc-limited locked"><div class="dcard-ic">💎</div><div class="dcard-nm">？？？</div><div class="dcard-sub">宝石镶嵌解锁</div></div>`
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
        ${icon(d.cat, 18)}<span class="vr-name">${d.name}</span>
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