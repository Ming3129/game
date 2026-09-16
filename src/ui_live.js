// 直播界面：三区布局（直播画面 / 展示 / 待拆）、先拆完再对对碰、订单色、收获弹窗、直播热度。
import { getState, setState } from './state.js'
import {
  CATS, CAT_KEYS, COINS, COIN_KEYS, RARITIES, DANMAKU, ORDER_BASE, ORDER_PER_BAG, TREND_MULT,
  GEMS, DESIGNS, designById, GUARANTEE_MIN, STREAMS_PER_DAY, HEAT_START_RATE, HEAT_FAN_BONUS,
} from './data.js'
import { planStream, newOrderSession, openBag, resolvePairs, resolveSinglePair, finishOrder, settleDay, nextDay } from './engine.js'
import { freshStats } from './state.js'
import { updateTopbarNumbers, toast, icon, openModal } from './ui.js'
import { sfx, floatText, burst, popIn, shake } from './fx.js'
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
    streamStarted: false,
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
        <span class="live-trend">风向 ${CATS[s.trend.cat].name}${s.trend.style ? ` · ${designById(s.trend.style).name}` : ''}</span>
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
  timers.push(setTimeout(() => nextOrder(stage), 1400))
}

// 观众随机昵称池
const AUDIENCE_NAMES = [
  '芝芝桃桃', '欧气满满', '小猫打呼噜', '星河碎碎冰', '今天不熬夜',
  '奶糖泡泡', '草莓大福', '追光的小鹿', '橘子汽水', '可可脆脆',
  '软绵绵的云', '暴富小锦鲤', '啵啵奶茶', '咸蛋黄泡芙', 'momo',
  '甜甜圈圈', '柠檬气泡', '月亮邮局', '薄荷小调', '落日飞车',
  '芋泥波波', '雪顶咖啡', '晴天小狗', '乌龙烤奶', '多肉葡萄',
  '浅草微风', '丸子酱', '青提气泡水', '早睡早起', '锦鲤附体',
  '棉花糖', '布丁豆豆', '焦糖布蕾', '快乐小羊', '奶茶续命选手', 
  '良良'
]

function getRandomAudience() {
  const base = AUDIENCE_NAMES[Math.floor(Math.random() * AUDIENCE_NAMES.length)]
  const id = Math.floor(1000 + Math.random() * 9000)
  return `${base} [ID: ${id}]`
}

