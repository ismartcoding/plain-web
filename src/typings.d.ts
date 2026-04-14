import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    group?: string
    requiresAuth?: boolean
  }
}
