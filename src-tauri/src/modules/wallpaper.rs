//! Wallpaper mode: embed/unembed the window behind desktop icons using the WorkerW trick.

#[cfg(target_os = "windows")]
mod win {
    use std::ffi::c_void;
    use std::ptr;
    use std::sync::atomic::{AtomicIsize, AtomicPtr, Ordering};
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, RECT, TRUE};
    use windows_sys::Win32::Graphics::Gdi::{EnumDisplayMonitors, HDC, HMONITOR};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, FindWindowExW, FindWindowW, GetWindowLongPtrW,
        SendMessageTimeoutW, SetParent, SetWindowLongPtrW, SetWindowPos,
        ShowWindow, GWL_EXSTYLE, GWL_STYLE, HWND_BOTTOM, SMTO_NORMAL,
        SWP_NOACTIVATE, SWP_NOZORDER, SW_SHOW, WS_CHILD, WS_EX_TOOLWINDOW,
        WS_POPUP,
    };

    static WORKER_W: AtomicPtr<c_void> = AtomicPtr::new(ptr::null_mut());
    static ORIGINAL_PARENT: AtomicPtr<c_void> = AtomicPtr::new(ptr::null_mut());
    static ORIGINAL_STYLE: AtomicIsize = AtomicIsize::new(0);
    static ORIGINAL_EX_STYLE: AtomicIsize = AtomicIsize::new(0);

    fn wide_str(s: &str) -> Vec<u16> {
        s.encode_utf16().collect()
    }

    fn find_worker_w() -> Option<HWND> {
        unsafe {
            let class = wide_str("Progman\0");
            let progman = FindWindowW(class.as_ptr(), ptr::null());
            if progman.is_null() {
                return None;
            }

            let mut _result: usize = 0;
            SendMessageTimeoutW(
                progman,
                0x052C,
                0xD,
                0x1,
                SMTO_NORMAL,
                1000,
                &mut _result as *mut usize,
            );

            WORKER_W.store(ptr::null_mut(), Ordering::SeqCst);
            EnumWindows(Some(enum_windows_proc), 0);

            let w = WORKER_W.load(Ordering::SeqCst);
            if !w.is_null() { Some(w) } else { None }
        }
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: HWND, _: LPARAM) -> BOOL {
        let class = wide_str("SHELLDLL_DefView\0");
        let shell = FindWindowExW(hwnd, ptr::null_mut(), class.as_ptr(), ptr::null());
        if !shell.is_null() {
            let wclass = wide_str("WorkerW\0");
            let worker = FindWindowExW(ptr::null_mut(), hwnd, wclass.as_ptr(), ptr::null());
            if !worker.is_null() {
                WORKER_W.store(worker, Ordering::SeqCst);
            }
        }
        TRUE
    }

    fn get_screen_size() -> (i32, i32, i32, i32) {
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
            0
        }

        unsafe {
            EnumDisplayMonitors(0 as HDC, ptr::null(), Some(monitor_proc), 0);
            RECT_RESULT
        }
    }

    pub fn embed(hwnd: HWND) -> Result<(), String> {
        let worker_w = find_worker_w().ok_or("Failed to find WorkerW window")?;

        unsafe {
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            ORIGINAL_STYLE.store(style, Ordering::SeqCst);
            ORIGINAL_EX_STYLE.store(ex_style, Ordering::SeqCst);

            SetWindowLongPtrW(hwnd, GWL_STYLE, (WS_CHILD | WS_POPUP) as isize);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, WS_EX_TOOLWINDOW as isize);

            let prev = SetParent(hwnd, worker_w);
            ORIGINAL_PARENT.store(prev, Ordering::SeqCst);

            let (x, y, w, h) = get_screen_size();
            SetWindowPos(hwnd, HWND_BOTTOM, x, y, w, h, SWP_NOACTIVATE | SWP_NOZORDER);
            ShowWindow(hwnd, SW_SHOW);
        }

        Ok(())
    }

    pub fn unembed(hwnd: HWND) -> Result<(), String> {
        unsafe {
            let orig_parent = ORIGINAL_PARENT.load(Ordering::SeqCst);
            let orig_style = ORIGINAL_STYLE.load(Ordering::SeqCst);
            let orig_ex_style = ORIGINAL_EX_STYLE.load(Ordering::SeqCst);

            SetParent(hwnd, orig_parent);

            if orig_style != 0 {
                SetWindowLongPtrW(hwnd, GWL_STYLE, orig_style);
            }
            if orig_ex_style != 0 {
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, orig_ex_style);
            }

            SetWindowPos(hwnd, ptr::null_mut(), 100, 100, 1024, 700, SWP_NOZORDER);
            ShowWindow(hwnd, SW_SHOW);
        }
        Ok(())
    }
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
