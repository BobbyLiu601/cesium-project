import { createRouter, createWebHistory } from 'vue-router'
import NotFoundView from '../views/NotFoundView.vue'
import ShowcaseView from '../views/ShowcaseView.vue'

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
      component: ShowcaseView,
    },
    {
      path: '/effects',
      redirect: {
        path: '/basic-config',
        hash: '#radar',
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
    },
  ],
})

export default router
