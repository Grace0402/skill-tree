<template>
  <header class="titlebar">
    <div class="brand">
      <span class="mark"><Icon name="sapling" :size="17" :stroke="1.6" /></span>
      <span class="wordmark serif">技能树</span>
      <span v-if="rootName" class="root-chip" :title="rootPath">
        <Icon name="folder" :size="11" :stroke="1.7" />
        <span class="root-name">{{ rootName }}</span>
      </span>
    </div>

    <button
      class="focus"
      type="button"
      :title="isCenterSelected ? '回到整体视角' : '回到整体视角（我自己）'"
      @click="selectCenter"
    >
      <span class="focus-label">{{ isCenterSelected ? '整体' : '焦点' }}</span>
      <span class="focus-name serif">{{ isCenterSelected ? '我 · 你自己' : selectedNode?.name }}</span>
      <span class="focus-sep">·</span>
      <span class="focus-value">
        <span class="focus-num">{{ formatBrightness(focusBrightness) }}</span>
        <span class="focus-unit">亮度</span>
      </span>
      <span v-if="!isCenterSelected && selectedNode?.litAt" class="focus-lit" title="已点亮">
        <Icon name="star" :size="10" />
      </span>
    </button>

    <div class="actions">
      <div class="theme-switch" role="group" aria-label="主题">
        <button
          v-for="option in themes"
          :key="option.mode"
          type="button"
          class="theme-btn"
          :class="{ active: state.themeMode === option.mode }"
          :title="option.label"
          :aria-pressed="state.themeMode === option.mode"
          @click="setTheme(option.mode)"
        >
          <Icon :name="option.icon" :size="14" :stroke="1.6" />
        </button>
      </div>

      <button class="icon-btn settings-btn" type="button" title="设置" @click="openSettings">
        <Icon name="settings" :size="16" :stroke="1.5" />
      </button>

      <span class="divider" />

      <div class="window-controls">
        <button class="win-btn" type="button" title="最小化" @click="api.minimizeWindow()">
          <Icon name="minus" :size="14" :stroke="1.5" />
        </button>
        <button
          class="win-btn"
          type="button"
          :title="state.maximized ? '还原' : '最大化'"
          @click="api.toggleMaximizeWindow()"
        >
          <Icon :name="state.maximized ? 'restore' : 'square'" :size="13" :stroke="1.4" />
        </button>
        <button class="win-btn win-close" type="button" title="关闭" @click="api.closeWindow()">
          <Icon name="close" :size="14" :stroke="1.5" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon, { type IconName } from './Icon.vue'
import {
  isCenterSelected,
  selectedNode,
  setTheme,
  state,
  treeStore,
} from '../stores/tree'
import { api } from '../ipc'
import { formatBrightness } from '../lib/format'
import type { ThemeMode } from '../../shared/types'

const themes: Array<{ mode: ThemeMode; label: string; icon: IconName }> = [
  { mode: 'dark', label: '深色', icon: 'moon' },
  { mode: 'light', label: '浅色', icon: 'sun' },
  { mode: 'system', label: '跟随系统', icon: 'monitor' },
]

const rootName = computed(() => state.snapshot?.rootName ?? '')
const rootPath = computed(() => state.snapshot?.rootPath ?? '')

const focusBrightness = computed(() => {
  if (isCenterSelected.value || !selectedNode.value) {
    return state.snapshot?.center.brightness ?? 0
  }
  return selectedNode.value.brightness
})

const { openSettings } = treeStore

function selectCenter(): void {
  treeStore.selectNode('', { openInspector: false })
}
</script>

<style scoped>
.titlebar {
  height: var(--titlebar-h);
  flex: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding-left: 16px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, var(--glass), transparent);
  backdrop-filter: blur(18px);
  -webkit-app-region: drag;
  position: relative;
  z-index: 40;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.mark {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--gold-strong);
  background: radial-gradient(circle at 35% 25%, rgba(255, 226, 168, 0.22), rgba(255, 196, 104, 0.04));
  border: 1px solid rgba(var(--glow), 0.22);
  box-shadow: 0 0 18px rgba(var(--glow), 0.12);
  flex: none;
}

.wordmark {
  font-size: 15px;
  letter-spacing: 0.12em;
  color: var(--text);
  white-space: nowrap;
}

.root-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 220px;
  margin-left: 6px;
  padding: 3px 8px 3px 7px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--text-2);
  font-size: 11px;
  letter-spacing: 0.02em;
  -webkit-app-region: no-drag;
}

.root-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  max-width: 46vw;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--text-2);
  -webkit-app-region: no-drag;
  transition: border-color 0.18s var(--ease), background 0.18s var(--ease);
  overflow: hidden;
}

.focus:hover {
  border-color: var(--line-strong);
  background: var(--glass-strong);
}

.focus-label {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  color: var(--text-3);
  flex: none;
}

.focus-name {
  font-size: 13px;
  color: var(--text);
  letter-spacing: 0.03em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-sep {
  color: var(--text-3);
  flex: none;
}

.focus-value {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  flex: none;
}

.focus-num {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--gold);
}

.focus-unit {
  font-size: 10px;
  color: var(--text-3);
}

.focus-lit {
  color: var(--gold);
  display: inline-grid;
  place-items: center;
  filter: drop-shadow(0 0 5px rgba(var(--glow), 0.7));
}

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  height: 100%;
  width: max-content;
  justify-self: end;
  align-self: center;
  padding-right: 0;
  -webkit-app-region: no-drag;
}

.theme-switch {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding: 2px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--glass);
}

.theme-btn {
  width: 26px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--text-3);
  transition: background 0.16s var(--ease), color 0.16s var(--ease);
}

.theme-btn:hover {
  color: var(--text-2);
  background: var(--glass);
}

.theme-btn.active {
  color: var(--gold-strong);
  background: var(--gold-soft);
  box-shadow: inset 0 0 0 1px rgba(var(--glow), 0.2);
}

.settings-btn {
  width: 26px;
  height: 26px;
}

.divider {
  width: 1px;
  height: 16px;
  background: var(--line);
  flex: none;
}

.window-controls {
  display: flex;
  align-items: stretch;
  height: var(--titlebar-h);
  margin-left: 2px;
}

.win-btn {
  width: 44px;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--text-2);
  transition: background 0.14s var(--ease), color 0.14s var(--ease);
  border-radius: 0;
}

.win-btn:hover {
  background: var(--glass-strong);
  color: var(--text);
}

.win-close:hover {
  background: #c8423b;
  color: #fff;
}

@media (max-width: 1080px) {
  .root-chip {
    display: none;
  }
}

@media (max-width: 860px) {
  .focus-unit {
    display: none;
  }
}
</style>
