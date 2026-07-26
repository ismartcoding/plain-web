import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorTextLayer } from '@/views/image-editor/utils/types'
import type { ImageEditorDoc } from './useImageEditorDoc'

interface ShadowPreset { label: string; offsetX: number; offsetY: number; blur: number; color: string }

const TEXT_SYNC_PRIMITIVES = [
  'fontFamily', 'color', 'fontSize', 'textAlign', 'fontWeight', 'fontStyle',
  'textDecoration', 'glow', 'rotation', 'letterSpacing',
] as const

const TEXT_SYNC_NESTED = ['textStroke', 'textShadow'] as const

export function useTextLayerEditor(
  layerRef: () => EditorTextLayer | null,
  rectRef: () => { top: number; left: number },
  doc: ImageEditorDoc,
  emitClose: () => void,
) {
  const { t } = useI18n()
  const panelRef = ref<HTMLElement | null>(null)

  function onClickOutside(e: MouseEvent) {
    if (!layerRef() || !panelRef.value) return
    if (panelRef.value.contains(e.target as Node)) return
    if ((e.target as HTMLElement).tagName === 'CANVAS') return
    emitClose()
  }

  const dragOffset = reactive({ x: 0, y: 0 })
  let _dragStartMx = 0, _dragStartMy = 0, _dragStartOx = 0, _dragStartOy = 0

  const posX = computed(() => rectRef().left + dragOffset.x)
  const posY = computed(() => rectRef().top + dragOffset.y)

  function onDragStart(e: PointerEvent) {
    _dragStartMx = e.clientX; _dragStartMy = e.clientY
    _dragStartOx = dragOffset.x; _dragStartOy = dragOffset.y
    document.addEventListener('pointermove', onDragMove)
    document.addEventListener('pointerup', onDragEnd)
  }
  function onDragMove(e: PointerEvent) {
    dragOffset.x = _dragStartOx + e.clientX - _dragStartMx
    dragOffset.y = _dragStartOy + e.clientY - _dragStartMy
  }
  function onDragEnd() {
    document.removeEventListener('pointermove', onDragMove)
    document.removeEventListener('pointerup', onDragEnd)
  }

  const showStroke = ref(false)
  const showShadow = ref(false)
  const showMore = ref(false)

  watch(layerRef, (layer) => {
    if (layer) {
      dragOffset.x = 0; dragOffset.y = 0
      setTimeout(() => document.addEventListener('pointerdown', onClickOutside), 0)
      showStroke.value = layer.textStroke.width > 0
      showShadow.value = layer.textShadow.blur > 0 || layer.textShadow.offsetX !== 0 || layer.textShadow.offsetY !== 0
      showMore.value = layer.rotation !== 0 || layer.letterSpacing !== 0
    } else {
      document.removeEventListener('pointerdown', onClickOutside)
    }
  })

  onUnmounted(() => document.removeEventListener('pointerdown', onClickOutside))

  const hasShadow = computed(() => {
    const s = layerRef()?.textShadow
    return s ? s.blur > 0 || s.offsetX !== 0 || s.offsetY !== 0 : false
  })

  const shadowPresets = computed<ShadowPreset[]>(() => [
    { label: t('image_editor.shadow_off'), offsetX: 0, offsetY: 0, blur: 0, color: 'rgba(0,0,0,0.7)' },
    { label: t('image_editor.shadow_soft'), offsetX: 0, offsetY: 0, blur: 12, color: 'rgba(0,0,0,0.7)' },
    { label: t('image_editor.shadow_hard'), offsetX: 4, offsetY: 4, blur: 0, color: '#000000' },
    { label: t('image_editor.shadow_drop'), offsetX: 6, offsetY: 6, blur: 8, color: 'rgba(0,0,0,0.6)' },
  ])

  function applyShadowPreset(preset: ShadowPreset) {
    const layer = layerRef()
    if (!layer) return
    doc.setLayerProp(layer.id, 'textShadow', {
      offsetX: preset.offsetX,
      offsetY: preset.offsetY,
      blur: preset.blur,
      color: preset.color,
    })
  }

  function isShadowPresetActive(preset: ShadowPreset): boolean {
    const s = layerRef()?.textShadow
    return s ? s.offsetX === preset.offsetX && s.offsetY === preset.offsetY && s.blur === preset.blur : false
  }

  // Sync v-model mutations back to Yjs.
  // props.layer reference changes when the binding rebuilds layers on an
  // external Yjs update → newLayer !== oldLayer → skip.
  // User v-model mutations keep the same reference → newLayer === oldLayer →
  // write all text-layer props back to Yjs in one transaction.
  watch(layerRef, (newLayer, oldLayer) => {
    if (!newLayer || newLayer !== oldLayer) return
    const src = newLayer as unknown as Record<string, unknown>
    doc.ydoc.transact(() => {
      for (const key of TEXT_SYNC_PRIMITIVES) {
        doc.setLayerProp(newLayer.id, key, src[key])
      }
      for (const key of TEXT_SYNC_NESTED) {
        const obj = src[key] as Record<string, unknown> | undefined
        if (obj) doc.setLayerProp(newLayer.id, key, { ...obj })
      }
    })
  }, { deep: true })

  return {
    panelRef, posX, posY, onDragStart,
    showStroke, showShadow, showMore, hasShadow,
    shadowPresets, applyShadowPreset, isShadowPresetActive,
  }
}
