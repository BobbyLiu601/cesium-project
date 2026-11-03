import { createRouter, createWebHistory } from 'vue-router'
import BasicConfigView from '../views/BasicConfigView.vue'
import NotFoundView from '../views/NotFoundView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/basic-config',
    },
    {
      path: '/basic-config',
      name: 'basic-config',
      component: BasicConfigView,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
    },
  ],
})

export default router
