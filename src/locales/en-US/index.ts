const modules = import.meta.glob(['./*.ts', '!./index.ts'], { eager: true, import: 'default' })
export default Object.assign({}, ...(Object.values(modules) as any[]))
