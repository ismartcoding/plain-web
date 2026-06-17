use async_graphql::{Context, Object};
use std::sync::Arc;

use super::super::context::AppCtx;

#[derive(Default)]
pub struct DiscoverMutation;

#[Object]
impl DiscoverMutation {
    /// Mirrors plain-app's `startDiscovering` mutation: kicks off the
    /// background scan loop that pushes discovered devices over the
    /// local server WS as `WS_NEARBY_DEVICE_FOUND`. Returns `true` if
    /// the loop was started, `false` if it was already running.
    async fn start_discovering(&self, ctx: &Context<'_>) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        c.discover_manager.start_discovering()
    }

    /// Mirrors plain-app's `stopDiscovering` mutation: tears down the
    /// background scan loop started by `startDiscovering`. Returns
    /// `true` if a loop was cancelled, `false` if none was active.
    async fn stop_discovering(&self, ctx: &Context<'_>) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        c.discover_manager.stop_discovering()
    }
}