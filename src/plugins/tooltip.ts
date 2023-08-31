import type { Directive, Plugin } from 'vue'

const plugin: Plugin = {
  install: (app) => {
    app.directive('tooltip', directive)
  },
}

const directive: Directive = {
  mounted: (el, binding) => {
    const tooltipText = binding.value as string
    let showTimeout: number | undefined
    let tooltipElement: HTMLDivElement | null = null

    function createTooltip() {
      tooltipElement = document.createElement('div')
      tooltipElement.className = 'tooltip'
      tooltipElement.textContent = tooltipText
      document.body.appendChild(tooltipElement)

      // Set initial styles for the tooltip
      if (tooltipElement) {
        tooltipElement.style.position = 'absolute'
        tooltipElement.style.visibility = 'hidden'
      }
    }

    function showTooltip() {
      if (!tooltipElement) {
        createTooltip()
      }

      const rect = el.getBoundingClientRect()
      if (tooltipElement) {
        const tooltipRect = tooltipElement.getBoundingClientRect()
        tooltipElement.style.top = rect.bottom + 8 + 'px'
        tooltipElement.style.left = rect.left - Math.abs(rect.width - tooltipRect.width) / 2 + 'px'
        tooltipElement.style.visibility = 'visible'
      }
    }

    el.mouseenterFunc = () => {
      showTimeout = setTimeout(showTooltip, 600)
    }

    el.addEventListener('mouseenter', el.mouseenterFunc)

    el.mouseleaveFunc = () => {
      clearTimeout(showTimeout)
      if (tooltipElement) {
        document.body.removeChild(tooltipElement)
        tooltipElement = null
      }
    }

    if (el.tagName === 'BUTTON') {
      el.addEventListener('click', el.mouseleaveFunc)
    }
    el.addEventListener('mouseleave', el.mouseleaveFunc)
  },
  unmounted: (el) => {
    el.mouseleaveFunc()
    el.removeEventListener('mouseenter', el.mouseenterFunc)
    if (el.tagName === 'BUTTON') {
      el.removeEventListener('click', el.mouseleaveFunc)
    }
    el.removeEventListener('mouseleave', el.mouseleaveFunc)
  },
}

export default plugin