// 专属单主弹幕：高亮单主标签与下单ID
export function spawnBuyerDanmaku(text, delay = 0) {
  const o = session?.order
  if (!o) return
  const buyerId = o.buyerId || '8888'
  const buyerName = o.buyerName || '单主'
  timers.push(setTimeout(() => {
    const container = document.getElementById('danmaku')
    if (!container) return
    const el = document.createElement('div')
    el.className = 'chat-item chat-item-buyer'
    el.innerHTML = `<span class="ci-buyer-badge">单主</span><span class="ci-user ci-buyer-name">${buyerName} [ID: ${buyerId}]</span><span class="ci-sep">:</span><span class="ci-text ci-buyer-text">${text}</span>`
    container.appendChild(el)
    while (container.children.length > 8) {
      container.removeChild(container.firstChild)
    }
  }, delay))
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

// 右侧观众弹幕流：向上秩序滚动，带随机用户ID
export function spawnDanmaku(pool, n = 1, delayStart = 0) {
  const layer = document.getElementById('danmaku')
  if (!layer) return
  const list = Array.isArray(pool) ? pool : [pool]
  if (list.length === 0) return

  // 从池中随机挑选 n 个，尽量避免同批次重复
  const chosen = []
  const shuffled = [...list].sort(() => Math.random() - 0.5)
  for (let i = 0; i < n; i++) {
    chosen.push(shuffled[i % shuffled.length])
  }

  for (let i = 0; i < chosen.length; i++) {
    timers.push(setTimeout(() => {
      const container = document.getElementById('danmaku')
      if (!container) return
      const text = chosen[i]
      const user = getRandomAudience()
      const el = document.createElement('div')
      el.className = 'chat-item'
      el.innerHTML = `<span class="ci-user">${user}</span><span class="ci-sep">:</span><span class="ci-text">${text}</span>`
      container.appendChild(el)

      // 保持秩序，最多保留8条常驻展示，多出则移除最旧的一条
      while (container.children.length > 8) {
        container.removeChild(container.firstChild)
      }
    }, delayStart + i * 280))
  }
}

// 左侧专属通知流：buff、再加一袋、爆款、对对碰
export function spawnLiveNotice(type, title, desc, extraHtml = '') {
  const container = document.getElementById('liveEventFeed')
  if (!container) return
  const el = document.createElement('div')
  el.className = `live-notice ln-${type}`
  el.innerHTML = `
    <span class="ln-badge">${title}</span>
    <span class="ln-body">
      <span class="ln-desc">${desc}</span>
      ${extraHtml ? `<span class="ln-extra">${extraHtml}</span>` : ''}
    </span>`
  container.appendChild(el)

  // 保持整洁，最多保留8条通知
  while (container.children.length > 8) {
    container.removeChild(container.firstChild)
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

// 弹窗：接单备货（玩家自主从货架拿取订单数量的盲袋）
function openPickBagsModal(order, onReady) {
  const s = getState()
  const cat = order.cat
  const size = order.size
  const availableBags = [...(s.packed[cat] || [])]
  const totalBagsToShow = Math.max(availableBags.length, size, 8)
  let pickedIndices = []

  const modal = openModal(`
    <div class="pick-bags-modal">
      <div class="pbm-head">
        <div class="pbm-title-wrap">
          <h3 class="m-title" style="margin-bottom:2px;">📦 接单备货 · 自选上台盲袋</h3>
          <span class="pbm-buyer-tag">单主 <b>${order.buyerName || '神秘顾客'}</b></span>
        </div>
      </div>

      <div class="pbm-shelf-sec">
        <div class="pbm-sec-head">
          <span>📦 ${CATS[cat].name}盲袋货架（点盲袋拿取）</span>
          <small>库存已装袋：${availableBags.length} 袋</small>
        </div>
        <div class="pbm-shelf-grid" id="pbmShelf"></div>
      </div>

      <div class="pbm-tray-sec">
        <div class="pbm-sec-head">
          <span>✨ 拆袋台托盘</span>
          <span class="pbm-count-pill">已拿取 <b id="pbmCount">0</b> / ${size} 袋</span>
        </div>
        <div class="pbm-tray-grid" id="pbmTray"></div>
      </div>

      <div class="pbm-actions">
        <button class="btn btn-ghost" id="pbmAuto">一键取齐</button>
        <button class="btn btn-ghost" id="pbmClear">清空托盘</button>
        <button class="btn btn-primary btn-big" id="pbmConfirm" disabled>上桌开拆！</button>
      </div>
    </div>
  `)

  const mEl = modal.root || modal.el

  function updatePickUI() {
    const shelf = mEl.querySelector('#pbmShelf')
    const tray = mEl.querySelector('#pbmTray')
    const countEl = mEl.querySelector('#pbmCount')
    const confirmBtn = mEl.querySelector('#pbmConfirm')
    if (!shelf || !tray) return

    countEl.textContent = pickedIndices.length
    confirmBtn.disabled = pickedIndices.length < size

    // 渲染货架袋子
    shelf.innerHTML = Array.from({ length: totalBagsToShow }).map((_, i) => {
      const isPicked = pickedIndices.includes(i)
      const isExtra = i >= availableBags.length
      return `
        <button class="pbm-shelf-bag ${isPicked ? 'picked' : ''} ${isExtra ? 'extra' : ''}" data-shelf-idx="${i}" ${isPicked ? 'disabled' : ''} title="${isPicked ? '已拿入托盘' : '点击放入托盘'}">
          <span class="psb-cat">${icon(cat, 22)}</span>
          <span class="psb-num">#${i + 1}</span>
          ${isExtra ? '<span class="psb-tag">备用</span>' : ''}
        </button>
      `
    }).join('')

    // 渲染托盘槽位
    tray.innerHTML = Array.from({ length: size }).map((_, slotIdx) => {
      const bagIdx = pickedIndices[slotIdx]
      if (bagIdx != null) {
        return `
          <button class="pbm-tray-slot filled" data-tray-slot="${slotIdx}" title="点击放回货架">
            <span class="pts-cat">${icon(cat, 20)}</span>
            <span class="pts-num">#${bagIdx + 1}</span>
            <span class="pts-back-tip">放回</span>
          </button>
        `
      }
      return `
        <div class="pbm-tray-slot empty">
          <span class="pts-empty-dash">+待放入</span>
        </div>
      `
    }).join('')

    shelf.querySelectorAll('[data-shelf-idx]').forEach((b) => {
      b.onclick = () => {
        const idx = Number(b.dataset.shelfIdx)
        if (pickedIndices.includes(idx)) return
        if (pickedIndices.length >= size) {
          toast(`已选满 ${size} 袋，直接点击「上桌开拆」吧！`)
          return
        }
        pickedIndices.push(idx)
        sfx.tap()
        updatePickUI()
      }
    })

    tray.querySelectorAll('[data-tray-slot]').forEach((b) => {
      b.onclick = () => {
        const slot = Number(b.dataset.traySlot)
        pickedIndices.splice(slot, 1)
        sfx.tap()
        updatePickUI()
      }
    })
  }

  const autoBtn = mEl.querySelector('#pbmAuto')
  if (autoBtn) {
    autoBtn.onclick = () => {
      pickedIndices = []
      for (let i = 0; i < size; i++) pickedIndices.push(i)
      sfx.cash()
      updatePickUI()
    }
  }

  const clearBtn = mEl.querySelector('#pbmClear')
  if (clearBtn) {
    clearBtn.onclick = () => {
      pickedIndices = []
      sfx.tap()
      updatePickUI()
    }
  }

  const confirmBtn = mEl.querySelector('#pbmConfirm')
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      if (pickedIndices.length < size) return
      sfx.cash()
      modal.close()
      onReady()
    }
  }

  updatePickUI()
}

// 弹窗：大隐藏沟通弹窗（抽到大隐藏时，玩家通过两到三个选项与单主沟通自选款式）
function openSecretDialogueModal(order, ctx, ev, onSelect) {
  const s = getState()
  const cat = order.cat
  const buyerId = order.buyerId || '8888'
  const buyerName = order.buyerName || '单主'

  // 选项1：今日风向爆款
  const trendStyle = (s.trend.style && designById(s.trend.style)) || DESIGNS.find((d) => d.cat === cat) || DESIGNS[0]
  // 选项2：精选高颜值稀有款式
  const rarePool = DESIGNS.filter((d) => d.cat === cat && (d.rarity === 'rare' || d.rarity === 'epic'))
  const rareStyle = rarePool.length > 0 ? rarePool[Math.floor(Math.random() * rarePool.length)] : trendStyle
  // 选项3：豪气宠粉·典藏传说款
  const legPool = DESIGNS.filter((d) => d.cat === cat && d.rarity === 'legendary')
  const legStyle = legPool.length > 0 ? legPool[0] : (DESIGNS.find((d) => d.rarity === 'legendary') || rareStyle)

  const options = [
    {
      id: 'trend',
      badge: '🔥 流量爆款',
      title: '推荐今日风向爆款',
      design: trendStyle,
      pitch: `主播：“单主快看！今天全网风向最火爆的就是【${trendStyle.name}】，戴出门回头率拉满！”`,
      reply: `哇！太懂我了，我就要这个！主播贴贴！`,
    },
    {
      id: 'rare',
      badge: '✨ 高级稀有',
      title: '推荐心仪高颜值稀有款',
      design: rareStyle,
      pitch: `主播：“单主手气通灵！主播直接推荐这款高颜值、细节拉满的精致稀有款【${rareStyle.name}】！”`,
      reply: `天呐颜值好高！一眼相中【${rareStyle.name}】！太幸运了！`,
    },
    {
      id: 'legend',
      badge: '👑 镇店传说',
      title: '主播宠粉·升级典藏传说款',
      design: legStyle,
      pitch: `主播：“今天直播间排面给足！主播宠粉到底，直接给你提一件镇店传说【${legStyle.name}】！”`,
      reply: `卧槽直接上传说？！主播大善人！今晚必须给直播间点赞十万次！`,
    }
  ]

  const modal = openModal(`
    <div class="secret-dialogue-modal">
      <div class="sdm-header">
        <div class="sdm-crown">👑</div>
        <h3 class="m-title" style="color:var(--deep-wine-red);margin-bottom:4px;">欧气大爆发 · 抽到大隐藏！</h3>
        <p class="sdm-sub">
          与单主 <b>${buyerName}</b> <span class="sdm-id">[ID: ${buyerId}]</span> 正在直播间连线，请选择话术沟通自选款式：
        </p>
      </div>

      <div class="sdm-options">
        ${options.map((opt, i) => `
          <div class="sdm-card" data-opt="${i}">
            <div class="sdm-card-top">
              <span class="sdm-badge">${opt.badge}</span>
              <b class="sdm-opt-title">${opt.title}</b>
            </div>
            <div class="sdm-preview rc-${opt.design.rarity}">
              <span class="sdm-icon">${icon(opt.design, 22)}</span>
              <span class="sdm-name">${opt.design.name}</span>
              <span class="sdm-rarity">（${RARITIES[opt.design.rarity].name}）</span>
            </div>
            <p class="sdm-pitch">${opt.pitch}</p>
            <button class="btn btn-primary sdm-choose-btn" data-choose="${i}">与单主沟通选此款</button>
          </div>
        `).join('')}
      </div>
    </div>
  `)

  const mEl = modal.root || modal.el
  mEl.querySelectorAll('[data-choose]').forEach((b) => {
    b.onclick = () => {
      const idx = Number(b.dataset.choose)
      const chosen = options[idx]
      sfx.legendary()
      modal.close()
      onSelect(chosen.design, chosen.reply)
    }
  })
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
        <div class="oc-buyer-bar">
          <span class="oc-buyer-badge">单主</span>
          <b class="oc-buyer-name">${o.buyerName || 'VIP买家'}</b>
          <span class="oc-buyer-id">[ID: ${o.buyerId}]</span>
        </div>
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
  const stock = (s.packed[o.cat] || []).length
  const orderNum = session.idx + (session.orders[0]?.type === 'limited' ? 0 : 1)

  if (stock < o.size) {
    const isZero = stock === 0
    stage.innerHTML = `
      <div class="order-card stockout-order">
        <div class="oc-tag ${trendHit ? 'hot' : ''}">
          ${o.held ? '<span class="oc-tag-held">★保留单</span> · ' : ''}订单 ${orderNum}${trendHit ? ' · 命中风向 ×1.5' : ''}
        </div>
        <div class="oc-buyer-bar">
          <span class="oc-buyer-badge">单主</span>
          <b class="oc-buyer-name">${o.buyerName || '神秘顾客'}</b>
          <span class="oc-buyer-id">[ID: ${o.buyerId}]</span>
        </div>
        <div class="oc-main">
          <span class="oc-cat">${icon(o.cat, 30)}</span>
          <div class="oc-info">
            <b>${CATS[o.cat].name}盲袋 × ${o.size}</b>
            <span>保底 ${GUARANTEE_MIN} 袋 · 拆完统一对对碰</span>
            <div class="oc-stock empty">
              当前${CATS[o.cat].name}库存：<b>${stock} 袋</b> <span class="oc-stock-badge">${isZero ? '已缺货' : '库存不足'}</span>
            </div>
          </div>
          <div class="oc-price">预估 <b>¥${est}</b></div>
        </div>
        <p class="oc-warn-tip">${isZero ? '该品类盲袋已无库存！' : `该品类盲袋库存不足（需要 ${o.size} 袋，现仅有 ${stock} 袋）！`}可跳过此单，或花 ¥50 保留至下场直播进货后再拆。</p>
        <div class="oc-btns oc-btns-empty">
          <button class="btn btn-ghost" id="ocSkipOrder">跳过订单</button>
          <button class="btn btn-primary" id="ocHoldOrder" ${s.money < 50 ? 'disabled' : ''}>花 ¥50 保留到下场</button>
          <button class="btn btn-ghost" id="ocSkip">下播</button>
        </div>
      </div>`

    stage.querySelector('#ocSkipOrder').onclick = () => {
      sfx.tap()
      toast(`已跳过 ${CATS[o.cat].name} 订单`)
      nextOrder(stage)
    }

    stage.querySelector('#ocHoldOrder').onclick = () => {
      if (s.money < 50) {
        sfx.warn()
        return toast('金币不足 ¥50，无法保留订单', 'warn')
      }
      sfx.cash()
      s.money -= 50
      s.heldOrders = s.heldOrders || []
      s.heldOrders.push({
        type: 'bags',
        cat: o.cat,
        size: o.size,
        lucky: o.lucky,
        held: true,
        buyerId: o.buyerId,
        buyerName: o.buyerName,
      })
      updateTopbarNumbers(s)
      floatText(stage.querySelector('#ocHoldOrder') || stage, '-¥50', '#ffb3b3')
      toast(`已花费 ¥50 将该订单保留至下一场直播！`)
      saveNow()
      nextOrder(stage)
    }

    stage.querySelector('#ocSkip').onclick = () => endStream(stage)
    popIn(stage.querySelector('.order-card'))
    return
  }

  stage.innerHTML = `
    <div class="order-card">
      <div class="oc-tag ${trendHit ? 'hot' : ''}">
        ${o.held ? '<span class="oc-tag-held">★保留单</span> · ' : ''}订单 ${orderNum}${trendHit ? ' · 命中风向 ×1.5' : ''}
      </div>
      <div class="oc-buyer-bar">
        <span class="oc-buyer-badge">单主</span>
        <b class="oc-buyer-name">${o.buyerName || '神秘顾客'}</b>
        <span class="oc-buyer-id">[ID: ${o.buyerId}]</span>
      </div>
      <div class="oc-main">
        <span class="oc-cat">${icon(o.cat, 30)}</span>
        <div class="oc-info">
          <b>${CATS[o.cat].name}盲袋 × ${o.size}</b>
          <span>保底 ${GUARANTEE_MIN} 袋 · 拆完统一对对碰</span>
          <div class="oc-stock">
            当前${CATS[o.cat].name}库存：<b>${stock} 袋</b>${stock < o.size ? ` <span class="oc-stock-low">(少于订单需求)</span>` : ''}
          </div>
        </div>
        <div class="oc-price">预估 <b>¥${est}</b></div>
      </div>
      <div class="oc-btns">
        <button class="btn btn-primary btn-big" id="ocGo">接单备货</button>
        <button class="btn btn-ghost" id="ocSkip">下播</button>
      </div>
    </div>`
  stage.querySelector('#ocGo').onclick = () => {
    openPickBagsModal(o, () => renderBagArea(stage))
  }
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
        <div class="live-feed-left" id="liveEventFeed"></div>
        <div class="live-feed-right" id="danmaku"></div>
        <div class="lv-active" id="lvActive"><div class="lv-hint">点下方盲袋开拆</div></div>
      </section>
      <section class="lv-show">
        <div class="lv-tag">展示</div>
        <div class="show-colors">
          <span class="oc-chip">订单色 <i class="coin-dot sm" style="--cc:${COINS[o.lucky].hex}">${COINS[o.lucky].name}</i> 拆到加一袋</span>
          <span class="oc-chip dim">今日幸运 <i class="coin-dot sm" style="--cc:${COINS[s.trend.lucky].hex}">${COINS[s.trend.lucky].name}</i> 对碰触发buff</span>
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

  // 直播开场：从 DANMAKU.enter 里选两三个弹幕
  const isFirstOrder = !session.streamStarted
  if (isFirstOrder) {
    session.streamStarted = true
    const enterCount = Math.floor(Math.random() * 2) + 2 // 2 或 3 个
    spawnDanmaku(DANMAKU.enter, enterCount, 150)
  }

  // 新的一单：单主发弹幕打招呼 + 观众弹幕
  spawnBuyerDanmaku(`主播好！我来蹲我的${CATS[o.cat].name}盲袋啦！求大隐藏求对碰！`, isFirstOrder ? 900 : 300)
  const orderCount = Math.floor(Math.random() * 2) + 3 // 3 或 4 个
  const orderDelay = isFirstOrder ? 1100 : 450
  spawnDanmaku(DANMAKU.order, orderCount, orderDelay)
}

function makeBag(o, bonus) {
  const b = document.createElement('button')
  b.className = 'bag ziplock' + (bonus ? ' bonus' : '')
  b.innerHTML = `<div class="bag-body"><div class="bag-hang-hole"></div><div class="bag-zip-strip"></div><span class="bag-cat">${icon(o.cat, 20)}</span>${bonus ? '<em class="bag-plus">+1</em>' : ''}</div>`
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
  if (!active || ctx.done) return
  if (ctx.queue <= 0) ctx.queue = 1

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
      spawnLiveNotice('warn', '缺货', '缺货 · 评价 -2')
      bagEl.remove()
      checkPhase(queue)
      return
    }

    bagEl.remove()
    const r = RARITIES[ev.design.rarity]
    mover.innerHTML = `
      <div class="bag-reveal rc-${ev.design.rarity}">
        <span class="br-ic">${icon(ev.design, 20)}</span>
        <span class="br-name">${ev.design.name}</span>
        <i class="coin-dot" style="--cc:${COINS[ev.coin].hex}">${COINS[ev.coin].name}</i>
      </div>`
    if (ev.design.rarity === 'legendary') sfx.legendary()
    else if (ev.design.rarity === 'epic') sfx.rare()
    else sfx.coin()
    const rect = mover.getBoundingClientRect()
    let hasSpecialDm = false
    if (ev.design.rarity === 'epic' || ev.design.rarity === 'legendary') {
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2, [r.color, '#FFF'], 16)
      spawnDanmaku(ev.design.rarity === 'legendary' ? DANMAKU.legendary : DANMAKU.epic, 2)
      spawnLiveNotice('rare', r.name, ev.design.name)
      hasSpecialDm = true
    }
    if (ev.styleHit) {
      spawnLiveNotice('trend', '爆款', '风向款！粉丝 +1')
      spawnDanmaku(['风向款拆到了！', '就是这个！买爆！'], 2)
      hasSpecialDm = true
    }
    if (ev.luckyHit) {
      sfx.coin()
      const colorLabel = ev.coin.startsWith('secret') ? COINS[ev.coin].name : `${COINS[ev.coin].name}色`
      spawnLiveNotice('bag', '+1袋', `订单色加持 · ${colorLabel}`)
      spawnBuyerDanmaku('哇！我的订单幸运色！加拆一袋！', 200)
      spawnDanmaku(DANMAKU.lucky, 2)
      hasSpecialDm = true
      // 幸运色命中直接补加一袋入待拆区，避免异步相减时序产生偏差
      if (queue) queue.appendChild(makeBag(o, true))
    }

    // 小隐藏：加一袋盲袋
    if (ev.coin === 'secret_s') {
      sfx.coin()
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2, ['#C2D1E5', '#FFFFFF'], 14)
      spawnLiveNotice('bag', '✨ 小隐藏', '小隐藏加持 · 加拆 1 袋盲袋！')
      spawnBuyerDanmaku('哇啊啊啊出小隐藏了！！加拆一袋！太欧啦！', 150)
      spawnDanmaku(DANMAKU.secret_s, 2, 250)
      hasSpecialDm = true
      if (queue) queue.appendChild(makeBag(o, true))
    }

    // 大隐藏：自选款式（通过两到三个选项与单主沟通）
    if (ev.coin === 'secret_b') {
      sfx.legendary()
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2, ['#FF5EC8', '#FFD98E', '#FFFFFF'], 22)
      spawnLiveNotice('rare', '👑 大隐藏！', '抽中大隐藏 · 开启单主自选款式沟通！')
      spawnBuyerDanmaku('天呐是大隐藏！！！我抽到大隐藏了！求主播自选！', 150)
      spawnDanmaku(DANMAKU.secret_b, 3, 200)
      hasSpecialDm = true

      renderBoxItems()
      addToTray(ev.coin)

      // 弹出沟通弹窗
      openSecretDialogueModal(o, ctx, ev, (chosenDesign, buyerReply) => {
        ev.design = chosenDesign
        const lastOpened = ctx.opened[ctx.opened.length - 1]
        if (lastOpened) lastOpened.design = chosenDesign
        renderBoxItems()

        sfx.legendary()
        spawnBuyerDanmaku(buyerReply, 50)
        spawnLiveNotice('rare', '自选达成', `单主 [ID: ${o.buyerId}] 确定选择【${chosenDesign.name}】！`)
        floatText(active, `大隐藏自选达成！`, '#FF5EC8')
        spawnDanmaku(DANMAKU.secret_b, 2, 300)
        checkPhase(queue)
      })
      return
    }

    if (!hasSpecialDm && Math.random() < 0.8) {
      spawnDanmaku(DANMAKU.generic, 1)
    }

    // 饰品入首饰盒（同款合并 ×N）
    renderBoxItems()
    // 硬币入木盘（此时不成对，拆完后统一结算）
    addToTray(ev.coin)

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
      return `<span class="box-jewel rc-${it.d.rarity}${it.style ? ' style-hit' : ''}">${icon(it.d, 14)}${it.d.name}${it.n > 1 ? ` ×${it.n}` : ''}</span>`
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

