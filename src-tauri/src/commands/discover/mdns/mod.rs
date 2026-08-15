//! mDNS discovery — mirrors plain-app `shared/.../plain/mdns/*` (RFC 6762).
//!
//! Replaces the old LAN discovery (custom UDP multicast on
//! `224.0.0.100:52352`). Discovery runs over mDNS: publishing the
//! `_plainapp._tcp.local` service is driven by the HTTPS server lifecycle,
//! while [`host_responder`] guarantees the shared responder socket is up so
//! the browser can send queries.

pub(crate) mod host_responder;
pub(crate) mod packet_codec;
pub(crate) mod service_browser;
pub(crate) mod service_info;
pub(crate) mod service_response_builder;
