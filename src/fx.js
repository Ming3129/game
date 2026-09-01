// 特效层：WebAudio 合成音效 + DOM 飘字/粒子/震屏。零外部音频资产。

let actx = null
let muted = false

export function setMuted(v) { muted = v }
function ac() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) actx = new AC()
  }
  if (actx && actx.state === 'suspended') actx.resume()
  return actx
}

function tone(freq, dur, { type = 'sine', vol = 0.15, delay = 0, slide = 0 } = {}) {
  const ctx = ac()
  if (!ctx || muted) return
  const t0 = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function noise(dur, { vol = 0.12, delay = 0, hp = 800 } = {}) {
  const ctx = ac()
  if (!ctx || muted) return
  const t0 = ctx.currentTime + delay
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = hp
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  src.connect(filter).connect(g).connect(ctx.destination)
  src.start(t0)
}

export const sfx = {
  tap:      () => tone(660, 0.06, { type: 'triangle', vol: 0.08 }),
  buy:      () => { tone(520, 0.08, { type: 'triangle', vol: 0.1 }); tone(780, 0.1, { type: 'triangle', vol: 0.1, delay: 0.07 }) },
  tear:     () => noise(0.18, { vol: 0.14, hp: 1200 }),
  coin:     () => { tone(880, 0.09, { vol: 0.12 }); tone(1320, 0.14, { vol: 0.1, delay: 0.06 }) },
  pair:     () => { tone(220, 0.2, { type: 'square', vol: 0.12, slide: 220 }); noise(0.12, { vol: 0.1, hp: 400 }); tone(1046, 0.16, { vol: 0.12, delay: 0.1 }) },
  cash:     () => { tone(784, 0.09, { vol: 0.12 }); tone(988, 0.09, { vol: 0.12, delay: 0.08 }); tone(1318, 0.18, { vol: 0.12, delay: 0.16 }) },
  rare:     () => { tone(660, 0.1, { vol: 0.12 }); tone(880, 0.1, { vol: 0.12, delay: 0.09 }); tone(1174, 0.22, { vol: 0.12, delay: 0.18 }) },
  legendary:() => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, { vol: 0.13, delay: i * 0.09 })) },
  fans:     () => { tone(587, 0.08, { vol: 0.09 }); tone(880, 0.12, { vol: 0.09, delay: 0.06 }) },
  bad:      () => tone(180, 0.25, { type: 'sawtooth', vol: 0.08, slide: -60 }),
}

// ---------- DOM 特效 ----------

// 在元素中心飘字
export function floatText(el, text, color = '#FFD98E', big = false) {
  if (!el) return
  const rect = el.getBoundingClientRect()
  const span = document.createElement('span')
  span.className = 'fx-float' + (big ? ' fx-float-big' : '')
  span.textContent = text
  span.style.color = color
  span.style.left = `${rect.left + rect.width / 2}px`
  span.style.top = `${rect.top + rect.height / 3}px`
  document.body.appendChild(span)
  span.addEventListener('animationend', () => span.remove())
}

// 粒子迸发
export function burst(x, y, colors = ['#FFD98E', '#FF7EB6'], count = 14) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span')
    p.className = 'fx-particle'
    p.style.left = `${x}px`
    p.style.top = `${y}px`
    p.style.background = colors[i % colors.length]
    const ang = Math.random() * Math.PI * 2
    const dist = 40 + Math.random() * 70
    p.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(0.2)`, opacity: 0 },
    ], { duration: 500 + Math.random() * 400, easing: 'cubic-bezier(.1,.6,.3,1)' }).onfinish = () => p.remove()
    document.body.appendChild(p)
  }
}

// 震屏
export function shake(el = document.body, strength = 1) {
  el.animate([
    { transform: 'translate(0,0)' },
    { transform: `translate(${-4 * strength}px, ${2 * strength}px)` },
    { transform: `translate(${5 * strength}px, ${-2 * strength}px)` },
    { transform: `translate(${-3 * strength}px, ${1 * strength}px)` },
    { transform: 'translate(0,0)' },
  ], { duration: 260, easing: 'ease-out' })
}

// 元素弹跳入场
export function popIn(el, delay = 0) {
  if (!el) return
  el.animate([
    { transform: 'scale(0.4)', opacity: 0 },
    { transform: 'scale(1.08)', opacity: 1, offset: 0.7 },
    { transform: 'scale(1)', opacity: 1 },
  ], { duration: 380, delay, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'backwards' })
}