// 同步展示区小木盘硬币（只展示尚未凑成对的零散单枚）
function syncTrayCoins() {
  const tray = document.getElementById('lvTrayCoins')
  if (!tray) return
  tray.innerHTML = ''
  let count = 0
  for (const k of COIN_KEYS) {
    const n = session?.ctx?.tally?.[k] || 0
    count += n
    for (let i = 0; i < n; i++) {
      const chip = document.createElement('span')
      chip.className = 'tray-coin'
      chip.dataset.c = k
      chip.innerHTML = `<i class="coin-dot" style="--cc:${COINS[k].hex}">${COINS[k].name}</i>`
      tray.appendChild(chip)
    }
  }
  if (count === 0) {
    const empty = document.createElement('span')
    empty.className = 'lv-empty'
    empty.textContent = '空'
    tray.appendChild(empty)
  }
}

// 阶段推进：拆完 → 放大木盘拖动对对碰 → 还有袋继续拆 / 保底补拆 / 完成订单
function checkPhase(queue) {
  const ctx = session.ctx
  if (!queue || ctx.done) return
  const pending = queue.querySelectorAll('.bag:not(.opened):not(.stockout)').length
  if (pending > 0) return

  // 若待拆区所有袋子已拆完，但后台队列计数大于0，补齐待拆区
  if (ctx.queue > 0) {
    for (let i = 0; i < ctx.queue; i++) queue.appendChild(makeBag(session.order, true))
    return
  }

  // 检查是否能够对对碰
  let canPairCount = 0
  for (const k of COIN_KEYS) {
    canPairCount += Math.floor((ctx.tally[k] || 0) / 2)
  }

  if (canPairCount > 0) {
    // 放大木盘，进入拖动硬币对对碰
    startInteractiveTrayMatch(queue)
    return
  }

  renderExtra(queue)
}

