// 存档：优先走平台 sdk.storage，本地降级使用 localStorage。
import { getState, snapshot } from './state.js'

const SAVE_KEY = 'save:blindbag'
const SCHEMA_VERSION = 1

let _sdk = null

export function bindSdk(sdk) {
  _sdk = sdk
}

export async function load() {
  if (_sdk) {
    try {
      const { value } = await _sdk.storage.get({ key: SAVE_KEY })
      return value ?? null
    } catch (e) {
      console.warn('[save] load failed', e)
    }
  }
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export async function saveNow(data) {
  const payload = data ?? snapshot(getState())
  if (_sdk) {
    try {
      await _sdk.storage.set({ key: SAVE_KEY, value: { v: SCHEMA_VERSION, ...payload } })
      return
    } catch (e) {
      console.warn('[save] save failed', e)
    }
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: SCHEMA_VERSION, ...payload }))
  } catch (e) {
    console.warn('[save] local save failed', e)
  }
}
