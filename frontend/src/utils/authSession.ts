const ADMIN_TOKEN_KEY = 'adminToken';

let memoryToken = '';

export function getAuthToken(): string {
    if (memoryToken) {
        console.log('[authSession] getAuthToken: memory=' + memoryToken.substring(0, 8) + '...');
        return memoryToken;
    }

    if (typeof window === 'undefined') {
        console.log('[authSession] getAuthToken: no window, returning empty');
        return '';
    }

    const ls = window.localStorage.getItem(ADMIN_TOKEN_KEY) || '';
    console.log('[authSession] getAuthToken: localStorage=' + (ls ? ls.substring(0, 8) + '...' : 'empty'));
    return ls;
}

export function setAuthToken(token: string, options: { persist?: boolean } = {}): void {
    console.log('[authSession] setAuthToken: ' + (token ? token.substring(0, 8) + '...' : 'empty'));
    memoryToken = token;

    if (typeof window === 'undefined') {
        return;
    }

    if (options.persist !== false) {
        window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    }
}

export function clearAuthToken(): void {
    console.log('[authSession] clearAuthToken called, stack=' + new Error().stack);
    memoryToken = '';

    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}
