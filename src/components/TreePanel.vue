<template>
  <aside class="tree-panel">
    <div class="panel-head">
      <div class="head-top">
        <span class="panel-title">文件</span>
        <span class="panel-count">{{ totalNodes }}</span>
        <span class="spacer" />
        <button class="icon-btn sm" type="button" title="新建根节点" @click="openNewNode('')">
          <Icon name="plus" :size="14" />
        </button>
        <button class="icon-btn sm" type="button" title="展开全部" @click="expandAll">
          <Icon name="expand" :size="13" />
        </button>
        <button class="icon-btn sm" type="button" title="折叠全部" @click="collapseAll">
          <Icon name="collapse" :size="13" />
        </button>
        <button class="icon-btn sm" type="button" title="收起文件区" @click="$emit('collapse')">
          <Icon name="panelLeft" :size="13" />
        </button>
      </div>
      <div class="head-path" :title="rootPath">
        <Icon name="folder" :size="11" :stroke="1.7" />
        <span class="head-path-name">{{ rootName }}</span>
        <span class="head-path-hint">文件夹即树</span>
      </div>
    </div>

    <div ref="scrollRef" class="tree-scroll">
      <div
        class="root-row"
        :class="{ selected: isCenterSelected }"
        data-node-id=""
        title="中心圆：你自己"
        @click="selectCenter"
      >
        <span class="root-orb" :style="{ '--b': centerLevel }" />
        <span class="root-name serif">我 · 你自己</span>
        <span class="root-meta">{{ center.nodeCount }} 枝</span>
        <span class="root-value">{{ formatBrightness(center.brightness) }}</span>
      </div>

      <div class="tree-rows">
        <TreeRow v-for="node in nodes" :key="node.id" :node="node" :depth="0" />
      </div>

      <div v-if="!nodes.length" class="empty">
        <span class="empty-mark"><Icon name="sapling" :size="28" :stroke="1.35" /></span>
        <p class="empty-title serif">树还是空的</p>
        <p class="empty-text">一切由你亲手长出来。<br />先给一个想学的方向起个名字。</p>
        <button class="btn small" type="button" @click="openNewNode('')">
          <Icon name="plus" :size="12" />
          长出第一根枝
        </button>
      </div>

      <div class="archive-block">
        <button class="archive-head" type="button" @click="archiveOpen = !archiveOpen">
          <Icon
            :name="archiveOpen ? 'chevronDown' : 'chevronRight'"
            :size="11"
            :stroke="2"
            class="archive-caret"
          />
          <span>已归档</span>
          <span class="archive-count">{{ archived.length }}</span>
          <span class="archive-hint">剪下的枝，都还在</span>
        </button>
        <div v-if="archiveOpen" class="archive-list">
          <p v-if="!archived.length" class="archive-empty">还没有剪下过任何枝。</p>
          <div v-for="item in archived" :key="item.id" class="archive-item">
            <div class="archive-info">
              <span class="archive-name serif">{{ item.name }}</span>
              <span class="archive-meta">
                {{ item.nodeCount }} 枝 · {{ item.diaryCount }} 篇 · {{ formatDayMoment(item.archivedAt) }}
              </span>
            </div>
            <button
              class="btn small ghost archive-restore"
              type="button"
              title="把这一枝接回树上"
              @click="restore(item.id)"
            >
              <Icon name="restoreArchive" :size="11" />
              接回
            </button>
          </div>
        </div>
      </div>
    </div>

    <footer class="panel-foot">
      <span class="foot-path" :title="rootPath">{{ rootPath }}</span>
      <button class="icon-btn foot-btn" type="button" title="打开数据文件夹" @click="openFolder">
        <Icon name="external" :size="13" />
      </button>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Icon from './Icon.vue'
import TreeRow from './TreeRow.vue'
import {
  isCenterSelected,
  state,
  totalNodes,
  treeStore,
} from '../stores/tree'
import { api } from '../ipc'
import { formatBrightness, formatDayMoment } from '../lib/format'

defineEmits<{ collapse: [] }>()

const scrollRef = ref<HTMLElement | null>(null)
const archiveOpen = ref(false)

const nodes = computed(() => state.snapshot?.nodes ?? [])
const archived = computed(() => state.snapshot?.archived ?? [])
const center = computed(
  () =>
    state.snapshot?.center ?? {
      marks: 0,
      brightness: 0,
      nodeCount: 0,
      diaryCount: 0,
      litCount: 0,
      maxDepth: 0,
      lastEntryAt: null,
    },
)
const rootName = computed(() => state.snapshot?.rootName ?? '')
const rootPath = computed(() => state.snapshot?.rootPath ?? '')
const centerLevel = computed(() => String(Math.min(1, center.value.brightness / 100)))

