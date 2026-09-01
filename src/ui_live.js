// 直播界面：三区布局（直播画面 / 展示 / 待拆）、先拆完再对对碰、订单色、收获弹窗、直播热度。
import { getState, setState } from './state.js'
import {
  CATS, CAT_KEYS, COINS, COIN_KEYS, RARITIES, DANMAKU, ORDER_BASE, ORDER_PER_BAG, TREND_MULT,
  GEMS, designById, GUARANTEE_MIN, STREAMS_PER_DAY, HEAT_START_RATE, HEAT_FAN_BONUS,
} from './data.js'
import { planStream, newOrderSession, openBag, resolvePairs, finishOrder, settleDay, nextDay } from './engine.js'
import { freshStats } from './state.js'
import { updateTopbarNumbers, toast, icon, openModal } from './ui.js'
import { sfx, floatText, burst, popIn } from './fx.js'
import { saveNow } from './save.js'

let session = null
let timers = []

export function clearLiveTimers() {
  timers.forEach((t) => clearInterval(t))
  timers = []
}

export function startLive() {
  const s = getState()
  if (s.streamsLeft <= 0) return toast('今天的直播场次用完啦，先休息吧', 'warn')
  if (!s.stats) s.stats = freshStats()
  const orders = planStream(s)
  if (orders.length === 0) return toast('先去装袋，再开播', 'warn')
  session = {
    orders, idx: -1, ctx: null, order: null,
    heat: Math.ceil(s.fans * HEAT_START_RATE), // 初始热度 = 粉丝数 ×15%
  }
  setState({ screen: 'live' })
  saveNow()
}

// ---------- 直播屏 ----------

export function renderLive(root) {
  const s = getState()
  root.innerHTML = `
    <div class="live-wrap">
      <div class="live-head">
        <span class="live-dot"></span><b>直播中</b>
        <span class="live-heat" id="heatWrap" title="每拆一袋 +1 热度；下播时热度超过粉丝数，全场涨粉 5%">热度：<b id="heatNum">0</b></span>
        <span class="live-trend">风向 ${CATS[s.trend.cat].name}${s.trend.style ? ` · 风向款 ${designById(s.trend.style).name}` : ''}</span>
        <span class="live-count">今日剩 ${s.streamsLeft} 场</span>
      </div>
      <div class="stage" id="stage"></div>
      <div class="live-foot">
        <span>营收 <b id="lfEarn">¥${s.stats.earn}</b></span>
        <span>订单 <b id="lfOrders">${s.stats.ordersDone}</b></span>
        <span>对碰 <b id="lfPairs">${s.stats.pairs}</b></span>
        <span>粉丝 <b id="lfFans">+${s.stats.fansToday}</b></span>
        <span>剩余盲袋 <b id="lfBags">${CAT_KEYS.reduce((n, k) => n + (s.packed[k] || []).length, 0)}</b></span>
        <button class="btn btn-mini btn-end" id="lfEnd">下播</button>
      </div>
    </div>`

  root.querySelector('#lfEnd').onclick = () => endEarly()
  updateHeat()
  const stage = root.querySelector('#stage')
  stage.innerHTML = `<div class="live-intro"><div class="li-ic">📡</div><b>直播准备中…</b><span>观众正在涌入</span></div>`
  spawnDanmaku(DANMAKU.enter, 4)
  timers.push(setTimeout(() => nextOrder(stage), 1400))
}

// 热度：初始 = 粉丝×15%，每拆一袋 +1；超过粉丝数即「破圈」高亮
function updateHeat() {
  const s = getState()
  const num = document.getElementById('heatNum')
  const wrap = document.getElementById('heatWrap')
  if (!num || !wrap) return
  num.textContent = `${session.heat} / ${s.fans}`
  wrap.classList.toggle('hot', session.heat > s.fans)
}

// 提前下播：当前订单未拆则直接收工，拆到一半则先结掉这单
function endEarly() {
  const s = getState()
  const stage = document.getElementById('stage')
  if (!session || !session.ctx || session.ctx.done || session.order?.type === 'limited' || !stage) return endStream(stage)
  const r = finishOrder(s, session.order, session.ctx)
  updateTopbarNumbers(s)
  floatText(document.querySelector('.live-foot'), `+¥${r.price}`, '#FFD98E')
  toast(`这单提前收尾 +¥${r.price}`)
  endStream(stage)
}

