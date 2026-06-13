import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

async function initSplash() {
    const loadingState = document.getElementById('loadingState')!;
    const errorState = document.getElementById('errorState')!;
    const btnExit = document.getElementById('btnExit')!;
    const errorText = document.getElementById('errorText')!;

    let hasError = false;

    // Listen for backend error events from Rust
    listen('backend-error', (event) => {
        hasError = true;
        const code = event.payload;
        loadingState.style.display = 'none';
        errorState.style.display = 'flex';
        
        if (code === 98) {
            errorText.innerHTML = `后端 <b>8787</b> 端口被占用。 请清理占用端口的进程，或者修改配置文件中的服务端口。`;
        } else {
            errorText.innerHTML = `后端异常退出 (代码：${code})`;
        }
    });

    btnExit.addEventListener('click', async () => {
        await invoke('exit_app');
    });

    try {
        const url = await invoke<string>('get_backend_url');
        
        // Wait for backend to be ready
        const start = Date.now();
        const timeout = 15000;
        let isReady = false;

        while (Date.now() - start < timeout && !hasError) {
            // First, actively check if backend already crashed
            try {
                await invoke('check_backend_status');
            } catch (code) {
                hasError = true;
                loadingState.style.display = 'none';
                errorState.style.display = 'flex';
                if (code === 98) {
                    errorText.innerHTML = `后端 <b>8787</b> 端口被占用。 请清理占用端口的进程，或者修改配置文件中的服务端口。`;
                } else {
                    errorText.innerHTML = `后端异常退出 (代码：${code})`;
                }
                break;
            }

            try {
                const resp = await fetch(`${url}/welcome`);
                if (resp.ok) {
                    isReady = true;
                    break;
                }
            } catch (e) {
                // Connection refused, retry
            }
            await new Promise(r => setTimeout(r, 300));
        }

        if (hasError) {
            return; // Stop processing, error UI is shown
        }

        if (!isReady) {
            throw new Error("Backend failed to start within 15 seconds.");
        }

        // Backend is ready, fetch token
        const token = await invoke<string>('get_auth_token');
        
        // Save to localStorage for the Vue app to pick up
        localStorage.setItem('adminToken', token);
        localStorage.setItem('backendBaseURL', url);

        // 如果配置了环境变量 VITE_SPLASH_DELAY_SEC，则人为增加对应秒数的延迟
        const delaySec = Number(import.meta.env.VITE_SPLASH_DELAY_SEC) || 0;
        if (delaySec > 0) {
            await new Promise(r => setTimeout(r, delaySec * 1000));
        }

        // Tell Rust to open the main window and close this splash screen
        await invoke('open_main_window');

    } catch (e: any) {
        if (!hasError) {
            loadingState.style.display = 'none';
            errorState.style.display = 'flex';
            errorText.innerText = `Initialization Error: ${e.message || e}`;
        }
    }
}

initSplash().catch(console.error);