const { expandAll, collapseAll, openNewNode, restoreArchived } = treeStore

function selectCenter(): void {
  treeStore.selectNode('', { openInspector: false })
}

async function restore(id: string): Promise<void> {
  await restoreArchived(id)
}

async function openFolder(): Promise<void> {
  const result = await api.openDataDir()
  if (!result.ok) treeStore.toast(result.error, 'error')
}

watch(
  () => state.selectedId,
  async () => {
    await nextTick()
    const container = scrollRef.value
    if (!container) return
    if (!state.selectedId) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const row = container.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(state.selectedId)}"]`,
    )
    row?.scrollIntoView({ block: 'nearest' })
  },
)
</script>

<style scoped>
.tree-panel {
  height: 100%;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border-right: 1px solid var(--line);
  backdrop-filter: blur(22px) saturate(1.1);
  overflow: hidden;
}

.panel-head {
  flex: none;
  padding: 13px 10px 9px 14px;
  border-bottom: 1px solid var(--line);
}

.head-top {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
}

.panel-title {
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--text-2);
  font-weight: 500;
}

.panel-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-3);
  background: var(--glass);
  border-radius: 4px;
  padding: 0 5px;
  line-height: 16px;
}

.spacer {
  flex: 1;
}

.icon-btn.sm {
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.head-path {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
  padding-left: 1px;
  color: var(--text-3);
  min-width: 0;
}

.head-path-name {
  font-size: 11px;
  color: var(--text-2);
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-path-hint {
  font-size: 10px;
  color: var(--text-3);
  opacity: 0.55;
  white-space: nowrap;
}

.tree-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0 18px;
  scrollbar-gutter: stable;
}

.root-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  margin: 0 8px 6px 10px;
  padding: 0 8px;
  border-radius: 7px;
  border: 1px solid transparent;
  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
  cursor: pointer;
}

.root-row:hover {
  background: var(--glass);
}

.root-row.selected {
  background: var(--gold-soft);
  border-color: rgba(var(--glow), 0.16);
}

.root-orb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  flex: none;
  background:
    radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.85), transparent 55%),
    hsl(41 80% calc(62% + 22% * (1 - var(--b))));
  box-shadow:
    0 0 calc(4px + 13px * var(--b)) rgba(255, 196, 104, calc(0.12 + 0.5 * var(--b))),
    inset 0 -2px 4px rgba(0, 0, 0, 0.25);
}

[data-theme="light"] .root-orb {
  background:
    radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.9), transparent 55%),
    hsl(41 85% calc(80% - 30% * var(--b)));
  box-shadow: 0 2px 4px rgba(130, 95, 30, 0.25);
}

.root-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text);
  letter-spacing: 0.03em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.root-meta {
  font-size: 10px;
  color: var(--text-3);
  flex: none;
}

.root-value {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--gold);
  flex: none;
  min-width: 22px;
  text-align: right;
}

.tree-rows {
  padding-top: 1px;
}

.empty {
  margin: 14px 12px 6px;
  padding: 22px 16px 18px;
  border: 1px dashed var(--line-strong);
  border-radius: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  background: linear-gradient(180deg, transparent, var(--glass));
}

.empty-mark {
  color: var(--gold);
  opacity: 0.72;
  margin-bottom: 2px;
}

.empty-title {
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--text-2);
}

.empty-text {
  font-size: 11.5px;
  line-height: 1.75;
  color: var(--text-3);
}

.empty .btn {
  margin-top: 6px;
}

.archive-block {
  margin: 18px 12px 0;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.archive-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  color: var(--text-3);
  font-size: 11px;
  letter-spacing: 0.04em;
  border-radius: 6px;
}

.archive-head:hover {
  color: var(--text-2);
}

.archive-caret {
  transition: transform 0.15s var(--ease);
}

.archive-count {
  font-family: var(--font-mono);
  font-size: 10px;
  opacity: 0.8;
}

.archive-hint {
  margin-left: auto;
  font-size: 10px;
  opacity: 0.55;
}

.archive-list {
  padding: 4px 0 2px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.archive-empty {
  padding: 8px 4px;
  font-size: 11px;
  color: var(--text-3);
}

.archive-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 7px;
  transition: background 0.14s var(--ease);
}

.archive-item:hover {
  background: var(--glass);
}

.archive-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.archive-name {
  font-size: 12.5px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archive-meta {
  font-size: 10px;
  color: var(--text-3);
}

.archive-restore {
  flex: none;
  height: 24px;
  padding: 0 8px;
  font-size: 11px;
}

.panel-foot {
  flex: none;
  height: 31px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px 0 14px;
  border-top: 1px solid var(--line);
  color: var(--text-3);
}

.foot-path {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.7;
}

.foot-btn {
  width: 24px;
  height: 24px;
}
</style>
