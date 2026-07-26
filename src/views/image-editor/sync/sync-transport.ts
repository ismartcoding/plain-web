/**
 * Real-time synchronization abstraction for the image-editor Yjs document.
 *
 * {@link EventSyncTransport} uses the existing app WebSocket for server→client
 * push (via eventbus subscription to `image_editor_update` events) and HTTP
 * GraphQL mutations for client→server. Follows the same pattern as ScreenMirror.
 */

export type UpdateHandler = (update: Uint8Array) => void
export type Unsubscribe = () => void

export interface SyncTransport {
  readonly connected: boolean
  connect(): Promise<void>
  disconnect(): void
  broadcastUpdate(update: Uint8Array): void
  onUpdate(handler: UpdateHandler): Unsubscribe
  destroy(): void
}
