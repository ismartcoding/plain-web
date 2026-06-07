//! async-graphql schema: output types, QueryRoot, MutationRoot.

mod app;
mod bookmark;
mod chat_channel;
mod chat_message;
mod chat_query;
mod datastore;
mod db;
mod file_upload;
mod logs;
mod stub;
pub mod types;
mod util;

use async_graphql::{EmptySubscription, MergedObject, Schema};

use app::{AppMutation, AppQuery};
use bookmark::{BookmarkMutation, BookmarkQuery};
use chat_channel::ChatChannelMutation;
use chat_message::ChatMessageMutation;
use chat_query::ChatQuery;
use datastore::{DataStoreMutation, DataStoreQuery};
use db::{DbMutation, DbQuery};
use file_upload::{FileUploadMutation, FileUploadQuery};
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
    FileUploadQuery,
    StubQuery,
);

#[derive(MergedObject, Default)]
pub struct MutationRoot(
    AppMutation,
    BookmarkMutation,
    ChatMessageMutation,
    ChatChannelMutation,
    LogsMutation,
    DataStoreMutation,
    DbMutation,
    FileUploadMutation,
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
