<template>
    <div class="app-header">
        <div class="header-left">
            <img src="/favicon.svg" alt="Logo" class="logo" @click="handleLogoClick">
            <span class="title">{{ title }}</span>
        </div>
        <div class="header-right">
            <a-button type="text" class="theme-btn" @click="toggleTheme">
                <component :is="themeStore.isDark ? SunIcon : MoonIcon" />
            </a-button>
            <a-dropdown>
                <a-button type="text" class="user-btn">
                    <UserOutlined />
                    <span class="username">{{ authStore.userType || 'Admin' }}</span>
                </a-button>
                <template #overlay>
                    <a-menu>
                        <a-menu-item @click="handleLogout">
                            <LogoutOutlined />
                            <span>退出登录</span>
                        </a-menu-item>
                    </a-menu>
                </template>
            </a-dropdown>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue/es';
import {
    UserOutlined,
    LogoutOutlined,
} from '@ant-design/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useAppStore } from '@/stores/app';

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const appStore = useAppStore(); // import useAppStore

let logoClickCount = 0;
let logoClickTimer: number | null = null;

const strokeIconProps = {
    viewBox: '0 0 24 24',
    width: '1em',
    height: '1em',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2.2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
};

const SunIcon = {
    render() {
        return h(
            'svg',
            strokeIconProps,
            [
                h('circle', { cx: '12', cy: '12', r: '4' }),
                h('path', { d: 'M12 2.5v2.2' }),
                h('path', { d: 'M12 19.3v2.2' }),
                h('path', { d: 'M4.93 4.93l1.56 1.56' }),
                h('path', { d: 'M17.51 17.51l1.56 1.56' }),
                h('path', { d: 'M2.5 12h2.2' }),
                h('path', { d: 'M19.3 12h2.2' }),
                h('path', { d: 'M4.93 19.07l1.56-1.56' }),
                h('path', { d: 'M17.51 6.49l1.56-1.56' }),
            ],
        );
    },
};

const MoonIcon = {
    render() {
        return h(
            'svg',
            strokeIconProps,
            [
                h('path', {
                    d: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a7.8 7.8 0 1 0 10.5 10.5Z',
                }),
            ],
        );
    },
};

const title = computed(() => 'GT AI Gateway');

function handleLogout() {
    authStore.logout();
    message.success('已退出登录');
    router.push('/login');
}

function toggleTheme() {
    themeStore.toggleTheme();
    message.success(`已切换为${themeStore.isDark ? '浅色' : '深色'}模式`);
}

function handleLogoClick() {
    if (appStore.isDeveloperMode) return;
    
    logoClickCount++;
    if (logoClickTimer) {
        clearTimeout(logoClickTimer);
    }
    
    logoClickTimer = window.setTimeout(() => {
        logoClickCount = 0;
    }, 1000); // 1秒内连按才算
    
    if (logoClickCount >= 10) {
        appStore.enableDeveloperMode();
        message.success('已开启开发者模式');
        logoClickCount = 0;
    }
}
</script>

<style scoped>
.app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
    height: 48px;
    background: var(--bg-header);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 20;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.logo {
    width: 26px;
    height: 26px;
    object-fit: contain;
}

.title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
}

.header-right {
    display: flex;
    align-items: center;
    gap: 4px;
}

.theme-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    font-size: 20px;
}

.theme-btn :deep(svg) {
    display: block;
    width: 18px;
    height: 18px;
    flex: none;
}

.user-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-inline: 4px;
    font-size: 17px;
}

.user-btn :deep(.anticon) {
    font-size: 18px;
}

.username {
    font-size: 14px;
    color: var(--text-primary);
}
</style>
