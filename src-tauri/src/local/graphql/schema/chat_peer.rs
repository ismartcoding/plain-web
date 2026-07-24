//! Peer mutations — mirrors plain-app's
//! `web/schemas/ChatPeerGraphQL.kt` + `chat/peer/PeerManager.kt`.
//!
//! Both `deletePeer` and `unpairPeer` resolve through the same
//! `PeerManager` entry points as the Android side so the resulting
//! DB / cache state is identical regardless of which client issued
//! the call.

use async_graphql::{Context, Object};
use std::sync::Arc;

use super::super::context::{refresh_peer_key_cache, AppCtx, WsEvent, WS_PEER_STATUS_UPDATED};
use crate::local::channel::messages::PEER_STATUS_CHANNEL;

#[derive(Default)]
pub struct ChatPeerMutation;

#[Object]
impl ChatPeerMutation {
    /// Mirrors plain-app `PeerManager.deletePeer(peerId)`:
    ///   1. Delete all 1:1 chats with the peer (`ChatDbHelper.deleteAllChatsAsync`).
    ///   2. If the peer is still a member of any local channel, demote it
    ///      to `status="channel"` with an empty shared key — the row
    ///      must remain so channel routing can still resolve it.
    ///   3. Otherwise delete the peer row outright.
    ///   4. Refresh the peer key cache so future deliveries skip the
    ///      demoted / deleted peer.
    ///
    /// Returns `false` if the peer id is unknown, `true` otherwise.
    /// The frontend's `PeerManager.deletePeer` re-fetches the peers /
    /// latest-chats lists on success; no WS event is required.
    async fn delete_peer(&self, ctx: &Context<'_>, id: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        let Some(_peer) = c.db.get_peer_by_id(&id) else {
            return false;
        };

        c.db.delete_chats_by_peer(&id);

        if c.db.any_channel_has_member(&id) {
            c.db.update_peer_status_and_key(&id, PEER_STATUS_CHANNEL, "");
        } else {
            c.db.delete_peer(&id);
        }

        refresh_peer_key_cache(&c.db, &c.peer_key_cache);

        // Mark the peer offline so the frontend's `peer_status_updated`
        // listener clears any stale "online" badge before the re-fetch
        // arrives. Matches plain-app's `PeerCacher.setOnline(false)`
        // implicit behavior on removal.
        let _ = c.event_tx.send(WsEvent {
            event_type: WS_PEER_STATUS_UPDATED,
            payload: serde_json::json!({ "id": id, "online": false }).to_string(),
        });

        true
    }

    /// Mirrors plain-app `PeerManager.markUnpaired(peerId)` (invoked
    /// indirectly via `NearbyViewModel.unpairDevice`): flips the peer's
    /// status to "unpaired" and bumps `updated_at`, leaving the shared
    /// key intact so a future re-pair can reuse the stored credentials.
    ///
    /// Returns `false` if the peer id is unknown, `true` otherwise.
    async fn unpair_peer(&self, ctx: &Context<'_>, id: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        let Some(_peer) = c.db.get_peer_by_id(&id) else {
            return false;
        };

        c.db.update_peer_status(&id, "unpaired");
        refresh_peer_key_cache(&c.db, &c.peer_key_cache);

        // Surface the status change so the frontend clears the online
        // badge immediately; the `NearbyModal` caller also re-fetches
        // the peers list on the mutation's `onDone`.
        let _ = c.event_tx.send(WsEvent {
            event_type: WS_PEER_STATUS_UPDATED,
            payload: serde_json::json!({ "id": id, "online": false }).to_string(),
        });

        true
    }
}
