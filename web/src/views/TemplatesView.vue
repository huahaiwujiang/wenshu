<template>
  <div>
    <h2 class="page-title">模板管理</h2>
    <p class="page-desc">自制 HTML 模板，占位符使用 <code v-pre>{{title}}</code> 与 <code v-pre>{{content}}</code>。</p>

    <div class="grid-2">
      <section class="card">
        <div class="row" style="justify-content: space-between; margin-bottom: 12px">
          <strong>模板列表</strong>
          <button class="btn" @click="createNew">新建</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in templates" :key="t.id">
              <td>{{ t.id }}</td>
              <td>
                <div class="row">
                  <button class="btn" @click="edit(t.id)">编辑</button>
                  <button class="btn btn-danger" @click="remove(t.id)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card">
        <div class="field">
          <label>模板 ID</label>
          <input v-model="editId" :disabled="!!lockedId" placeholder="例如：my-style" />
        </div>
        <div class="field">
          <label>HTML 内容</label>
          <textarea v-model="editContent" style="min-height: 280px; font-family: ui-monospace, Consolas, monospace" />
        </div>
        <div class="row">
          <button class="btn btn-primary" @click="save">保存</button>
          <button class="btn" @click="preview">预览</button>
        </div>
        <p v-if="msg" class="toast">{{ msg }}</p>
        <p v-if="error" class="err">{{ error }}</p>
      </section>
    </div>

    <section v-if="previewHtml" class="card" style="margin-top: 16px">
      <div class="row" style="justify-content: space-between; margin-bottom: 10px">
        <strong>模板预览</strong>
        <button class="btn" @click="previewHtml = ''">关闭</button>
      </div>
      <iframe class="preview-frame" :srcdoc="previewHtml"></iframe>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api";

const templates = ref<any[]>([]);
const editId = ref("");
const lockedId = ref("");
const editContent = ref(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>{{title}}</title></head>
<body>
  <article style="max-width:680px;margin:0 auto;padding:24px;font-family:sans-serif;line-height:1.8;">
    <h1>{{title}}</h1>
    <div>{{content}}</div>
  </article>
</body>
</html>`);
const previewHtml = ref("");
const msg = ref("");
const error = ref("");

async function refresh() {
  templates.value = await api.listTemplates();
}

function createNew() {
  lockedId.value = "";
  editId.value = "";
  msg.value = "";
  error.value = "";
}

async function edit(id: string) {
  const data = await api.getTemplate(id);
  editId.value = data.id;
  lockedId.value = data.id;
  editContent.value = data.content;
  msg.value = "";
  error.value = "";
}

async function save() {
  msg.value = "";
  error.value = "";
  try {
    const id = (lockedId.value || editId.value).trim();
    if (!id) throw new Error("请填写模板 ID");
    await api.saveTemplate(id, editContent.value);
    lockedId.value = id;
    editId.value = id;
    msg.value = "已保存";
    await refresh();
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

async function remove(id: string) {
  if (!confirm(`删除模板 ${id}？`)) return;
  await api.deleteTemplate(id);
  if (lockedId.value === id) createNew();
  await refresh();
}

function preview() {
  previewHtml.value = editContent.value
    .replaceAll("{{title}}", "示例标题")
    .replaceAll("{{content}}", "<p>这里是正文预览段落。模板占位符会被工坊生成内容替换。</p>");
}

onMounted(async () => {
  try {
    await refresh();
  } catch (e: any) {
    error.value = e.message || String(e);
  }
});
</script>
