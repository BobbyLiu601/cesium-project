import { createRouter, createWebHistory } from 'vue-router'
import { featuredRoutes } from '../data/layers'
import NotFoundView from '../views/NotFoundView.vue'
import ShowcaseView from '../views/ShowcaseView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: { name: 'layers' },
    },
    {
      path: '/basic-config',
      redirect: { name: 'layers' },
    },
    {
      path: '/layers',
      name: 'layers',
      component: ShowcaseView,
    },
    ...featuredRoutes.map((feature) => ({
      path: feature.path,
      name: feature.name,
      component: ShowcaseView,
      meta: {
        featureId: feature.featureId,
      },
    })),
    {
      path: '/effects',
      redirect: {
        name: 'layers',
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
