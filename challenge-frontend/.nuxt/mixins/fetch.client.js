import Vue from 'vue'
import { hasFetch, normalizeError, addLifecycleHook, createGetCounter } from '../utils'

const isSsrHydration = (vm) =>
  vm.$vnode && vm.$vnode.elm && vm.$vnode.elm.dataset && vm.$vnode.elm.dataset.fetchKey
const nuxtState = window.__NUXT__

export default {
  beforeCreate() {
    if (!hasFetch(this)) {
      return
    }

    this._fetchDelay = typeof this.$options.fetchDelay === 'number' ? this.$options.fetchDelay : 200

    Vue.util.defineReactive(this, '$fetchState', {
      pending: false,
      error: null,
      timestamp: Date.now(),
    })

    this.$fetch = $fetch.bind(this)
    addLifecycleHook(this, 'created', created)
    addLifecycleHook(this, 'beforeMount', beforeMount)
  },
}

function beforeMount() {
  if (!this._hydrated) {
    return this.$fetch()
  }
}

function created() {
  if (!isSsrHydration(this)) {
    return
  }

  // Hydrate component
  this._hydrated = true
  this._fetchKey = this.$vnode.elm.dataset.fetchKey
  const data = nuxtState.fetch[this._fetchKey]

  // If fetch error
  if (data && data._error) {
    this.$fetchState.error = data._error
    return
  }

  // Merge data
  for (const key in data) {
    Vue.set(this.$data, key, data[key])
  }
}

function $fetch() {
  if (!this._fetchPromise) {
    this._fetchPromise = $_fetch.call(this).then(() => {
      delete this._fetchPromise
    })
  }
  return this._fetchPromise
}

async function $_fetch() {
  this.$nuxt.nbFetching++
  this.$fetchState.pending = true
  this.$fetchState.error = null
  this._hydrated = false
  let error = null
  const startTime = Date.now()

  try {
    await this.$options.fetch.call(this)
  } catch (err) {
    if (process.dev) {
      console.error('Error in fetch():', err)
    }
    error = normalizeError(err)
  }

  const delayLeft = this._fetchDelay - (Date.now() - startTime)
  if (delayLeft > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayLeft))
  }

  this.$fetchState.error = error
  this.$fetchState.pending = false
  this.$fetchState.timestamp = Date.now()

  this.$nextTick(() => this.$nuxt.nbFetching--)
}
