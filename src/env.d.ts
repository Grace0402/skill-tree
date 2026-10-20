/// <reference types="vite/client" />

import type { SkillTreeApi } from '../shared/types'

declare global {
  interface Window {
    skillTree: SkillTreeApi
  }
}

export {}
