<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">枢</div>
        <div>
          <h1>文枢</h1>
          <p>本地写作台</p>
        </div>
      </div>
      <nav class="nav">
        <router-link to="/">创意工坊</router-link>
        <router-link to="/articles">文章管理</router-link>
        <router-link to="/templates">模板管理</router-link>
        <router-link to="/settings">系统设置</router-link>
        <div class="nav-disabled" title="后续版本开放">
          小说连载 <span class="badge">预留</span>
        </div>
      </nav>
    </aside>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts"></script>
