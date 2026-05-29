//! async-graphql schema: output types, QueryRoot, MutationRoot.

mod app;
mod bookmark;
mod chat;
mod datastore;
mod db;
mod logs;
mod stub;
pub mod types;
mod util;

use async_graphql::{EmptySubscription, MergedObject, Schema};

use app::{AppMutation, AppQuery};
use bookmark::{BookmarkMutation, BookmarkQuery};
use chat::{ChatMutation, ChatQuery};
use datastore::{DataStoreMutation, DataStoreQuery};
use db::{DbMutation, DbQuery};
use logs::{LogsMutation, LogsQuery};
use stub::StubQuery;

#[derive(MergedObject, Default)]
pub struct QueryRoot(
    AppQuery,
    BookmarkQuery,
    ChatQuery,
    LogsQuery,
    DataStoreQuery,
    DbQuery,
    StubQuery,
);

#[derive(MergedObject, Default)]
pub struct MutationRoot(
    AppMutation,
    BookmarkMutation,
    ChatMutation,
    LogsMutation,
    DataStoreMutation,
    DbMutation,
);

pub type LocalSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn build_schema() -> LocalSchema {
    Schema::build(
        QueryRoot::default(),
        MutationRoot::default(),
        EmptySubscription,
    )
    .finish()
}
