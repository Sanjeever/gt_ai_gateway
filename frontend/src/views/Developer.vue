<template>
    <div class="developer-page">
        <div class="page-header">
            <h2 class="page-title">开发者设置</h2>
        </div>
        <div class="page-content">
            <a-empty description="开发者选项暂未开放" />
        </div>
    </div>
</template>

<script setup lang="ts">
// 开发者页面组件
</script>

<style scoped>
.developer-page {
    background: var(--bg-page);
    min-height: calc(100vh - 64px);
    padding: 24px;
}

.page-header {
    margin-bottom: 24px;
}

.page-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
}

.page-content {
    background: var(--component-bg, #ffffff);
    border: 1px solid var(--border-color, #f0f0f0);
    border-radius: 8px;
    padding: 48px;
    display: flex;
    justify-content: center;
    align-items: center;
}
</style>
