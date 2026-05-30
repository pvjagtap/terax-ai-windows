//! Wallpaper mode: pin the terminal fullscreen at the bottom of the Z-order
//! so it acts like a live desktop background while remaining interactive.
//! A global hotkey (Ctrl+Alt+W) is registered to toggle mode even if the window loses focus.

#[cfg(target_os = "windows")]
mod win {
    use std::ptr;
    use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
    use windows_sys::Win32::Foundation::{HWND, LPARAM, RECT};
    use windows_sys::Win32::Graphics::Gdi::{EnumDisplayMonitors, HDC, HMONITOR};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, ShowWindow,
        GWL_EXSTYLE, GWL_STYLE, HWND_BOTTOM, HWND_NOTOPMOST, SWP_FRAMECHANGED,
        SWP_SHOWWINDOW, SW_SHOW, WS_EX_APPWINDOW,
        WS_EX_TOOLWINDOW, WS_MAXIMIZE, WS_OVERLAPPEDWINDOW, WS_POPUP,
        WS_VISIBLE,
    };

    static ORIGINAL_STYLE: AtomicIsize = AtomicIsize::new(0);
    static ORIGINAL_EX_STYLE: AtomicIsize = AtomicIsize::new(0);
    static ORIGINAL_X: AtomicIsize = AtomicIsize::new(100);
    static ORIGINAL_Y: AtomicIsize = AtomicIsize::new(100);
    static ORIGINAL_W: AtomicIsize = AtomicIsize::new(1024);
    static ORIGINAL_H: AtomicIsize = AtomicIsize::new(700);
    pub static EMBEDDED: AtomicBool = AtomicBool::new(false);

    /// Get the primary monitor work area
    fn get_screen_size() -> (i32, i32, i32, i32) {
        use windows_sys::Win32::Foundation::BOOL;

        static mut RECT_RESULT: (i32, i32, i32, i32) = (0, 0, 1920, 1080);

        unsafe extern "system" fn monitor_proc(
            _monitor: HMONITOR,
            _hdc: HDC,
            rect: *mut RECT,
            _data: LPARAM,
        ) -> BOOL {
            if !rect.is_null() {
                let r = &*rect;
                RECT_RESULT = (r.left, r.top, r.right - r.left, r.bottom - r.top);
            }
            0 // stop after first (primary) monitor
        }

        unsafe {
            EnumDisplayMonitors(0 as HDC, ptr::null(), Some(monitor_proc), 0);
            RECT_RESULT
        }
    }

    /// Save current window geometry
    fn save_geometry(hwnd: HWND) {
        use windows_sys::Win32::UI::WindowsAndMessaging::GetWindowRect;
        unsafe {
            let mut rect: RECT = std::mem::zeroed();
            GetWindowRect(hwnd, &mut rect);
            ORIGINAL_X.store(rect.left as isize, Ordering::SeqCst);
            ORIGINAL_Y.store(rect.top as isize, Ordering::SeqCst);
            ORIGINAL_W.store((rect.right - rect.left) as isize, Ordering::SeqCst);
            ORIGINAL_H.store((rect.bottom - rect.top) as isize, Ordering::SeqCst);
        }
    }

    pub fn embed(hwnd: HWND) -> Result<(), String> {
        unsafe {
            // Save original state
            save_geometry(hwnd);
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            ORIGINAL_STYLE.store(style, Ordering::SeqCst);
            ORIGINAL_EX_STYLE.store(ex_style, Ordering::SeqCst);

            // Borderless fullscreen popup, hidden from taskbar
            let new_style = WS_POPUP | WS_VISIBLE | WS_MAXIMIZE;
            let new_ex_style = WS_EX_TOOLWINDOW; // hides from Alt+Tab & taskbar
            SetWindowLongPtrW(hwnd, GWL_STYLE, new_style as isize);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex_style as isize);

            // Fill screen, pin to bottom z-order
            let (x, y, w, h) = get_screen_size();
            SetWindowPos(
                hwnd,
                HWND_BOTTOM,
                x,
                y,
                w,
                h,
                SWP_FRAMECHANGED | SWP_SHOWWINDOW,
            );
            ShowWindow(hwnd, SW_SHOW);

            EMBEDDED.store(true, Ordering::SeqCst);
        }
        Ok(())
    }

    pub fn unembed(hwnd: HWND) -> Result<(), String> {
        unsafe {
            let orig_style = ORIGINAL_STYLE.load(Ordering::SeqCst);
            let orig_ex_style = ORIGINAL_EX_STYLE.load(Ordering::SeqCst);

            // Restore original window styles
            if orig_style != 0 {
                SetWindowLongPtrW(hwnd, GWL_STYLE, orig_style);
            } else {
                // Fallback: typical Tauri window style
                SetWindowLongPtrW(
                    hwnd,
                    GWL_STYLE,
                    (WS_OVERLAPPEDWINDOW | WS_VISIBLE) as isize,
                );
            }
            if orig_ex_style != 0 {
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, orig_ex_style);
            } else {
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, WS_EX_APPWINDOW as isize);
            }

            // Restore geometry
            let x = ORIGINAL_X.load(Ordering::SeqCst) as i32;
            let y = ORIGINAL_Y.load(Ordering::SeqCst) as i32;
            let w = ORIGINAL_W.load(Ordering::SeqCst) as i32;
            let h = ORIGINAL_H.load(Ordering::SeqCst) as i32;

            SetWindowPos(
                hwnd,
                HWND_NOTOPMOST,
                x,
                y,
                w,
                h,
                SWP_FRAMECHANGED | SWP_SHOWWINDOW,
            );
            ShowWindow(hwnd, SW_SHOW);

            EMBEDDED.store(false, Ordering::SeqCst);
        }
        Ok(())
    }

    pub fn is_embedded() -> bool {
        EMBEDDED.load(Ordering::SeqCst)
    }
}

