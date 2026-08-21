import { createRouter, createWebHistory } from "vue-router";
import WorkshopView from "./views/WorkshopView.vue";
import ArticlesView from "./views/ArticlesView.vue";
import TemplatesView from "./views/TemplatesView.vue";
import SettingsView from "./views/SettingsView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "workshop", component: WorkshopView },
    { path: "/articles", name: "articles", component: ArticlesView },
    { path: "/templates", name: "templates", component: TemplatesView },
    { path: "/settings", name: "settings", component: SettingsView },
  ],
});

export default router;
