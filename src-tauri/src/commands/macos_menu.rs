use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

pub fn setup(app: &mut tauri::App) -> tauri::Result<()> {
    // ── App menu (first menu on macOS is the app name) ────────────────────
    let services = PredefinedMenuItem::services(app, None)?;
    let hide = PredefinedMenuItem::hide(app, None)?;
    let hide_others = PredefinedMenuItem::hide_others(app, None)?;
    let show_all = PredefinedMenuItem::show_all(app, None)?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit PlainApp"))?;
    let app_submenu = SubmenuBuilder::new(app, "PlainApp")
        .item(&services)
        .separator()
        .item(&hide)
        .item(&hide_others)
        .item(&show_all)
        .separator()
        .item(&quit)
        .build()?;

    // ── File menu ─────────────────────────────────────────────────────────
    let new_window = MenuItemBuilder::with_id("new-window", "New Window")
        .accelerator("CmdOrCtrl+Shift+N")
        .build(app)?;
    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&new_window)
        .build()?;

    // ── Edit menu (standard items so cut/copy/paste/undo work) ───────────
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    // ── Window menu ───────────────────────────────────────────────────────
    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&app_submenu)
        .item(&file_submenu)
        .item(&edit_submenu)
        .item(&window_submenu)
        .build()?;
    app.set_menu(menu)?;

    // ── Dock right-click menu ─────────────────────────────────────────────
    super::macos_dock::setup(app.handle().clone());

    // ── Menu event handler ────────────────────────────────────────────────
    app.on_menu_event(|app, event| match event.id().as_ref() {
        "new-window" => super::window::create_window(app, "/".to_string()),
        _ => {}
    });

    Ok(())
}
