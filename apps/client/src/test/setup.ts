import '@testing-library/jest-dom/vitest'

function memoryStorage(): Storage {
  const memory = new Map<string, string>()
  return {
    get length() {
      return memory.size
    },
    clear() {
      memory.clear()
    },
    getItem(key) {
      return memory.get(key) ?? null
    },
    key(index) {
      return [...memory.keys()][index] ?? null
    },
    removeItem(key) {
      memory.delete(key)
    },
    setItem(key, value) {
      memory.set(key, String(value))
    },
  }
}

function ensureStorage(name: 'localStorage' | 'sessionStorage') {
  const current = (globalThis as Record<string, unknown>)[name] as Storage | undefined
  if (current && typeof current.setItem === 'function') return
  const storage = memoryStorage()
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: storage,
  })
  Object.defineProperty(window, name, {
    configurable: true,
    writable: true,
    value: storage,
  })
}

ensureStorage('localStorage')
ensureStorage('sessionStorage')

