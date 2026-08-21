<template>
  <div>
    <h2 class="page-title">创意工坊</h2>
    <p class="page-desc">
      话题 → 参考/检索 → 结构化 IR → 微信 / 小红书 / 口播等多平台渲染。留空话题则从热搜抽取。
    </p>

    <div class="grid-2">
      <section class="card">
        <div class="field">
          <label>话题</label>
          <textarea v-model="topic" placeholder="例如：本地 AI 工具如何提升内容产能（留空=随机热搜）" />
        </div>
        <div class="field">
          <label>参考链接（借鉴，每行一个 URL）</label>
          <textarea
            v-model="referenceUrls"
            rows="3"
            placeholder="https://example.com/article&#10;可空：开启自动检索时会搜话题摘要"
          />
        </div>
        <div class="row">
          <div class="field" style="flex: 1; margin: 0">
            <label>借鉴比例 {{ Math.round(referenceRatio * 100) }}%</label>
            <input v-model.number="referenceRatio" type="range" min="0" max="1" step="0.05" />
          </div>
          <label style="display: flex; gap: 8px; align-items: center; color: var(--muted); margin-top: 18px">
            <input v-model="autoSearch" type="checkbox" />
            无链接时自动检索
          </label>
        </div>
        <div class="field">
          <label>目标平台</label>
          <div class="chips">
            <label
              v-for="p in platformOptions"
              :key="p.id"
              class="chip"
              :class="{ on: platforms.includes(p.id) }"
              style="cursor: pointer"
            >
              <input v-model="platforms" type="checkbox" :value="p.id" style="margin-right: 6px" />
              {{ p.name }}
            </label>
          </div>
        </div>
        <div class="field">
          <label>微信模板（仅 wechat）</label>
          <select v-model="templateId">
            <option value="">使用设置中的默认模板</option>
            <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.id }}</option>
          </select>
        </div>
        <div class="row">
          <button class="btn" :disabled="busy" @click="pickHot">抽一条热搜</button>
          <button class="btn btn-primary" :disabled="busy || !platforms.length" @click="startGenerate">
            {{ busy ? "生成中…" : "开始生成" }}
          </button>
        </div>
        <p v-if="resultMsg" class="toast">{{ resultMsg }}</p>
        <p v-if="error" class="err">{{ error }}</p>
      </section>

      <section class="card">
        <div class="row" style="justify-content: space-between; margin-bottom: 10px">
          <strong>运行日志</strong>
          <button class="btn" @click="logs = []">清空</button>
        </div>
        <div class="log-box" ref="logEl">
          <div v-for="(l, i) in logs" :key="i" :class="'log-' + l.level">
            [{{ formatTime(l.at) }}] {{ l.message }}
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { api, generateWithSSE, type GenLog } from "../api";

const topic = ref("");
const referenceUrls = ref("");
const referenceRatio = ref(0.35);
const autoSearch = ref(true);
const templateId = ref("");
const templates = ref<any[]>([]);
const platforms = ref<string[]>(["wechat", "xiaohongshu", "script"]);
const platformOptions = ref<any[]>([]);
const logs = ref<GenLog[]>([]);
const busy = ref(false);
const error = ref("");
const resultMsg = ref("");
const logEl = ref<HTMLElement | null>(null);

function formatTime(at?: string) {
  if (!at) return "--:--:--";
  return new Date(at).toLocaleTimeString();
}

async function scrollLog() {
  await nextTick();
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight;
}

async function pickHot() {
  error.value = "";
  try {
    const data = await api.randomHot();
    topic.value = data.topic;
    logs.value.push({
      level: "info",
      message: `热搜：[${data.sourceName}] ${data.topic}`,
      at: new Date().toISOString(),
    });
    await scrollLog();
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

async function startGenerate() {
  busy.value = true;
  error.value = "";
  resultMsg.value = "";
  try {
    const done = await generateWithSSE(
      {
        topic: topic.value.trim() || undefined,
        templateId: templateId.value || undefined,
        referenceUrls: referenceUrls.value.trim() || undefined,
        referenceRatio: referenceRatio.value,
        platforms: platforms.value,
        autoSearch: autoSearch.value,
      },
      async (log) => {
        logs.value.push(log);
        await scrollLog();
      },
    );
    resultMsg.value = `已保存 ${done.irFile}（${done.title}）· 变体 ${done.variants?.length || 0} 个`;
    if (done.source) topic.value = done.topic;
  } catch (e: any) {
    error.value = e.message || String(e);
    logs.value.push({ level: "error", message: error.value, at: new Date().toISOString() });
  } finally {
    busy.value = false;
    await scrollLog();
  }
}

onMounted(async () => {
  try {
    templates.value = await api.listTemplates();
    platformOptions.value = (await api.listPlatforms()).filter((p) =>
      ["wechat", "xiaohongshu", "script", "markdown", "txt"].includes(p.id),
    );
    const settings = await api.getSettings();
    if (settings.workshop?.platforms?.length) platforms.value = [...settings.workshop.platforms];
    if (typeof settings.workshop?.referenceRatio === "number") {
      referenceRatio.value = settings.workshop.referenceRatio;
    }
    if (typeof settings.workshop?.autoSearch === "boolean") {
      autoSearch.value = settings.workshop.autoSearch;
    }
  } catch {
    /* ignore */
  }
});
</script>