// 放大木盘：玩家拖动硬币进行对对碰
function startInteractiveTrayMatch(queue) {
  const ctx = session.ctx
  const s = getState()

  // 统计当前盘内可碰对数
  const countPairsLeft = () => {
    let pairs = 0
    for (const k of COIN_KEYS) {
      pairs += Math.floor((ctx.tally[k] || 0) / 2)
    }
    return pairs
  }

  const initialPairs = countPairsLeft()
  if (initialPairs <= 0) {
    renderExtra(queue)
    return
  }

  // 收集当前木盘内所有的硬币
  const coinItems = []
  let uid = 0
  for (const k of COIN_KEYS) {
    const n = ctx.tally[k] || 0
    for (let i = 0; i < n; i++) {
      coinItems.push({
        id: `tm_c_${uid++}`,
        key: k,
        matched: false,
        x: 0,
        y: 0,
      })
    }
  }

  // 创建全屏遮罩及大木盘 DOM（整体色调与弹窗保持一致）
  const overlay = document.createElement('div')
  overlay.className = 'tray-match-overlay'
  overlay.id = 'trayMatchOverlay'
  overlay.innerHTML = `
    <div class="tray-match-panel">
      <div class="tray-match-header">
        <div class="tm-title-wrap">
          <span class="tm-title">对对碰</span>
          <span class="tm-sub" id="tmSubHint">拖动同色硬币凑对（还可碰 <b id="tmRemainPairs">${initialPairs}</b> 对）</span>
        </div>
        <button class="btn btn-ghost btn-mini" id="tmQuickMatch" title="自动配对所有同色硬币">⚡ 快速全碰</button>
      </div>
      <div class="tray-plate" id="trayPlate"></div>
    </div>
  `
  document.body.appendChild(overlay)

  const plate = overlay.querySelector('#trayPlate')

  // 计算居中对齐坐标：一行最多四个，每行硬币居中对齐
  const total = coinItems.length
  const maxCols = 4
  const coinSize = 44
  const gapX = 14
  const gapY = 14
  const totalRows = Math.ceil(total / maxCols)
  const contentH = totalRows * coinSize + Math.max(0, totalRows - 1) * gapY
  const plateMinH = Math.max(210, contentH + 36)
  plate.style.minHeight = `${plateMinH}px`

  const plateWidth = plate.clientWidth || 344
  const plateHeight = Math.max(plateMinH, plate.clientHeight || plateMinH)

  coinItems.forEach((it, i) => {
    const r = Math.floor(i / maxCols)
    const c = i % maxCols
    const countInRow = (r === totalRows - 1 && total % maxCols !== 0) ? (total % maxCols) : maxCols
    const rowWidth = countInRow * coinSize + (countInRow - 1) * gapX
    const startX = (plateWidth - rowWidth) / 2
    const startY = Math.max(18, (plateHeight - contentH) / 2)
    it.x = Math.round(startX + c * (coinSize + gapX))
    it.y = Math.round(startY + r * (coinSize + gapY))
  })

  const matchedPairs = []
  let activeDrag = null
  let currentTarget = null
  let isFinishing = false

  const clearTarget = () => {
    if (currentTarget) {
      const el = document.getElementById(currentTarget.id)
      el?.classList.remove('match-candidate')
      currentTarget = null
    }
  }

  // 触发一对硬币的对对碰：温和轻柔碰撞，随后慢慢消失
  const triggerPair = (itemA, itemB) => {
    if (itemA.matched || itemB.matched) return
    itemA.matched = true
    itemB.matched = true
    clearTarget()

    const k = itemA.key
    matchedPairs.push(k)

    // 数据结算
    const { isLucky } = resolveSinglePair(s, session.order, ctx, k)

    const elA = document.getElementById(itemA.id)
    const elB = document.getElementById(itemB.id)
    const midX = (itemA.x + itemB.x) / 2
    const midY = (itemA.y + itemB.y) / 2

    // 两个硬币向中心轻轻靠拢并慢慢渐隐消失
    if (elA) {
      elA.style.left = `${midX}px`
      elA.style.top = `${midY}px`
      elA.classList.add('matching')
    }
    if (elB) {
      elB.style.left = `${midX}px`
      elB.style.top = `${midY}px`
      elB.classList.add('matching')
    }

    // 视听动效：舒缓清脆音效，取消剧烈震动与大爆破火花
    sfx.coin()
    if (isLucky) sfx.legendary()

    floatText(plate, isLucky ? `✨ 幸运对碰！+1袋` : `✨ 对对碰！+1袋`, COINS[k].hex, true)

    if (isLucky) {
      spawnDanmaku(['幸运色碰成了！', '欧气爆发！', '专属buff生效！'], 2)
    } else {
      spawnDanmaku(DANMAKU.pair, 1)
    }

    // 慢慢淡出后清理 DOM
    setTimeout(() => {
      elA?.remove()
      elB?.remove()
    }, 540)

    // 更新界面计数与热度
    const remain = countPairsLeft()
    const remainEl = document.getElementById('tmRemainPairs')
    if (remainEl) remainEl.textContent = remain

    if (ctx.heatAdd) {
      session.heat += ctx.heatAdd
      ctx.heatAdd = 0
      updateHeat()
    }
    renderBuffs()

    // 检查是否已碰完
    if (remain === 0 && !isFinishing) {
      isFinishing = true
      const hint = document.getElementById('tmSubHint')
      if (hint) hint.innerHTML = '<span class="tm-finish-text">🎉 碰完啦！正在结算...</span>'
      const quickBtn = document.getElementById('tmQuickMatch')
      if (quickBtn) quickBtn.disabled = true

      setTimeout(() => {
        overlay.classList.add('fade-out')
        setTimeout(() => {
          overlay.remove()
          syncTrayCoins()
          showPairModal(matchedPairs, queue)
        }, 220)
      }, 520)
    }
  }

  // 渲染并绑定硬币
  coinItems.forEach((item) => {
    const el = document.createElement('div')
    el.className = 'tm-coin'
    el.id = item.id
    el.dataset.id = item.id
    el.dataset.key = item.key
    el.style.left = `${item.x}px`
    el.style.top = `${item.y}px`
    el.style.setProperty('--coin-color', COINS[item.key].hex)
    el.innerHTML = `
      <div class="tm-coin-inner">
        <span class="tm-coin-tint"></span>
      </div>
    `
    plate.appendChild(el)

    let offsetX = 0
    let offsetY = 0

    el.onpointerdown = (e) => {
      if (item.matched || isFinishing) return
      activeDrag = item
      try { el.setPointerCapture(e.pointerId) } catch (_) {}
      const pRect = plate.getBoundingClientRect()
      offsetX = e.clientX - pRect.left - item.x
      offsetY = e.clientY - pRect.top - item.y
      el.classList.add('dragging')
      sfx.tap()
    }

    el.onpointermove = (e) => {
      if (activeDrag !== item || item.matched) return
      const pRect = plate.getBoundingClientRect()
      const maxX = pRect.width - 44
      const maxY = pRect.height - 44
      let nx = e.clientX - pRect.left - offsetX
      let ny = e.clientY - pRect.top - offsetY
      nx = Math.max(4, Math.min(maxX, nx))
      ny = Math.max(4, Math.min(maxY, ny))
      item.x = nx
      item.y = ny
      el.style.left = `${nx}px`
      el.style.top = `${ny}px`

      // 实时距离与吸附检测
      const sourceCenter = { x: item.x + 22, y: item.y + 22 }
      let closest = null
      let minDist = Infinity
      for (const other of coinItems) {
        if (other === item || other.matched || other.key !== item.key) continue
        const oc = { x: other.x + 22, y: other.y + 22 }
        const d = Math.hypot(sourceCenter.x - oc.x, sourceCenter.y - oc.y)
        if (d < 54 && d < minDist) {
          minDist = d
          closest = other
        }
      }

      if (closest !== currentTarget) {
        clearTarget()
        if (closest) {
          currentTarget = closest
          const oEl = document.getElementById(closest.id)
          oEl?.classList.add('match-candidate')
        }
      }

      // 距离小于 34px 即刻在拖动中触发对碰
      if (closest && minDist < 34 && !item.matched && !closest.matched) {
        triggerPair(item, closest)
      }
    }

    el.onpointerup = el.onpointercancel = (e) => {
      if (activeDrag !== item) return
      try { el.releasePointerCapture(e.pointerId) } catch (_) {}
      el.classList.remove('dragging')
      activeDrag = null

      if (currentTarget && !currentTarget.matched && !item.matched) {
        triggerPair(item, currentTarget)
      }
      clearTarget()
    }
  })

  // 快速全碰逻辑
  const quickBtn = overlay.querySelector('#tmQuickMatch')
  if (quickBtn) {
    quickBtn.onclick = () => {
      quickBtn.disabled = true
      const autoStep = () => {
        if (isFinishing) return
        let pair = null
        for (const k of COIN_KEYS) {
          const list = coinItems.filter((it) => !it.matched && it.key === k)
          if (list.length >= 2) {
            pair = [list[0], list[1]]
            break
          }
        }
        if (pair) {
          triggerPair(pair[0], pair[1])
          setTimeout(autoStep, 260)
        }
      }
      autoStep()
    }
  }
}

