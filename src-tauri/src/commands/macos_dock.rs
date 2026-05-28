use std::sync::OnceLock;

use objc2::runtime::{AnyObject, ClassBuilder, Sel};
use objc2::{msg_send, sel, ClassType};
use objc2_app_kit::{NSApplication, NSMenu, NSMenuItem};
use objc2_foundation::{MainThreadMarker, NSString};

static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

fn register_action_class() -> &'static objc2::runtime::AnyClass {
    static CLASS: OnceLock<&'static objc2::runtime::AnyClass> = OnceLock::new();
    *CLASS.get_or_init(|| {
        use objc2::runtime::NSObject;
        let mut builder = ClassBuilder::new(c"PlainAppDockTarget", NSObject::class())
            .expect("PlainAppDockTarget should be unique");

        unsafe extern "C-unwind" fn open_new_window(
            _this: *mut AnyObject,
            _cmd: Sel,
            _sender: *mut AnyObject,
        ) {
            if let Some(h) = APP_HANDLE.get() {
                crate::commands::window::create_window(h, "/".to_string());
            }
        }

        unsafe {
            builder.add_method(
                sel!(openNewWindow:),
                open_new_window as unsafe extern "C-unwind" fn(*mut AnyObject, Sel, *mut AnyObject),
            );
        }

        builder.register()
    })
}

/// Sets the macOS dock right-click menu to include "New Window".
/// Must be called from the main thread.
pub fn setup(handle: tauri::AppHandle) {
    let _ = APP_HANDLE.set(handle);

    unsafe {
        let cls = register_action_class();

        // `new` → +1 retained. Leak intentionally: this target lives for the app's lifetime.
        let target: *mut AnyObject = msg_send![cls, new];

        let mtm = MainThreadMarker::new_unchecked();
        let app = NSApplication::sharedApplication(mtm);

        let menu = NSMenu::new(mtm);
        let title = NSString::from_str("New Window");
        let key = NSString::from_str("");
        let action = sel!(openNewWindow:);

        // alloc + initWithTitle:action:keyEquivalent: → +1 retained.
        let item: *mut AnyObject = msg_send![NSMenuItem::class(), alloc];
        let item: *mut AnyObject =
            msg_send![item, initWithTitle: &*title, action: action, keyEquivalent: &*key];
        let _: () = msg_send![item, setTarget: target];
        menu.addItem(&*(item as *const NSMenuItem));
        // Release our +1 on item — the menu now holds the only retain.
        let _: () = msg_send![item, release];

        // NSApp retains the dock menu.
        let _: () = msg_send![&*app, setDockMenu: &*menu];
    }
}
