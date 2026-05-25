//! async-graphql schema: output types, QueryRoot, MutationRoot.

pub mod mutation;
pub mod query;
pub mod types;

use async_graphql::{EmptySubscription, Schema};
use mutation::MutationRoot;
use query::QueryRoot;

// ── Schema ────────────────────────────────────────────────────────────────────

pub type LocalSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn build_schema() -> LocalSchema {
    Schema::build(QueryRoot, MutationRoot, EmptySubscription).finish()
}
