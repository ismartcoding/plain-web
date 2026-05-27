//! async-graphql schema: output types, QueryRoot, MutationRoot.

pub mod types;
mod app;
mod chat;
mod datastore;
mod db;
mod logs;
mod stub;
mod util;

use async_graphql::{EmptySubscription, MergedObject, Schema};

use app::{AppMutation, AppQuery};
use chat::{ChatMutation, ChatQuery};
use datastore::{DataStoreMutation, DataStoreQuery};
use db::{DbMutation, DbQuery};
use logs::{LogsMutation, LogsQuery};
use stub::StubQuery;

#[derive(MergedObject, Default)]
pub struct QueryRoot(AppQuery, ChatQuery, LogsQuery, DataStoreQuery, DbQuery, StubQuery);

#[derive(MergedObject, Default)]
pub struct MutationRoot(AppMutation, ChatMutation, LogsMutation, DataStoreMutation, DbMutation);

pub type LocalSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn build_schema() -> LocalSchema {
    Schema::build(QueryRoot::default(), MutationRoot::default(), EmptySubscription).finish()
}