#[cfg(target_os = "windows")]
use std::sync::OnceLock;

#[cfg(target_os = "windows")]
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

/// Call once during app setup to store the handle for the global hotkey callback.
#[cfg(target_os = "windows")]
pub fn init_wallpaper(app: &tauri::AppHandle) {
    let _ = APP_HANDLE.set(app.clone());
    // Register Ctrl+Alt+W global hotkey
    std::thread::spawn(|| {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            RegisterHotKey, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            GetMessageW, MSG, WM_HOTKEY,
        };
        unsafe {
            let id = 1;
            RegisterHotKey(
                ptr::null_mut(),
                id,
                (MOD_CONTROL | MOD_ALT | MOD_NOREPEAT) as u32,
                0x57, // 'W' key
            );

            let mut msg: MSG = std::mem::zeroed();
            loop {
                if GetMessageW(&mut msg, ptr::null_mut(), 0, 0) > 0 {
                    if msg.message == WM_HOTKEY && msg.wParam == id as usize {
                        if let Some(app) = APP_HANDLE.get() {
                            let _ = toggle_wallpaper(app);
                        }
                    }
                }
            }
        }
    });
}

#[cfg(target_os = "windows")]
use std::ptr;

#[cfg(target_os = "windows")]
fn toggle_wallpaper(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    let raw = window.hwnd().map_err(|e| e.to_string())?;
    let hwnd = raw.0 as *mut std::ffi::c_void;

    if win::is_embedded() {
        win::unembed(hwnd)?;
    } else {
        win::embed(hwnd)?;
    }
    // Notify frontend of state change
    let _ = tauri::Emitter::emit(&window, "wallpaper-mode-changed", !win::is_embedded());
    Ok(())
}

#[tauri::command]
pub async fn set_wallpaper_mode(app: tauri::AppHandle, enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use tauri::Manager;
        let window = app
            .get_webview_window("main")
            .ok_or("Main window not found")?;

        let raw = window.hwnd().map_err(|e| e.to_string())?;
        let hwnd = raw.0 as *mut std::ffi::c_void;

        if enable {
            win::embed(hwnd)?;
        } else {
            win::unembed(hwnd)?;
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, enable);
        Err("Wallpaper mode is only supported on Windows".into())
    }
}

