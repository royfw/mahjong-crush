// 音效（Web Audio 即時合成，不需音檔）+ 震動（Android 支援；iOS Safari 無 Vibration API）

const MUTE_KEY = 'mahjong-crush-muted'

let ctx: AudioContext | null = null
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
})()

export const isMuted = () => muted

export function setMuted(v: boolean) {
  muted = v
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** 手機瀏覽器規定要在使用者手勢中啟動 AudioContext */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

function vibrate(pattern: number | number[]) {
  if (muted) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* ignore */
  }
}

interface ToneOpts {
  type?: OscillatorType
  gain?: number
  at?: number // 延遲秒數
  slideTo?: number
}

function tone(freq: number, dur: number, { type = 'sine', gain = 0.12, at = 0, slideTo }: ToneOpts = {}) {
  if (muted || !ctx) return
  const t0 = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function noise(dur: number, gain = 0.25, at = 0) {
  if (muted || !ctx) return
  const t0 = ctx.currentTime + at
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2
  const src = ctx.createBufferSource()
  const g = ctx.createGain()
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  src.buffer = buf
  g.gain.value = gain
  src.connect(lp).connect(g).connect(ctx.destination)
  src.start(t0)
}

// 五聲音階：Combo 越高音越高，聽起來有「東方味」又不會刺耳
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760]

export const fx = {
  /** 推牌：短促的「喀」像麻將牌碰撞 */
  move() {
    tone(1400, 0.04, { type: 'triangle', gain: 0.05 })
    tone(700, 0.05, { type: 'square', gain: 0.02, at: 0.01 })
    vibrate(8)
  },
  invalid() {
    tone(140, 0.08, { type: 'triangle', gain: 0.06 })
  },
  /** 消除：音高隨 Combo 往上爬 */
  clear(chain: number) {
    const base = Math.min(chain - 1, PENTA.length - 3)
    PENTA.slice(base, base + 3).forEach((f, i) => tone(f, 0.18, { type: 'triangle', gain: 0.1, at: i * 0.05 }))
    vibrate(chain >= 2 ? [25, 30, 25 + chain * 10] : 25)
  },
  streak() {
    ;[659.25, 880, 1318.51].forEach((f, i) => tone(f, 0.12, { type: 'square', gain: 0.04, at: i * 0.06 }))
  },
  bomb() {
    noise(0.5, 0.45)
    tone(160, 0.45, { type: 'sine', gain: 0.25, slideTo: 40 })
    vibrate([60, 30, 80])
  },
  sweep() {
    noise(0.3, 0.2)
    tone(300, 0.3, { type: 'sawtooth', gain: 0.05, slideTo: 1200 })
    vibrate([30, 20, 30])
  },
  sparkle() {
    ;[1567.98, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.15, { type: 'sine', gain: 0.06, at: i * 0.04 }))
    vibrate(40)
  },
  levelUp() {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.25, { type: 'triangle', gain: 0.1, at: i * 0.09 }))
    vibrate([30, 40, 30, 40, 80])
  },
  damage() {
    tone(180, 0.35, { type: 'sawtooth', gain: 0.08, slideTo: 60 })
    noise(0.25, 0.2)
    vibrate([120, 60, 120])
  },
  gameOver() {
    ;[523.25, 392, 329.63, 261.63].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.1, at: i * 0.16 }))
    vibrate([200, 100, 300])
  },
}