function startDanmaku() {
  timers.push(setInterval(() => {
    if (document.getElementById('danmaku')) spawnDanmaku(DANMAKU.generic, 1)
  }, 2600))
}

function spawnDanmaku(pool, n = 1) {
  const layer = document.getElementById('danmaku')
  if (!layer) return
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span')
    el.className = 'dm'
    el.textContent = pool[Math.floor(Math.random() * pool.length)]
    el.style.right = `${10 + Math.random() * 70}px`
    el.style.animationDuration = `${3.5 + Math.random() * 2}s`
    el.style.fontSize = `${11 + Math.random() * 4}px`
    layer.appendChild(el)
    el.addEventListener('animationend', () => el.remove())
  }
}

function updateFoot() {
  const s = getState()
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v }
  set('lfEarn', `¥${s.stats.earn}`)
  set('lfOrders', s.stats.ordersDone)
  set('lfPairs', s.stats.pairs)
  set('lfFans', `+${s.stats.fansToday}`)
  set('lfBags', CAT_KEYS.reduce((n, k) => n + (s.packed[k] || []).length, 0))
}

function nextOrder(stage) {
  const s = getState()
  session.idx++
  if (session.idx >= session.orders.length) return endStream(stage)
  session.order = session.orders[session.idx]
  session.ctx = newOrderSession(session.order)
  const o = session.order

  if (o.type === 'limited') {
    const item = o.item
    const d = designById(item.designId)
    const gem = GEMS.find((g) => g.key === item.gem)
    stage.innerHTML = `
      <div class="order-card limited">
        <div class="oc-tag">限定专场</div>
        <div class="oc-limited">
          <span class="oc-lim-ic">💎</span>
          <div><b>${d.name}</b><span>镶嵌 ${gem.name} · 绝版限定</span></div>
        </div>
        <div class="oc-price">直售价 <b>¥${item.price}</b></div>
        <div class="oc-btns">
          <button class="btn btn-primary btn-big" id="ocGo">上架售出</button>
          <button class="btn btn-ghost" id="ocSkip">下播</button>
        </div>
      </div>`
    spawnDanmaku(DANMAKU.limited, 3)
    sfx.rare()
    stage.querySelector('#ocGo').onclick = () => { completeOrder(stage) }
    stage.querySelector('#ocSkip').onclick = () => endStream(stage)
    popIn(stage.querySelector('.order-card'))
    return
  }

  const trendHit = o.cat === s.trend.cat
  const est = Math.round((ORDER_BASE + o.size * ORDER_PER_BAG) * (trendHit ? TREND_MULT : 1))
  stage.innerHTML = `
    <div class="order-card">
      <div class="oc-tag ${trendHit ? 'hot' : ''}">订单 ${session.idx + (session.orders[0].type === 'limited' ? 0 : 1)}${trendHit ? ' · 命中风向 ×1.5' : ''}</div>
      <div class="oc-main">
        <span class="oc-cat">${icon(o.cat, 30)}</span>
        <div class="oc-info"><b>${CATS[o.cat].name}盲袋 × ${o.size}</b><span>保底 ${GUARANTEE_MIN} 袋 · 拆完统一对对碰</span></div>
        <div class="oc-price">预估 <b>¥${est}</b></div>
      </div>
      <div class="oc-btns">
        <button class="btn btn-primary btn-big" id="ocGo">开拆</button>
        <button class="btn btn-ghost" id="ocSkip">下播</button>
      </div>
    </div>`
  spawnDanmaku(DANMAKU.order, 2)
  stage.querySelector('#ocGo').onclick = () => renderBagArea(stage)
  stage.querySelector('#ocSkip').onclick = () => endStream(stage)
  popIn(stage.querySelector('.order-card'))
}

// ---------- 三区拆袋舞台 ----------