// 对对碰结算弹窗：列出每一对的颜色与效果；木盘被完全清空时触发「清盘」奖励
function showPairModal(paired, queue) {
  const ctx = session.ctx
  const s = getState()
  const luckyKey = s.trend.lucky
  // 清盘：本轮对碰后所有颜色都不剩零散单枚，木盘全空
  const cleared = COIN_KEYS.every((k) => !(ctx.tally[k] || 0))
  if (cleared) ctx.queue += 3 // 清盘奖励：另加三袋盲袋
  const luckyPairs = paired.filter((k) => k === luckyKey)
  const rows = paired.map((k, i) => {
    const isLucky = (k === luckyKey)
    return `
    <div class="pair-row ${isLucky ? 'is-lucky' : ''}">
      <span class="pair-idx">${i + 1}</span>
      <i class="coin-dot sm" style="--cc:${COINS[k].hex}">${COINS[k].name}</i>
      <span class="pair-eff ${isLucky ? 'is-lucky' : ''}">${isLucky ? `✨ 幸运色触发：${COINS[k].pair} + 加拆1袋` : '加拆 1 袋'}</span>
    </div>`
  }).join('')
  const { close } = openModal(`
    <h3 class="m-title">对对碰 × ${paired.length}</h3>
    <div class="pair-list">${rows}</div>
    ${cleared ? '<div class="clear-banner">🎉 清盘！另加三袋盲袋</div>' : ''}
    <p class="pair-note">本轮加拆 ${ctx.queue} 袋${luckyPairs.length ? `；触发 ${luckyPairs.length} 次今日幸运色 buff！` : ''}${cleared ? '' : '；配对成功的硬币已收走，没凑成对的原地留着等下一轮'}</p>
    <button class="btn btn-primary btn-big" id="pairGo">继续拆袋</button>
  `, { closable: false })
  sfx.pair()
  if (cleared || luckyPairs.length) sfx.legendary()
  spawnDanmaku(DANMAKU.pair, 3)
  if (luckyPairs.length) spawnDanmaku(['幸运色碰成了！', '欧气爆发！', '专属buff生效！'], 2)
  if (cleared) spawnDanmaku(['清盘了！！', '木盘都被碰空了！', '这就是欧皇吗'], 3)
  document.getElementById('pairGo').onclick = () => {
    sfx.tap()
    close()
    syncTrayCoins()
    const toColorName = (k) => (k.startsWith('secret') ? COINS[k].name : `${COINS[k].name}色`)
    if (luckyPairs.length) {
      spawnLiveNotice('buff', '幸运对碰', `${toColorName(luckyKey)} · ${COINS[luckyKey].pair}`)
    }
    const pairColors = [...new Set(paired.map(toColorName))].join('、')
    spawnLiveNotice('pair', '对碰', `${pairColors} · 加拆 ${ctx.queue} 袋`)
    if (cleared) spawnLiveNotice('buff', '清盘', '另加三袋！')
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
      spawnLiveNotice('bag', '保底', `保底机制 · 补拆一袋`)
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
        ${session.ctx.pairs ? `<div><span>对对碰</span><b class="hv-base">${session.ctx.pairs} 次</b></div>` : ''}
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