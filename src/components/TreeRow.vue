<template>
  <div class="tree-row-wrap">
    <div
      class="tree-row"
      :class="{ selected: isSelected }"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      :data-node-id="node.id"
    >
      <button
        type="button"
        class="twist"
        :class="{ hidden: !node.children.length }"
        :title="isExpanded ? '折叠' : '展开'"
        @click.stop="toggleExpand(node.id)"
      >
        <Icon
          name="chevronRight"
          :size="11"
          :stroke="2"
          class="twist-icon"
          :class="{ open: isExpanded }"
        />
      </button>

      <button
        type="button"
        class="row-main"
        :title="`${node.name}\n${node.path}`"
        @click="select"
        @dblclick="openInspector"
      >
        <span class="orb" :style="orbStyle" />
        <span class="row-name">{{ node.name }}</span>
        <span v-if="node.litAt" class="lit" title="已点亮"><Icon name="star" :size="9" /></span>
        <span v-if="node.ownDiaryCount" class="row-diary" :title="`${node.ownDiaryCount} 篇记录`">
          {{ node.ownDiaryCount }}
        </span>
        <span class="row-value" :title="`亮度 ${formatBrightness(node.brightness)} / 100`">
          {{ formatBrightness(node.brightness) }}
        </span>
      </button>

      <button
        type="button"
        class="row-add"
        title="在这颗球下长出新枝"
        @click.stop="openNewNode(node.id)"
      >
        <Icon name="plus" :size="11" :stroke="2" />
      </button>
    </div>

    <template v-if="isExpanded && node.children.length">
      <TreeRow v-for="child in node.children" :key="child.id" :node="child" :depth="depth + 1" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import type { TreeNode } from '../../shared/types'
import { state, treeStore } from '../stores/tree'
import { formatBrightness } from '../lib/format'

defineOptions({ name: 'TreeRow' })

const props = defineProps<{ node: TreeNode; depth: number }>()

const isSelected = computed(() => state.selectedId === props.node.id)
const isExpanded = computed(() => state.expanded.includes(props.node.id))

const orbStyle = computed(() => ({
  '--b': String(Math.min(1, props.node.brightness / 100)),
  '--orb-size': `${Math.max(6, 9 - props.depth * 0.5)}px`,
}))

const { toggleExpand, openNewNode, openInspector: openInspectorStore } = treeStore

function select(): void {
  treeStore.selectNode(props.node.id, { openInspector: true })
}

function openInspector(): void {
  treeStore.selectNode(props.node.id, { openInspector: true })
  openInspectorStore()
}
</script>

<style scoped>
.tree-row {
  position: relative;
  display: flex;
  align-items: center;
  height: 28px;
  padding-right: 6px;
  border-radius: 6px;
  margin: 1px 6px 1px 4px;
  transition: background 0.14s var(--ease), box-shadow 0.14s var(--ease);
}

.tree-row:hover {
  background: var(--glass);
}

.tree-row.selected {
  background: var(--gold-soft);
  box-shadow: inset 2px 0 0 var(--gold);
}

.tree-row.selected .row-name {
  color: var(--gold-strong);
}

.twist {
  width: 15px;
  height: 20px;
  display: grid;
  place-items: center;
  color: var(--text-3);
  flex: none;
  border-radius: 4px;
}

.twist:hover {
  color: var(--text);
}

.twist.hidden {
  visibility: hidden;
  pointer-events: none;
}

.twist-icon {
  transition: transform 0.16s var(--ease);
}

.twist-icon.open {
  transform: rotate(90deg);
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 100%;
  text-align: left;
  padding-left: 1px;
}

.orb {
  width: var(--orb-size, 8px);
  height: var(--orb-size, 8px);
  border-radius: 50%;
  flex: none;
  background: rgba(255, 236, 206, calc(0.28 + 0.72 * var(--b)));
  box-shadow:
    0 0 calc(3px + 11px * var(--b)) rgba(255, 196, 104, calc(0.08 + 0.5 * var(--b))),
    inset 0 0 2px rgba(255, 255, 255, 0.55);
  opacity: calc(0.45 + 0.55 * var(--b));
}

[data-theme="light"] .orb {
  background: hsl(41 85% calc(78% - 34% * var(--b)));
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.7);
  opacity: 1;
}

.row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--text-2);
  letter-spacing: 0.01em;
}

.tree-row.selected .row-name {
  font-weight: 500;
}

.lit {
  color: var(--gold);
  display: inline-grid;
  place-items: center;
  flex: none;
  filter: drop-shadow(0 0 4px rgba(var(--glow), 0.7));
}

.row-diary {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-3);
  background: var(--glass);
  border-radius: 4px;
  padding: 0 4px;
  line-height: 15px;
  flex: none;
}

.row-value {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-3);
  opacity: 0.6;
  flex: none;
  min-width: 22px;
  text-align: right;
}

.row-add {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  color: var(--text-3);
  flex: none;
  opacity: 0;
  transition: opacity 0.14s var(--ease), color 0.14s var(--ease), background 0.14s var(--ease);
}

.tree-row:hover .row-add,
.row-add:focus-visible {
  opacity: 1;
}

.row-add:hover {
  color: var(--gold);
  background: var(--gold-soft);
}

@media (max-width: 1080px) {
  .row-value {
    display: none;
  }
}
</style>
