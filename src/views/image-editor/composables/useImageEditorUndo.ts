import * as Y from 'yjs'
import { shallowRef } from 'vue'
import type { ImageEditorDoc } from './useImageEditorDoc'

export function useImageEditorUndo(doc: ImageEditorDoc) {
  const undoManager = new Y.UndoManager(
    [doc.yLayers, doc.meta, doc.yImages],
    {
      trackedOrigins: new Set([null]),
      captureTimeout: 0,
    },
  )

  const canUndo = shallowRef(undoManager.undoStack.length > 0)
  const canRedo = shallowRef(undoManager.redoStack.length > 0)

  function refresh() {
    canUndo.value = undoManager.undoStack.length > 0
    canRedo.value = undoManager.redoStack.length > 0
  }

  undoManager.on('stack-item-added', refresh)
  undoManager.on('stack-item-popped', refresh)
  undoManager.on('stack-cleared', refresh)

  function undo() {
    if (undoManager.undoStack.length === 0) return
    undoManager.undo()
  }

  function redo() {
    if (undoManager.redoStack.length === 0) return
    undoManager.redo()
  }

  function pushUndo() {
    undoManager.stopCapturing()
  }

  function clearHistory() {
    undoManager.clear()
  }

  function dispose() {
    undoManager.off('stack-item-added', refresh)
    undoManager.off('stack-item-popped', refresh)
    undoManager.off('stack-cleared', refresh)
    undoManager.destroy()
  }

  return {
    undoManager,
    canUndo,
    canRedo,
    undo,
    redo,
    pushUndo,
    clearHistory,
    dispose,
  }
}

export type ImageEditorUndo = ReturnType<typeof useImageEditorUndo>
