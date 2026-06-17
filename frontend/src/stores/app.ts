import { defineStore } from 'pinia';
import { ref } from 'vue';
import { status } from '@/api/system';
import packageJson from '../../package.json';

const FALLBACK_VERSION = packageJson.version;

export const useAppStore = defineStore('app', () => {
    const sidebarCollapsed = ref(false);
    const version = ref(FALLBACK_VERSION);
    const isDeveloperMode = ref(localStorage.getItem('developerMode') === 'true');

    function toggleSidebar() {
        sidebarCollapsed.value = !sidebarCollapsed.value;
    }

    function enableDeveloperMode() {
        isDeveloperMode.value = true;
        localStorage.setItem('developerMode', 'true');
    }

    async function fetchVersion() {
        try {
            const data = await status();
            version.value = data.system?.version || FALLBACK_VERSION;
        } catch (error) {
            console.error('Failed to fetch version:', error);
        }
    }

    return {
        sidebarCollapsed,
        version,
        isDeveloperMode,
        toggleSidebar,
        enableDeveloperMode,
        fetchVersion,
    };
});
