// Exclude `./timeago.ts` — its payload contains a function (`plural`) that
// vue-i18n cannot serialise into the message map. `@/lib/timeago` loads
// it on demand via its own `import.meta.glob`.
const modules = import.meta.glob(['./*.ts', '!./index.ts', '!./timeago.ts'], { eager: true, import: 'default' })
export default Object.assign({}, ...(Object.values(modules) as any[]))