function renderBagArea(stage) {
  const o = session.order
  const s = getState()
  stage.innerHTML = `
    <div class="bag-area3">
      <section class="lv-cam">
        <div class="lv-tag">直播画面</div>
        <div class="danmaku" id="danmaku"></div>
        <div class="lv-active" id="lvActive"><div class="lv-hint">点下方盲袋开拆</div></div>
      </section>
      <section class="lv-show">
        <div class="lv-tag">展示</div>
        <div class="show-colors">
          <span class="oc-chip">订单色 <i class="coin-dot sm" style="--cc:${COINS[o.lucky].hex}">${COINS[o.lucky].name}</i> 拆到加一袋</span>
          <span class="oc-chip dim">今日幸运 <i class="coin-dot sm" style="--cc:${COINS[s.trend.lucky].hex}">${COINS[s.trend.lucky].name}</i> 触发该色buff</span>
        </div>
        <div class="buff-row" id="buffList"></div>
        <div class="lv-mid">
          <div class="lv-box"><div class="lv-panel-title">首饰盒</div><div class="lv-box-items" id="lvBoxItems"><span class="lv-empty">空</span></div></div>
          <div class="lv-tray"><div class="lv-panel-title">木盘</div><div class="lv-tray-coins" id="lvTrayCoins"><span class="lv-empty">空</span></div></div>
        </div>
      </section>
      <section class="lv-pend">
        <div class="lv-tag">待拆</div>
        <div class="lv-queue" id="lvQueue"></div>
        <div class="lv-extra" id="lvExtra"></div>
      </section>
    </div>`
  const row = stage.querySelector('#lvQueue')
  for (let i = 0; i < o.size; i++) row.appendChild(makeBag(o, false))
}

function makeBag(o, bonus) {
  const b = document.createElement('button')
  b.className = 'bag silver' + (bonus ? ' bonus' : '')
  b.innerHTML = `<div class="bag-body"><span class="bag-cat">${icon(o.cat, 18)}</span>${bonus ? '<em class="bag-plus">+1</em>' : ''}</div>`
  b.onclick = () => openOne(b)
  return b
}

// 把袋从待拆区移到直播画面拆开；饰品入首饰盒（同款合并 ×N），硬币入木盘（拆完后统一对碰）
function openOne(bagEl) {
  if (bagEl.classList.contains('opening') || bagEl.classList.contains('opened') || bagEl.classList.contains('stockout')) return
  const s = getState()
  const o = session.order
  const ctx = session.ctx
  const active = document.getElementById('lvActive')
  if (!active || ctx.done || ctx.queue <= 0) return

  const q0 = ctx.queue
  const ev = openBag(s, o, ctx)
  if (!ev) return
  bagEl.classList.add('opening')
  session.heat++
  updateHeat()
  updateFoot()

  const mover = bagEl.cloneNode(true)
  mover.classList.remove('opening')
  mover.classList.add('moving')
  bagEl.style.visibility = 'hidden'
  active.innerHTML = ''
  active.appendChild(mover)
  sfx.tear()

  setTimeout(() => {
    mover.classList.add('opened')
    const queue = document.getElementById('lvQueue')

    if (ev.slot === 'stockout') {
      mover.classList.add('stockout')
      mover.innerHTML = `<div class="bag-body"><span class="bag-miss">缺货</span></div>`
      sfx.bad()
      spawnDanmaku(DANMAKU.stockout, 2)
      floatText(mover, '缺货 -2 评价', '#FF5A5A')
      bagEl.remove()
      checkPhase(queue)
      return
    }
    if (ev.slot === 'void') {
      bagEl.remove()
      checkPhase(queue)
      return
    }

    bagEl.remove()
    const r = RARITIES[ev.design.rarity]
    mover.innerHTML = `
      <div class="bag-reveal rc-${ev.design.rarity}">
        <span class="br-ic">${icon(ev.design.cat, 20)}</span>
        <span class="br-name">${ev.design.name}</span>
        <i class="coin-dot" style="--cc:${COINS[ev.coin].hex}">${COINS[ev.coin].name}</i>
      </div>`
    if (ev.design.rarity === 'legendary') sfx.legendary()
    else if (ev.design.rarity === 'epic') sfx.rare()
    else sfx.coin()
    const rect = mover.getBoundingClientRect()
    if (ev.design.rarity === 'epic' || ev.design.rarity === 'legendary') {
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2, [r.color, '#FFF'], 16)
      spawnDanmaku(ev.design.rarity === 'legendary' ? DANMAKU.legendary : DANMAKU.epic, 3)
      floatText(mover, `${r.name}·${ev.design.name}`, r.color, true)
    }
    if (ev.styleHit) {
      floatText(mover, '风向款！粉丝 +1', '#7DE2D1', true)
      spawnDanmaku(['风向款拆到了！', '就是这个！买爆！'], 2)
    }
    if (ev.luckyHit) {
      sfx.coin()
      floatText(mover, '订单色 +1 袋', COINS[ev.coin].hex)
      spawnDanmaku(DANMAKU.lucky, 2)
    }
    if (ev.dailyBuff) {
      floatText(mover, `今日幸运·${ev.dailyBuff.name} ${ev.dailyBuff.desc}`, '#FF7EB6', true)
      spawnDanmaku(['今日幸运色！buff来了！'], 2)
      sfx.coin()
      if (ev.dailyBuff.key === 'heat') { session.heat += 10; updateHeat() }
      renderBuffs()
    }

    // 饰品入首饰盒（同款合并 ×N）
    renderBoxItems()
    // 硬币入木盘（此时不成对，拆完后统一结算）
    addToTray(ev.coin)

    // 加袋：订单幸运色 / 今日幸运「加量装袋」 / 对碰加袋都走 queue
    const newBags = ctx.queue - (q0 - 1)
    if (newBags > 0 && queue) for (let i = 0; i < newBags; i++) queue.appendChild(makeBag(o, true))

    checkPhase(queue)
  }, 260)
}

