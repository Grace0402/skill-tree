<template>
  <div class="app" :class="{ resizing }">
    <TitleBar />

    <div v-if="state.loading" class="boot">
      <div class="boot-mark"><Icon name="sapling" :size="42" :stroke="1.1" /></div>
      <p class="boot-title serif">技能树</p>
      <p class="boot-sub">正在读你的树…</p>
    </div>

    <div v-else-if="state.fatalError" class="fatal">
      <div class="fatal-mark"><Icon name="info" :size="24" /></div>
      <p class="fatal-title serif">没能读到这棵树</p>
      <p class="fatal-text">{{ state.fatalError }}</p>
      <button class="btn" type="button" @click="reload">重新读取</button>
    </div>

    <main v-else ref="workspaceRef" class="workspace">
      <div v-if="!collapsed" class="tree-pane" :style="{ width: `${treeWidth}px` }">
        <TreePanel @collapse="collapseTree" />
      </div>

      <div
        v-if="!collapsed"
        class="splitter"
        :class="{ active: resizing }"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整文件区宽度"
        tabindex="0"
        title="拖动调整文件区宽度，双击复位"
        @pointerdown="startResize"
        @dblclick="resetSplit"
        @keydown.left.prevent="nudge(-18)"
        @keydown.right.prevent="nudge(18)"
      >
        <span class="splitter-grip"><i /><i /><i /></span>
      </div>

      <div v-else class="rail">
        <button class="rail-btn" type="button" title="展开文件区" @click="expandTree">
          <Icon name="chevronRight" :size="13" :stroke="2" />
        </button>
        <span class="rail-label">文件</span>
      </div>

      <OrbitCanvas />

      <Transition name="drawer">
        <NodeInspector v-if="state.inspectorOpen && selectedNode" />
      </Transition>
    </main>

    <NewNodeDialog />
    <SettingsDialog />
    <ToastHost />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TitleBar from './components/TitleBar.vue'
import TreePanel from './components/TreePanel.vue'
import OrbitCanvas from './components/OrbitCanvas.vue'
import NodeInspector from './components/NodeInspector.vue'
import NewNodeDialog from './components/NewNodeDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import ToastHost from './components/ToastHost.vue'
import Icon from './components/Icon.vue'
import { selectedNode, state, treeStore } from './stores/tree'

const collapsed = ref(localStorage.getItem('skill-tree:collapsed') === '1')
const ratio = ref(0.24)
const resizing = ref(false)
const workspaceRef = ref<HTMLElement | null>(null)
const workspaceWidth = ref(0)

let observer: ResizeObserver | null = null

const treeWidth = computed(() => {
  const total = workspaceWidth.value || 1360
  return Math.round(Math.min(540, Math.max(216, ratio.value * total)))
})

watch(
  () => state.snapshot?.rootPath,
  () => {
    const pref = state.snapshot?.config.preferences?.splitRatio
    if (typeof pref === 'number' && pref > 0) ratio.value = pref
  },
  { immediate: true },
)

function collapseTree(): void {
  collapsed.value = true
  localStorage.setItem('skill-tree:collapsed', '1')
}

function expandTree(): void {
  collapsed.value = false
  localStorage.setItem('skill-tree:collapsed', '0')
}

let dragStart: { x: number; width: number; total: number } | null = null

function startResize(event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  const total = workspaceRef.value?.clientWidth ?? 1360
  dragStart = { x: event.clientX, width: treeWidth.value, total }
  resizing.value = true
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', stopResize)
}

function onResizeMove(event: PointerEvent): void {
  if (!dragStart) return
  const next = Math.min(540, Math.max(216, dragStart.width + event.clientX - dragStart.x))
  ratio.value = next / dragStart.total
}

function stopResize(): void {
  if (!dragStart) return
  dragStart = null
  resizing.value = false
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
  treeStore.persistPreferences({ splitRatio: ratio.value })
}

function resetSplit(): void {
  ratio.value = 0.24
  treeStore.persistPreferences({ splitRatio: ratio.value })
}

function nudge(delta: number): void {
  const total = workspaceWidth.value || 1360
  const next = Math.min(540, Math.max(216, treeWidth.value + delta))
  ratio.value = next / total
  treeStore.persistPreferences({ splitRatio: ratio.value })
}

