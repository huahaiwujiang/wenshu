<template>
  <div>
    <h2 class="page-title">系统设置</h2>
    <p class="page-desc">配置写入本地 `data/settings.json`，OpenAI 兼容接口即可（DeepSeek / 通义 / OpenRouter / Ollama 等）。</p>

    <section class="card" style="margin-bottom: 16px">
      <h3 style="margin-top: 0">大模型</h3>
      <div class="field">
        <label>base_url（以 /v1 结尾）</label>
        <input v-model="form.llm.base_url" placeholder="https://api.deepseek.com/v1" />
      </div>
      <div class="field">
        <label>api_key</label>
        <input v-model="form.llm.api_key" type="password" placeholder="sk-..." />
      </div>
      <div class="field">
        <label>model</label>
        <input v-model="form.llm.model" placeholder="deepseek-chat" />
      </div>
    </section>

    <section class="card" style="margin-bottom: 16px">
      <h3 style="margin-top: 0">创意工坊</h3>
      <div class="row">
        <div class="field" style="flex: 1">
          <label>最少字数</label>
          <input v-model.number="form.workshop.minChars" type="number" />
        </div>
        <div class="field" style="flex: 1">
          <label>最多字数</label>
          <input v-model.number="form.workshop.maxChars" type="number" />
        </div>
        <div class="field" style="flex: 1">
          <label>额外 raw 格式</label>
          <select v-model="form.workshop.format">
            <option value="html">HTML（由微信平台承担）</option>
            <option value="markdown">另存 Markdown</option>
            <option value="txt">另存纯文本</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>默认目标平台（方向 D）</label>
        <div class="chips">
          <label
            v-for="p in platformOptions"
            :key="p.id"
            class="chip"
            :class="{ on: form.workshop.platforms.includes(p.id) }"
            style="cursor: pointer"
          >
            <input v-model="form.workshop.platforms" type="checkbox" :value="p.id" style="margin-right: 6px" />
            {{ p.name }}
          </label>
        </div>
      </div>
      <div class="row">
        <div class="field" style="flex: 1">
          <label>默认借鉴比例 {{ Math.round((form.workshop.referenceRatio || 0) * 100) }}%</label>
          <input v-model.number="form.workshop.referenceRatio" type="range" min="0" max="1" step="0.05" />
        </div>
        <label style="display: flex; gap: 8px; align-items: center; color: var(--muted); margin-top: 18px">
          <input v-model="form.workshop.autoSearch" type="checkbox" />
          无参考链接时自动检索
        </label>
      </div>
      <div class="row">
        <label style="display: flex; gap: 8px; align-items: center; color: var(--muted)">
          <input v-model="form.workshop.useTemplate" type="checkbox" />
          微信套用模板
        </label>
        <div class="field" style="flex: 1; margin: 0">
          <label>默认模板 ID</label>
          <input v-model="form.workshop.defaultTemplate" />
        </div>
        <div class="field" style="flex: 1; margin: 0">
          <label>封面</label>
          <select v-model="form.workshop.coverMode">
            <option value="local">本地 wechat-images（无则 Picsum）</option>
            <option value="picsum">Picsum 随机图</option>
            <option value="none">无封面（发布占位）</option>
          </select>
        </div>
      </div>
    </section>

    <section class="card" style="margin-bottom: 16px">
      <h3 style="margin-top: 0">热搜源</h3>
      <div class="chips">
        <label
          v-for="s in sources"
          :key="s.id"
          class="chip"
          :class="{ on: form.hotSources[s.id] }"
          style="cursor: pointer"
        >
          <input v-model="form.hotSources[s.id]" type="checkbox" :disabled="!s.implemented" style="margin-right: 6px" />
          {{ s.name }}
          <span v-if="!s.implemented" style="opacity: 0.7">（占位）</span>
        </label>
      </div>
      <p style="color: var(--muted); font-size: 12px; margin: 12px 0 0">
        直连：百度 / 头条 / 微博 / 掘金 / B站；抖音与小红书走公开聚合兜底；公众号与推特暂未接入。
      </p>
    </section>

    <section class="card" style="margin-bottom: 16px">
      <h3 style="margin-top: 0">微信公众号（发布草稿）</h3>
      <div class="field">
        <label>AppID</label>
        <input v-model="form.wechat.appid" />
      </div>
      <div class="field">
        <label>AppSecret</label>
        <input v-model="form.wechat.appsecret" type="password" />
      </div>
      <div class="field">
        <label>作者</label>
        <input v-model="form.wechat.author" />
      </div>
    </section>

    <div class="row">
      <button class="btn btn-primary" @click="save">保存设置</button>
      <button class="btn" @click="reload">重新加载</button>
    </div>
    <p v-if="msg" class="toast">{{ msg }}</p>
    <p v-if="error" class="err">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api } from "../api";

const form = reactive<any>({
  llm: { base_url: "", api_key: "", model: "" },
  wechat: { appid: "", appsecret: "", author: "" },
  workshop: {
    minChars: 800,
    maxChars: 2000,
    format: "html",
    useTemplate: true,
    defaultTemplate: "simple-card",
    platforms: ["wechat", "xiaohongshu", "script"],
    referenceRatio: 0.35,
    autoSearch: true,
    coverMode: "local",
  },
  hotSources: {} as Record<string, boolean>,
});

const sources = ref<any[]>([]);
const platformOptions = ref<any[]>([]);
const msg = ref("");
const error = ref("");

async function reload() {
  error.value = "";
  const data = await api.getSettings();
  Object.assign(form.llm, data.llm);
  Object.assign(form.wechat, data.wechat);
  Object.assign(form.workshop, data.workshop);
  if (!Array.isArray(form.workshop.platforms)) {
    form.workshop.platforms = ["wechat", "xiaohongshu", "script"];
  }
  form.hotSources = { ...data.hotSources };
  sources.value = await api.listHotSources();
  platformOptions.value = await api.listPlatforms();
}

async function save() {
  msg.value = "";
  error.value = "";
  try {
    await api.saveSettings(form);
    msg.value = "已保存到 data/settings.json";
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

onMounted(async () => {
  try {
    await reload();
  } catch (e: any) {
    error.value = e.message || String(e);
  }
});
</script>