// 首饰盒内容：从本单已拆记录聚合渲染（同款 → ×N）
function renderBoxItems() {
  const box = document.getElementById('lvBoxItems')
  if (!box) return
  const ctx = session.ctx
  const byId = {}
  const orderIds = []
  for (const o of ctx.opened) {
    if (!o.design) continue
    if (!byId[o.design.id]) { byId[o.design.id] = { d: o.design, n: 0, style: false } ; orderIds.push(o.design.id) }
    byId[o.design.id].n++
    if (s_trendStyle() === o.design.id) byId[o.design.id].style = true
  }
  box.innerHTML = orderIds.length === 0
    ? '<span class="lv-empty">空</span>'
    : orderIds.map((id) => {
      const it = byId[id]
      return `<span class="box-jewel rc-${it.d.rarity}${it.style ? ' style-hit' : ''}">${icon(it.d.cat, 14)}${it.d.name}${it.n > 1 ? ` ×${it.n}` : ''}</span>`
    }).join('')
}

function s_trendStyle() {
  return getState().trend.style
}

// 木盘：追加硬币 chip（拆完统一对碰后飞出）
function addToTray(coinKey) {
  const tray = document.getElementById('lvTrayCoins')
  if (!tray) return
  tray.querySelector('.lv-empty')?.remove()
  const chip = document.createElement('span')
  chip.className = 'tray-coin'
  chip.dataset.c = coinKey
  chip.innerHTML = `<i class="coin-dot" style="--cc:${COINS[coinKey].hex}">${COINS[coinKey].name}</i>`
  tray.appendChild(chip)
  popIn(chip)
}

