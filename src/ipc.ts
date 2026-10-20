import type { SkillTreeApi } from '../shared/types'

const bridge = (window as unknown as { skillTree?: SkillTreeApi }).skillTree
if (!bridge) {
  throw new Error('技能树的桌面桥接没有加载成功，请通过 Electron 启动应用。')
}

export const api: SkillTreeApi = bridge
