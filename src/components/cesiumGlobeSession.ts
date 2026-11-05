import type { Viewer } from 'cesium'

export interface GlobeSession {
  host: HTMLDivElement
  viewer: Viewer
  resizeObserver?: ResizeObserver
}

let activeSession: GlobeSession | undefined

export function getActiveSession() {
  return activeSession
}

export function setActiveSession(session: GlobeSession) {
  activeSession = session
}

export function clearActiveSession(session: GlobeSession) {
  if (activeSession === session) {
    activeSession = undefined
  }
}

export function disposeGlobeSession(session: GlobeSession) {
  session.resizeObserver?.disconnect()

  try {
    session.viewer.destroy()
  } catch (error) {
    console.error('Cesium Viewer 销毁失败', error)
  }

  clearActiveSession(session)
}

export function disposeActiveSession() {
  if (activeSession) {
    disposeGlobeSession(activeSession)
  }
}
