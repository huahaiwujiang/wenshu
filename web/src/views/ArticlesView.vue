<template>
  <div>
    <h2 class="page-title">文章管理</h2>
    <p class="page-desc">
      IR 包（.json）是真源；同 slug 下有 wechat/xhs/script 等变体。可预览、编辑、重新渲染、发布微信草稿。
    </p>

    <section class="card" style="margin-bottom: 16px">
      <div class="row" style="justify-content: space-between; margin-bottom: 12px">
        <strong>文章列表</strong>
        <button class="btn" @click="refresh">刷新</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>标题</th>
            <th>类型</th>
            <th>变体</th>
            <th>修改时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in articles" :key="a.name">
            <td>{{ a.title }}</td>
            <td>{{ a.isPackage ? "IR 包" : a.format }}</td>
            <td style="max-width: 220px; font-size: 12px; color: var(--muted)">
              <template v-if="a.variants?.length">{{ a.variants.join(", ") }}</template>
              <template v-else>—</template>
            </td>
            <td>{{ formatTime(a.mtime) }}</td>
            <td>
              <div class="row" style="flex-wrap: wrap">
                <button class="btn" @click="openPreview(a)">预览</button>
                <button class="btn" @click="openEdit(a)">编辑</button>
                <a
                  v-if="!a.isPackage"
                  class="btn"
                  :href="`/api/articles/${encodeURIComponent(a.name)}/download`"
                >导出</a>
                <select v-model="publishPlatform[a.name]" class="btn" style="padding: 6px 8px">
                  <option v-for="p in publishers" :key="p.id" :value="p.id">
                    {{ p.name }}{{ p.implemented ? "" : "（未接入）" }}
                  </option>
                </select>
                <button class="btn" @click="doPublish(a)">发布</button>
                <button class="btn btn-danger" @click="remove(a.name)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="!articles.length">
            <td colspan="5" style="color: var(--muted)">暂无文章，先去工坊生成一篇。</td>
          </tr>
        </tbody>
      </table>
      <p v-if="msg" class="toast">{{ msg }}</p>
      <p v-if="error" class="err">{{ error }}</p>
    </section>

    <section v-if="previewName" class="card" style="margin-bottom: 16px">
      <div class="row" style="justify-content: space-between; margin-bottom: 10px">
        <strong>预览：{{ previewName }}</strong>
        <div class="row">
          <select v-if="previewChoices.length" v-model="previewName" @change="loadPreview">
            <option v-for="v in previewChoices" :key="v" :value="v">{{ v }}</option>
          </select>
          <button class="btn" @click="closePreview">关闭</button>
        </div>
      </div>
      <iframe class="preview-frame" :srcdoc="previewHtml"></iframe>
    </section>

    <section v-if="editName" class="card">
      <div class="row" style="justify-content: space-between; margin-bottom: 10px">
        <strong>编辑：{{ editName }}</strong>
        <div class="row">
          <button class="btn" @click="editName = ''">取消</button>
          <button v-if="editIsIR" class="btn" @click="saveAndRerender">保存并重渲染</button>
          <button class="btn btn-primary" @click="saveEdit">保存</button>
        </div>
      </div>
      <textarea v-model="editContent" class="editor" spellcheck="false" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api } from "../api";

const articles = ref<any[]>([]);
const publishers = ref<any[]>([]);
const publishPlatform = reactive<Record<string, string>>({});
const previewName = ref("");
const previewHtml = ref("");
const previewChoices = ref<string[]>([]);
const editName = ref("");
const editContent = ref("");
const editIsIR = ref(false);
const msg = ref("");
const error = ref("");

function formatTime(iso: string) {
  return new Date(iso).toLocaleString();
}

async function refresh() {
  error.value = "";
  articles.value = await api.listArticles();
  for (const a of articles.value) {
    if (!publishPlatform[a.name]) publishPlatform[a.name] = "wechat";
  }
}

function closePreview() {
  previewName.value = "";
  previewHtml.value = "";
  previewChoices.value = [];
}

async function openPreview(a: any) {
  if (a.isPackage && a.variants?.length) {
    previewChoices.value = [a.name, ...a.variants];
    const prefer =
      a.variants.find((v: string) => v.includes(".wechat.")) ||
      a.variants.find((v: string) => v.endsWith(".html")) ||
      a.variants[0];
    previewName.value = prefer;
  } else {
    previewChoices.value = [a.name];
    previewName.value = a.name;
  }
  await loadPreview();
}

async function loadPreview() {
  const data = await api.getArticle(previewName.value);
  if (/\.html$/i.test(previewName.value)) {
    previewHtml.value = data.content;
  } else {
    const escaped = data.content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    previewHtml.value = `<pre style="white-space:pre-wrap;padding:16px;font-family:sans-serif;line-height:1.6;background:#fff;color:#111">${escaped}</pre>`;
  }
}

async function openEdit(a: any) {
  const name = a.isPackage ? a.name : a.name;
  const data = await api.getArticle(name);
  editName.value = name;
  editContent.value = data.content;
  editIsIR.value = /\.json$/i.test(name) || a.isPackage;
}

async function saveEdit() {
  msg.value = "";
  error.value = "";
  try {
    await api.saveArticle(editName.value, editContent.value);
    msg.value = `已保存 ${editName.value}`;
    await refresh();
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

async function saveAndRerender() {
  msg.value = "";
  error.value = "";
  try {
    const data = await api.rerenderArticle(editName.value, editContent.value);
    msg.value = `已重渲染：${(data.variants || []).join(", ")}`;
    const fresh = await api.getArticle(editName.value);
    editContent.value = fresh.content;
    await refresh();
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

async function remove(name: string) {
  if (!confirm(`删除 ${name}？若为 IR 包将级联删除变体。`)) return;
  await api.deleteArticle(name);
  if (previewName.value === name || previewChoices.value.includes(name)) closePreview();
  if (editName.value === name) editName.value = "";
  await refresh();
}

async function doPublish(a: any) {
  msg.value = "";
  error.value = "";
  try {
    const platform = publishPlatform[a.name] || "wechat";
    const article = a.isPackage ? a.name : a.name;
    const data = await api.publish(platform, article);
    if (data.ok) msg.value = data.message || "已提交";
    else error.value = data.message || "发布失败";
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

onMounted(async () => {
  try {
    publishers.value = await api.listPublishers();
    await refresh();
  } catch (e: any) {
    error.value = e.message || String(e);
  }
});
</script>

<style scoped>
.editor {
  width: 100%;
  min-height: 420px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  resize: vertical;
}
</style>