function reload(): void {
  window.location.reload()
}

function attachObserver(): void {
  observer?.disconnect()
  observer = null
  const element = workspaceRef.value
  if (!element) return
  observer = new ResizeObserver((entries) => {
    workspaceWidth.value = entries[0]?.contentRect.width ?? 0
  })
  observer.observe(element)
  workspaceWidth.value = element.clientWidth
}

watch(
  () => state.loading,
  async (loading) => {
    if (!loading && !state.fatalError) {
      await nextTick()
      attachObserver()
    }
  },
)

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  return Boolean(element.closest('input, textarea, [contenteditable="true"]'))
}

function onKeydown(event: KeyboardEvent): void {
  const mod = event.ctrlKey || event.metaKey

  if (event.key === 'Escape') {
    if (state.newNodeOpen) {
      treeStore.closeNewNode()
      return
    }
    if (state.settingsOpen) {
      treeStore.closeSettings()
      return
    }
    if (state.inspectorOpen && !isTyping(event.target)) {
      treeStore.closeInspector()
      return
    }
    return
  }

  if (mod && event.key === '0') {
    event.preventDefault()
    window.dispatchEvent(new Event('skill-tree:reset-view'))
    return
  }

  if (mod && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    if (state.newNodeOpen || state.settingsOpen) return
    treeStore.openNewNode(state.selectedId)
    return
  }

  if (mod && event.key === ',') {
    event.preventDefault()
    treeStore.openSettings()
  }
}

onMounted(() => {
  void treeStore.init()
  window.addEventListener('keydown', onKeydown)
  attachObserver()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
  observer?.disconnect()
  observer = null
})
</script>

<style scoped>
.app.resizing {
  cursor: col-resize;
}

.app.resizing :deep(*) {
  cursor: col-resize !important;
  user-select: none !important;
}

.boot,
.fatal {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  text-align: center;
}

.boot-mark {
  color: var(--gold);
  opacity: 0.8;
  filter: drop-shadow(0 0 30px rgba(var(--glow), 0.28));
  animation: breathe 4.5s ease-in-out infinite;
}

.boot-title {
  margin-top: 8px;
  font-size: 20px;
  letter-spacing: 0.3em;
  color: var(--text-2);
  padding-left: 0.3em;
}

.boot-sub {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-3);
}

.fatal-mark {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  color: var(--text-3);
}

.fatal-title {
  margin-top: 12px;
  font-size: 19px;
  letter-spacing: 0.06em;
  color: var(--text);
}

.fatal-text {
  max-width: 460px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-2);
  overflow-wrap: anywhere;
}

.fatal .btn {
  margin-top: 8px;
}

.tree-pane {
  flex: none;
  height: 100%;
  min-width: 0;
  position: relative;
  z-index: 12;
}

.splitter {
  flex: none;
  width: 7px;
  margin-left: -3px;
  margin-right: -4px;
  position: relative;
  z-index: 20;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  background: transparent;
}

.splitter::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 1px;
  background: var(--line);
  transition: background 0.16s var(--ease), box-shadow 0.16s var(--ease);
}

.splitter:hover::before,
.splitter.active::before,
.splitter:focus-visible::before {
  background: rgba(var(--glow), 0.55);
  box-shadow: 0 0 10px rgba(var(--glow), 0.4);
}

.splitter-grip {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 5px 2px;
  border-radius: 4px;
  background: var(--panel-strong);
  border: 1px solid var(--line);
  opacity: 0;
  transition: opacity 0.16s var(--ease);
}

.splitter:hover .splitter-grip,
.splitter.active .splitter-grip {
  opacity: 1;
}

.splitter-grip i {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--text-3);
}

.rail {
  flex: none;
  width: 32px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding-top: 12px;
  border-right: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(18px);
  z-index: 12;
}

.rail-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--text-2);
}

.rail-btn:hover {
  background: var(--glass-strong);
  color: var(--gold);
}

.rail-label {
  writing-mode: vertical-rl;
  font-size: 10px;
  letter-spacing: 0.3em;
  color: var(--text-3);
  opacity: 0.7;
}
</style>
