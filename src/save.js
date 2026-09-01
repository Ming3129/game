// 存档：一个 key + schema version，走平台 sdk.storage，不使用浏览器本地存储。
import { getState, snapshot } from './state.js'

const SAVE_KEY = 'save:blindbag'
const SCHEMA_VERSION = 1

let _sdk = null

export function bindSdk(sdk) {
  _sdk = sdk
}

export async function load() {
  if (!_sdk) return null
  try {
    const { value } = await _sdk.storage.get({ key: SAVE_KEY })
    return value ?? null
  } catch (e) {
    console.warn('[save] load failed', e)
    return null
  }
}

export async function saveNow(data) {
  if (!_sdk) return
  const payload = data ?? snapshot(getState())
  try {
    await _sdk.storage.set({ key: SAVE_KEY, value: { v: SCHEMA_VERSION, ...payload } })
  } catch (e) {
    console.warn('[save] save failed', e)
  }
}
