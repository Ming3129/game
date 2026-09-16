// 存档系统：基于平台托管 KV storage 能力，以 user scope 隔离存储。
// 同时保留本地 localStorage 作为备用底座，确保跨环境与离线高可用。
import { getState, snapshot } from './state.js'

const SAVE_KEY = 'save:slot1'
const LEGACY_SAVE_KEY = 'save:blindbag'
const SCHEMA_VERSION = 1

let _sdk = null
let _lastVersion = 0

export function bindSdk(sdk) {
  _sdk = sdk
}

function getStorageInstance() {
  if (_sdk?.storage && typeof _sdk.storage.get === 'function') {
    return _sdk.storage
  }
  if (typeof window !== 'undefined' && window.sdk?.storage && typeof window.sdk.storage.get === 'function') {
    return window.sdk.storage
  }
  return null
}

// 统一解析存档数据，支持单值对象、字符串或包装结构
function parseSavePayload(raw) {
  if (!raw) return null
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch (_) {
      return null
    }
  }
  if (data && typeof data === 'object' && 'value' in data && (data.value && typeof data.value === 'object')) {
    data = data.value
  }
  if (data && typeof data === 'object' && typeof data.day === 'number') {
    return data
  }
  return null
}

export async function load() {
  const storage = getStorageInstance()
  let sdkData = null

  // 1. 优先读取平台托管 KV 存储（默认 user scope 隔离）
  if (storage) {
    try {
      // 优先从标准 key 读取
      let res = await storage.get({ key: SAVE_KEY, scope: 'user' })
      if (!res?.value) {
        // 兼容迁移旧 key 存档
        res = await storage.get({ key: LEGACY_SAVE_KEY, scope: 'user' })
      }
      if (res && res.value) {
        _lastVersion = res.version || 0
        sdkData = parseSavePayload(res.value)
      }
    } catch (e) {
      console.warn('[save] platform storage.get failed, falling back', e)
    }
  }

  // 2. 本地备用读取
  let localData = null
  try {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY)
    localData = parseSavePayload(raw)
  } catch (e) {
    console.warn('[save] localStorage.getItem failed', e)
  }

  // 3. 比较两个源头：优先采用天数更高或具有更新时间戳的有效档
  if (sdkData && localData) {
    const sdkTime = sdkData.updatedAt || 0
    const localTime = localData.updatedAt || 0
    if (sdkData.day > localData.day) return sdkData
    if (localData.day > sdkData.day) return localData
    return (sdkTime >= localTime) ? sdkData : localData
  }

  return sdkData || localData || null
}

export async function saveNow(data) {
  const payload = data ?? snapshot(getState())
  if (!payload || typeof payload !== 'object') return
  const fullPayload = { v: SCHEMA_VERSION, ...payload, updatedAt: Date.now() }

  // 1. 本地 localStorage 同步写入兜底
  try {
    const serialized = JSON.stringify(fullPayload)
    localStorage.setItem(SAVE_KEY, serialized)
    localStorage.setItem(LEGACY_SAVE_KEY, serialized)
  } catch (e) {
    console.warn('[save] local save failed', e)
  }

  // 2. 平台托管 KV 存储（单值 ≤ 256KB 结构化 JSON，按 user scope 隔离）
  const storage = getStorageInstance()
  if (storage) {
    try {
      const res = await storage.set({
        key: SAVE_KEY,
        value: fullPayload,
        scope: 'user'
      })
      if (res?.version) {
        _lastVersion = res.version
      }
    } catch (e) {
      console.warn('[save] platform storage.set failed', e)
    }
  }
}

// 删除存档（用于重新开店或清档）
export async function clearSave() {
  _lastVersion = 0
  try {
    localStorage.removeItem(SAVE_KEY)
    localStorage.removeItem(LEGACY_SAVE_KEY)
  } catch (_) {}

  const storage = getStorageInstance()
  if (storage) {
    try {
      await storage.del({ key: SAVE_KEY, scope: 'user' })
      await storage.del({ key: LEGACY_SAVE_KEY, scope: 'user' })
    } catch (e) {
      console.warn('[save] platform storage.del failed', e)
    }
  }
}

