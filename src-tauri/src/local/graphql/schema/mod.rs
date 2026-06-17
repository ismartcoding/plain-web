//! async-graphql schema: output types, QueryRoot, MutationRoot.

mod app;
mod bookmark;
mod chat_channel;
mod chat_message;
mod chat_query;
mod datastore;
mod db;
mod discover;
mod file_query;
mod file_upload;
mod logs;
mod stub;
mod tag;
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
use discover::DiscoverMutation;
use file_query::FileInfoQuery;
use file_upload::{FileUploadMutation, FileUploadQuery};
use logs::{LogsMutation, LogsQuery};
use stub::StubQuery;
use tag::TagQuery;

#[derive(MergedObject, Default)]
pub struct QueryRoot(
    AppQuery,
    BookmarkQuery,
    ChatQuery,
    LogsQuery,
    DataStoreQuery,
    DbQuery,
    FileUploadQuery,
    FileInfoQuery,
    TagQuery,
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
    DiscoverMutation,
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
