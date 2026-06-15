// Exclude `./timeago.ts` — `@/lib/timeago` loads it on demand via its
// own `import.meta.glob`; bundling it into the i18n message map would
// duplicate the strings.
const modules = import.meta.glob(['./*.ts', '!./index.ts', '!./timeago.ts'], { eager: true, import: 'default' })
export default Object.assign({}, ...(Object.values(modules) as any[]))