// 对对碰结算后：只把被配对消耗的硬币原地渐变淡出，没凑成对的单枚留在木盘里等下轮
function fadeOutPairedCoins(paired) {
  const tray = document.getElementById('lvTrayCoins')
  if (!tray) return
  // 每种颜色本轮消耗 2×对数 枚
  const consume = {}
  paired.forEach((k) => { consume[k] = (consume[k] || 0) + 2 })
  const toFade = []
  for (const [k, n] of Object.entries(consume)) {
    toFade.push(...[...tray.querySelectorAll(`.tray-coin[data-c="${k}"]`)].slice(0, n))
  }
  if (toFade.length === 0) return
  toFade.forEach((chip, i) => {
    chip.animate([
      { transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' },
      { transform: 'scale(1.18) translateY(-4px)', opacity: 0.8, filter: 'brightness(1.45)', offset: 0.35 },
      { transform: 'scale(0.85) translateY(-14px)', opacity: 0, filter: 'brightness(1.7)' },
    ], { duration: 850, delay: i * 70, easing: 'ease-out', fill: 'forwards' }).onfinish = () => {
      chip.remove()
      // 全部收走后才补「空」占位；还有零散硬币就保持木盘状态
      if (!tray.querySelector('.tray-coin') && !tray.querySelector('.lv-empty')) {
        const empty = document.createElement('span')
        empty.className = 'lv-empty'
        empty.textContent = '空'
        tray.appendChild(empty)
      }
    }
  })
}

// 本单 buff 展示（展示区内追加 chip）
function renderBuffs() {
  const list = document.getElementById('buffList')
  if (!list) return
  const buffs = session.ctx.buffs || []
  list.innerHTML = buffs.length === 0
    ? ''
    : buffs.map((b) => `<span class="oc-chip buff">✨ ${b.name}·${b.desc}</span>`).join('')
}

// 阶段推进：拆完 → 对对碰 → 还有袋继续拆 / 保底补拆 / 完成订单
function checkPhase(queue) {
  const ctx = session.ctx
  if (!queue || ctx.done) return
  const pending = queue.querySelectorAll('.bag:not(.opened):not(.stockout)').length
  if (ctx.queue > 0 || pending > 0) return

  // 全拆完 → 统一结算对对碰：弹窗展示一共几对，点继续再飞币回流
  const paired = resolvePairs(session.order, ctx)
  if (paired.length > 0) {
    // 蓝币对碰：热度 +1/对
    const bluePairs = paired.filter((k) => k === 'blue').length
    if (bluePairs > 0) { session.heat += bluePairs; updateHeat() }
    showPairModal(paired, queue)
    return
  }

  renderExtra(queue)
}

// 对对碰结算弹窗：列出每一对的颜色与效果；木盘被完全清空时触发「清盘」奖励
function showPairModal(paired, queue) {
  const ctx = session.ctx
  // 清盘：本轮对碰后所有颜色都不剩零散单枚，木盘全空
  const cleared = COIN_KEYS.every((k) => !(ctx.tally[k] || 0))
  if (cleared) ctx.queue += 3 // 清盘奖励：另加三袋盲袋
  const rows = paired.map((k, i) => `
    <div class="pair-row">
      <span class="pair-idx">${i + 1}</span>
      <i class="coin-dot sm" style="--cc:${COINS[k].hex}">${COINS[k].name}</i>
      <span class="pair-eff">${COINS[k].pair}</span>
    </div>`).join('')
  const { close } = openModal(`
    <h3 class="m-title">对对碰 × ${paired.length}</h3>
    <div class="pair-list">${rows}</div>
    ${cleared ? '<div class="clear-banner">🎉 清盘！另加三袋盲袋</div>' : ''}
    <p class="pair-note">本轮加拆 ${ctx.queue} 袋${cleared ? '' : '；配对成功的硬币已收走，没凑成对的原地留着等下一轮'}</p>
    <button class="btn btn-primary btn-big" id="pairGo">继续拆袋</button>
  `, { closable: false })
  sfx.pair()
  if (cleared) sfx.legendary()
  spawnDanmaku(DANMAKU.pair, 3)
  if (cleared) spawnDanmaku(['清盘了！！', '木盘都被碰空了！', '这就是欧皇吗'], 3)
  document.getElementById('pairGo').onclick = () => {
    sfx.tap()
    close()
    fadeOutPairedCoins(paired)
    for (let i = 0; i < ctx.queue; i++) queue.appendChild(makeBag(session.order, true))
  }
}

// 底部操作区：保底补拆 / 完成订单
function renderExtra(queue) {
  const extra = document.getElementById('lvExtra')
  const ctx = session.ctx
  if (!extra) return
  extra.innerHTML = ''
  if (ctx.queue > 0) return
  if (ctx.opened.length < GUARANTEE_MIN) {
    const btn = document.createElement('button')
    btn.className = 'btn btn-ghost'
    btn.textContent = `补拆一袋（保底 ${ctx.opened.length}/${GUARANTEE_MIN}）`
    btn.onclick = () => {
      session.ctx.queue++
      queue.appendChild(makeBag(session.order, true))
      sfx.tap()
      extra.innerHTML = ''
    }
    extra.appendChild(btn)
    return
  }
  const btn = document.createElement('button')
  btn.className = 'btn btn-primary btn-big'
  btn.textContent = '完成订单'
  btn.onclick = () => completeOrder(document.getElementById('stage'))
  extra.appendChild(btn)
}

// 完成订单：收获弹窗展示本单全部所得
function completeOrder(stage) {
  const s = getState()
  const r = finishOrder(s, session.order, session.ctx)
  sfx.cash()
  updateTopbarNumbers(s)
  updateFoot()
  if (session.order.type !== 'limited' && session.order.cat === s.trend.cat) {
    spawnDanmaku(['风向单品！买爆！', '果然是今天的顶流'], 2)
  }

  // 收获清单：首饰聚合 ×N
  const byId = {}
  for (const o of session.ctx.opened) {
    if (!o.design) continue
    if (!byId[o.design.id]) byId[o.design.id] = { d: o.design, n: 0 }
    byId[o.design.id].n++
  }
  const jewels = Object.values(byId)
  const coins = {}
  for (const o of session.ctx.opened) {
    if (o.coin) coins[o.coin] = (coins[o.coin] || 0) + 1
  }
  const stockouts = session.ctx.stockouts
  const { close } = openModal(`
    <h3 class="m-title">订单完成！</h3>
    <div class="harvest">
      <div class="hv-sec"><label>本单收获（${jewels.reduce((a, b) => a + b.n, 0)} 件首饰）</label>
        <div class="hv-jewels">
          ${jewels.map((it) => `<span class="box-jewel rc-${it.d.rarity}">${icon(it.d.cat, 14)}${it.d.name}${it.n > 1 ? ` ×${it.n}` : ''}</span>`).join('') || '<span class="empty-hint">一无所获…</span>'}
        </div>
      </div>
      <div class="hv-sec"><label>硬币去向</label>
        <div class="hv-coins">
          ${Object.entries(coins).map(([k, n]) => `<span class="hv-coin"><i class="coin-dot sm" style="--cc:${COINS[k].hex}">${COINS[k].name}</i>×${n}</span>`).join('') || '<span class="empty-hint">无</span>'}
          ${stockouts ? `<span class="hv-coin miss">缺货 ×${stockouts}</span>` : ''}
        </div>
      </div>
      ${(session.ctx.buffs || []).length ? `<div class="hv-sec"><label>触发 buff</label>
        <div class="hv-jewels">${session.ctx.buffs.map((b) => `<span class="oc-chip buff">✨ ${b.name}·${b.desc}</span>`).join('')}</div>
      </div>` : ''}
      <div class="hv-result">
        <div><span>原本金额</span><b class="hv-base">¥${r.base ?? r.price}</b></div>
        ${r.buffPart ? `<div><span>buff 加成</span><b class="hv-fans">+¥${r.buffPart}</b></div>` : ''}
        <div><span>营收</span><b class="hv-earn">+¥${r.price}</b></div>
        <div><span>粉丝</span><b class="hv-fans">+${r.fans}</b></div>
        ${session.ctx.pairs ? `<div><span>对对碰</span><b>${session.ctx.pairs} 次</b></div>` : ''}
      </div>
      <button class="btn btn-primary btn-big" id="hvNext">下一单</button>
    </div>`, { closable: false })
  document.getElementById('hvNext').onclick = () => { sfx.tap(); close(); nextOrder(stage) }
  burst(window.innerWidth / 2, window.innerHeight / 2.6, ['#FFD98E', '#FF7EB6', '#7DE2D1'], 24)
}

function endStream(stage) {
  const s = getState()
  s.streamsLeft = Math.max(0, s.streamsLeft - 1)
  // 热度打榜：当场热度 > 粉丝数 → 总粉丝 +5%
  if (session && session.heat > s.fans) {
    const bonus = Math.round(s.fans * HEAT_FAN_BONUS)
    s.fans += bonus
    s.stats.heatBonus = (s.stats.heatBonus || 0) + bonus
    updateTopbarNumbers(s)
    toast(`热度破圈！全直播间涨粉 +${bonus}`)
    sfx.fans()
  }
  stage.innerHTML = `<div class="live-intro"><div class="li-ic">🌙</div><b>下播啦！</b><span>来看看今天的战果</span></div>`
  sfx.cash()
  timers.push(setTimeout(() => {
    if (s.stats) s.stats._res = null
    setState({ screen: 'settle' })
    saveNow()
  }, 1200))
}

// ---------- 结算屏 ----------

export function renderSettle(root) {
  const s = getState()
  if (!s.stats) s.stats = freshStats()
  let res = s.stats._res
  if (!res) {
    res = settleDay(s, { isLastStream: s.streamsLeft <= 0 })
    s.stats._res = res
    saveNow()
  }
  const lv = res.level
  const stars = '★'.repeat(lv.stars) + '☆'.repeat(5 - lv.stars)
  const comments = [...lv.comments].sort(() => Math.random() - 0.5).slice(0, 2)
  const packedTotal = Object.values(s.packed).reduce((n, arr) => n + arr.length, 0)
  const canMore = s.streamsLeft > 0

  root.innerHTML = `
    <div class="settle">
      <h2 class="st-title">第 ${s.day} 天 · 下播结算</h2>
      <p class="st-sub">今日第 ${STREAMS_PER_DAY - s.streamsLeft} 场 · 还可播 ${s.streamsLeft} 场</p>
      <div class="st-card">
        <div class="st-row"><span>订单原本金额</span><b>¥${s.stats.earnBase || 0}</b></div>
        <div class="st-row"><span>buff 加成</span><b class="st-fans">+¥${s.stats.earnBuff || 0}</b></div>
        <div class="st-row"><span>总营收</span><b class="st-earn">¥${s.stats.earn}</b></div>
        <div class="st-row"><span>累计订单</span><b>${s.stats.ordersDone} 单 · 售出 ${s.stats.bagsSold} 袋</b></div>
        <div class="st-row"><span>对对碰 / 幸运色</span><b>${s.stats.pairs} 次 / ${s.stats.luckyHits} 次</b></div>
        ${s.stats.bestPull ? `<div class="st-row"><span>最佳出货</span><b style="color:${RARITIES[s.stats.bestPull.rarity].color}">${s.stats.bestPull.name}</b></div>` : ''}
        ${s.stats.stockouts ? `<div class="st-row warn"><span>缺货</span><b>${s.stats.stockouts} 次</b></div>` : ''}
      </div>
      <div class="st-card eval">
        <div class="st-eval-head"><span class="st-stars">${stars}</span><b>${lv.name}</b></div>
        ${comments.map((c) => `<p class="st-comment">「${c}」</p>`).join('')}
      </div>
      <div class="st-card">
        <div class="st-row"><span>今日累计涨粉</span><b class="st-fans">+${s.stats.fansToday}</b></div>
        ${s.stats.heatBonus ? `<div class="st-row"><span>热度打榜</span><b class="st-fans">+${s.stats.heatBonus}</b></div>` : ''}
        ${res.fanBonus > 0 ? `<div class="st-row"><span>好评加成</span><b class="st-fans">+${res.fanBonus}</b></div>` : ''}
        <div class="st-row"><span>当前粉丝</span><b>${s.fans}</b></div>
      </div>
      ${res.mercy ? '<p class="st-mercy">粉丝心疼你，打赏了 ¥150 快去进货吧</p>' : ''}
      <div class="st-actions">
        ${canMore ? `<button class="btn btn-primary btn-big" id="stMore">继续直播（剩 ${s.streamsLeft} 场）</button>` : ''}
        <button class="btn ${canMore ? 'btn-ghost' : 'btn-primary btn-big'}" id="stNext">下一天</button>
      </div>
      ${packedTotal > 0 ? `<p class="st-note">还有 ${packedTotal} 袋没卖完${canMore ? '，继续播接着卖' : ''}</p>` : ''}
    </div>`

  if (canMore) root.querySelector('#stMore').onclick = () => {
    sfx.tap()
    setState({ screen: 'day', dayTab: 'pack' })
    saveNow()
  }
  root.querySelector('#stNext').onclick = () => {
    sfx.tap()
    nextDay(s)
    setState({ screen: 'day', dayTab: 'shop' })
    saveNow()
  }
}