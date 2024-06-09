export const useLeftSidebarResize = (minWidth: number, getWidth: () => number, setWidth: (width: number) => void) => {
  return {
    resizeWidth: (e: MouseEvent) => {
      const startX = e.clientX
      const startWidth = getWidth()
      const appElement = document.getElementById('app')
      if (appElement) {
        appElement.style.userSelect = 'none'
      }
      const move = (e: MouseEvent) => {
        let width = startWidth + (e.clientX - startX)
        if (width < minWidth) {
          width = minWidth
        }
        setWidth(width)
      }
      const up = () => {
        appElement?.style.removeProperty('user-select')
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
  }
}
