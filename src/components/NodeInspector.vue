<template>
  <aside class="inspector">
    <header class="insp-head">
      <div class="crumbs" :title="node.path">
        <span class="crumb-parent">{{ parentLabel }}</span>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">{{ node.name }}</span>
        <button class="mini-btn" type="button" title="复制文件夹路径" @click="copyPath">
          <Icon name="copy" :size="11" />
        </button>
      </div>
      <button class="icon-btn close-btn" type="button" title="收起（Esc）" @click="closeInspector">
        <Icon name="close" :size="15" />
      </button>
    </header>

    <div class="insp-scroll">
      <div class="title-row">
        <input
          v-if="renaming"
          ref="renameInputRef"
          v-model="renameDraft"
          class="input rename-input"
          maxlength="60"
          @keydown.enter.prevent="commitRename"
          @keydown.esc.prevent="cancelRename"
          @blur="commitRename"
        />
        <h2 v-else class="node-title serif" :title="node.name">{{ node.name }}</h2>
        <button
          v-if="!renaming"
          class="icon-btn"
          type="button"
          title="重命名文件夹"
          @click="startRename"
        >
          <Icon name="edit" :size="13" />
        </button>
        <button class="icon-btn" type="button" title="在文件管理器中显示" @click="reveal">
          <Icon name="folder" :size="13" />
        </button>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="stat-value gold">{{ formatBrightness(node.brightness) }}</span>
          <span class="stat-label">亮度</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ formatMarks(node.marks) }}</span>
          <span class="stat-label">记号</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ node.ownDiaryCount }}</span>
          <span class="stat-label">记录</span>
        </div>
      </div>
      <p class="stat-note">
        <template v-if="node.children.length">
          自己写了 {{ formatMarks(node.ownMarks) }} 个记号，另有子枝汇聚上来的光；亮度没有满分。
        </template>
        <template v-else>
          这 {{ formatMarks(node.marks) }} 个记号，就是这颗球的光的来源；亮度没有满分。
        </template>
      </p>

      <section class="block lit-block">
        <div class="block-head">
          <h3>里程碑</h3>
          <span v-if="node.litAt" class="badge gold"><Icon name="star" :size="9" /> 已点亮</span>
        </div>
        <div class="lit-row">
          <button
            type="button"
            class="btn"
            :class="node.litAt ? 'ghost' : 'lit-cta'"
            @click="toggleLit"
          >
            <Icon name="star" :size="12" />
            {{ node.litAt ? '取消点亮' : '点亮这一刻' }}
          </button>
          <span class="lit-time">
            {{ node.litAt ? formatMoment(node.litAt) : '学会的那一刻，值得记下来' }}
          </span>
        </div>
        <p class="hint">点亮是 0 → 1 的质变，和一点点变亮的亮度是两条线。</p>
      </section>

      <section class="block">
        <div class="block-head">
          <h3>难度</h3>
          <span class="mono-value">{{ Math.round(difficulty * 100) }}<small>%</small></span>
        </div>
        <input
          v-model.number="difficulty"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :style="{ '--fill': `${Math.round(difficulty * 100)}%` }"
          @change="saveDifficulty"
        />
        <div class="range-ends">
          <span>容易 · 亮得快</span>
          <span>极难 · 亮得慢</span>
        </div>
        <div class="ai-row">
          <button
            type="button"
            class="btn small ghost ai-btn"
            :disabled="state.aiBusy || !description.trim()"
            :title="apiKeyConfigured ? '根据描述给一个难度建议（可再手改）' : '先在设置里填写 API Key'"
            @click="askAi"
          >
            <Icon name="sparkles" :size="12" />
            {{ state.aiBusy ? 'AI 正在读…' : 'AI 建议难度' }}
          </button>
          <span v-if="aiReason" class="ai-reason">{{ aiReason }}</span>
          <span v-else class="hint">
            {{ apiKeyConfigured ? 'AI 只看描述，不碰你的日记' : '未配置 API Key，手动调即可' }}
          </span>
        </div>
        <p class="hint">难度只决定同样一次记录让球亮多快；已经留下的记号不会重算。</p>
      </section>

      <section class="block">
        <div class="block-head">
          <h3>你想达到的样子</h3>
          <span v-if="descriptionDirty" class="saving-dot">编辑中</span>
        </div>
        <textarea
          v-model="description"
          class="textarea desc-input"
          rows="3"
          placeholder="写清楚“学会”是什么样子，比如：能脱稿讲满 10 分钟，逻辑清楚。"
          @focus="descriptionFocused = true"
          @blur="saveDescription"
        />
      </section>

      <section class="block compose-block">
        <div class="block-head">
          <h3>写一篇日记</h3>
          <span class="hint">一次记录 = 一个记号</span>
        </div>
        <textarea
          ref="composeRef"
          v-model="composeText"
          class="textarea compose-input"
          rows="4"
          placeholder="今天为它做了什么？卡在哪里？哪一点顺了？"
          @keydown.ctrl.enter.prevent="submitDiary"
          @keydown.meta.enter.prevent="submitDiary"
        />
        <div class="compose-foot">
          <label class="deep-toggle">
            <input v-model="deep" type="checkbox" />
            <span>深度投入</span>
            <span class="deep-hint">记 2 个记号</span>
          </label>
          <span class="char-count">{{ composeText.length }}</span>
          <button
            type="button"
            class="btn primary"
            :disabled="!canSubmit"
            title="Ctrl / ⌘ + Enter"
            @click="submitDiary"
          >
            记一笔
          </button>
        </div>
        <p class="hint">
          今天特别投入？勾上「深度投入」。自己是深是浅，由你说了算，系统不替你判断。
        </p>
      </section>

      <section class="block diary-block">
        <div class="block-head">
          <h3>成长日记</h3>
          <span class="count">{{ node.diaries.length }} 篇</span>
        </div>
        <ul v-if="node.diaries.length" class="diary-list">
          <li
            v-for="entry in node.diaries"
            :key="entry.name"
            class="diary-item"
            :class="{ open: expandedFile === entry.name }"
          >
            <button type="button" class="diary-head" @click="toggleEntry(entry.name)">
              <span class="diary-date">{{ formatDiaryDate(entry.date) }}</span>
              <span v-if="entry.deep" class="badge gold deep-badge">深</span>
              <span class="diary-excerpt">{{ excerpt(entry.content) }}</span>
              <span class="diary-marks">{{ entry.marks }}</span>
              <Icon
                name="chevronRight"
                :size="10"
                class="diary-caret"
                :class="{ open: expandedFile === entry.name }"
              />
            </button>

            <div v-if="expandedFile === entry.name" class="diary-body">
              <template v-if="editingFile === entry.name">
                <textarea v-model="editText" class="textarea" rows="5" />
                <div class="edit-foot">
                  <label class="deep-toggle">
                    <input v-model="editDeep" type="checkbox" />
                    <span>深度投入</span>
                  </label>
                  <span class="spacer" />
                  <button class="btn small ghost" type="button" @click="cancelEdit">取消</button>
                  <button
                    class="btn small primary"
                    type="button"
                    :disabled="!editText.trim() || state.saving"
                    @click="saveEdit(entry.name)"
                  >
                    保存
                  </button>
                </div>
              </template>
              <template v-else>
                <pre class="diary-text">{{ entry.content }}</pre>
                <div class="diary-actions">
                  <span class="diary-meta">
                    {{ formatMoment(entry.mtime) }} · {{ entry.marks }} 个记号
                  </span>
                  <span class="spacer" />
                  <button class="text-btn" type="button" @click="startEdit(entry)">
                    编辑
                  </button>
                  <button
                    class="text-btn danger-text"
                    type="button"
                    @click="removeEntry(entry.name)"
                  >
                    {{ confirmDelete === entry.name ? '确认删除？' : '删除' }}
                  </button>
                </div>
              </template>
            </div>
          </li>
        </ul>
        <p v-else class="diary-empty">
          还没有记录。第一篇不用写得漂亮，写清楚今天发生了什么就好。
        </p>
      </section>
    </div>

    <footer class="insp-foot">
      <button class="btn small" type="button" @click="openNewNode(node.id)">
        <Icon name="plus" :size="12" />
        新建子节点
      </button>
      <span class="spacer" />
      <button class="btn small danger" type="button" @click="onArchive">
        <Icon name="archive" :size="12" />
        {{ archiveConfirm ? '确认归档？' : '剪枝归档' }}
      </button>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Icon from './Icon.vue'
import {
  apiKeyConfigured,
  parentMap,
  selectedNode,
  state,
  treeStore,
} from '../stores/tree'
import { api } from '../ipc'
import {
  excerpt,
  formatBrightness,
  formatDiaryDate,
  formatMarks,
  formatMoment,
} from '../lib/format'
import type { DiaryEntry, TreeNode } from '../../shared/types'

const node = computed<TreeNode>(() => selectedNode.value as TreeNode)

const description = ref('')
const descriptionFocused = ref(false)
const difficulty = ref(0.5)
const composeText = ref('')
const deep = ref(false)
const aiReason = ref('')
const expandedFile = ref('')
const editingFile = ref('')
const editText = ref('')
const editDeep = ref(false)
const confirmDelete = ref('')
const archiveConfirm = ref(false)
const renaming = ref(false)
const renameDraft = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)
const composeRef = ref<HTMLTextAreaElement | null>(null)

let deleteTimer: number | undefined
let archiveTimer: number | undefined

const parentLabel = computed(() => {
  if (!node.value) return ''
  const parentId = parentMap.value.get(node.value.id) ?? ''
  if (!parentId) return '中心'
  const parent = state.snapshot
    ? findName(state.snapshot.nodes, parentId)
    : ''
  return parent || '中心'
})

function findName(
  nodes: NonNullable<typeof state.snapshot>['nodes'],
  id: string,
): string {
  for (const item of nodes) {
    if (item.id === id) return item.name
    if (id.startsWith(`${item.id}/`)) {
      const nested = findName(item.children, id)
      if (nested) return nested
    }
  }
  return ''
}

const descriptionDirty = computed(
  () => Boolean(node.value) && description.value.trim() !== node.value!.description.trim(),
)

const canSubmit = computed(() => composeText.value.trim().length > 0 && !state.saving)

function syncFromNode(): void {
  const current = node.value
  if (!current) return
  description.value = current.description
  difficulty.value = current.difficulty
  aiReason.value = ''
}

watch(
  () => node.value?.id,
  () => {
    syncFromNode()
    composeText.value = ''
    deep.value = false
    expandedFile.value = ''
    editingFile.value = ''
    confirmDelete.value = ''
    archiveConfirm.value = false
    renaming.value = false
  },
  { immediate: true },
)

watch(
  () => [node.value?.description, node.value?.difficulty] as const,
  () => {
    if (!node.value) return
    if (!descriptionFocused.value) description.value = node.value.description
    difficulty.value = node.value.difficulty
  },
)

const { closeInspector, openNewNode, setLit, archiveNode } = treeStore

async function saveDescription(): Promise<void> {
  descriptionFocused.value = false
  if (!node.value || !descriptionDirty.value) return
  await treeStore.updateNodeMeta(node.value.id, { description: description.value })
}

async function saveDifficulty(): Promise<void> {
  if (!node.value) return
  await treeStore.updateNodeMeta(node.value.id, { difficulty: difficulty.value })
  aiReason.value = ''
}

async function askAi(): Promise<void> {
  if (!node.value) return
  const suggestion = await treeStore.suggestDifficulty(node.value.name, description.value)
  if (!suggestion) return
  difficulty.value = suggestion.difficulty
  aiReason.value = suggestion.reason
  await treeStore.updateNodeMeta(node.value.id, { difficulty: suggestion.difficulty })
  treeStore.toast(`AI 建议难度 ${Math.round(suggestion.difficulty * 100)}%，可以再手改`, 'info')
}

async function toggleLit(): Promise<void> {
  if (!node.value) return
  await setLit(node.value.id, !node.value.litAt)
}

async function submitDiary(): Promise<void> {
  if (!canSubmit.value) return
  const text = composeText.value
  const isDeep = deep.value
  const ok = await treeStore.writeDiary(text, isDeep)
  if (!ok) return
  composeText.value = ''
  deep.value = false
  const first = node.value?.diaries[0]
  if (first) expandedFile.value = first.name
  composeRef.value?.focus()
}

function toggleEntry(name: string): void {
  expandedFile.value = expandedFile.value === name ? '' : name
  editingFile.value = ''
  confirmDelete.value = ''
}

function startEdit(entry: DiaryEntry): void {
  editingFile.value = entry.name
  editText.value = entry.content
  editDeep.value = entry.deep
}

function cancelEdit(): void {
  editingFile.value = ''
  editText.value = ''
}

async function saveEdit(name: string): Promise<void> {
  if (!editText.value.trim()) return
  const ok = await treeStore.updateDiary(name, editText.value, editDeep.value)
  if (ok) editingFile.value = ''
}

function removeEntry(name: string): void {
  if (confirmDelete.value !== name) {
    confirmDelete.value = name
    if (deleteTimer) window.clearTimeout(deleteTimer)
    deleteTimer = window.setTimeout(() => {
      confirmDelete.value = ''
    }, 3200)
    return
  }
  confirmDelete.value = ''
  void treeStore.deleteDiaryEntry(name)
}

function onArchive(): void {
  if (!node.value) return
  if (!archiveConfirm.value) {
    archiveConfirm.value = true
    if (archiveTimer) window.clearTimeout(archiveTimer)
    archiveTimer = window.setTimeout(() => {
      archiveConfirm.value = false
    }, 3600)
    return
  }
  archiveConfirm.value = false
  void archiveNode(node.value.id)
}

function startRename(): void {
  if (!node.value) return
  renameDraft.value = node.value.name
  renaming.value = true
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function cancelRename(): void {
  renaming.value = false
}

async function commitRename(): Promise<void> {
  if (!renaming.value || !node.value) return
  const next = renameDraft.value.trim()
  if (!next || next === node.value.name) {
    renaming.value = false
    return
  }
  const ok = await treeStore.renameNode(node.value.id, next)
  renaming.value = ok
}

async function copyPath(): Promise<void> {
  if (!node.value) return
  const result = await api.copyNodePath(node.value.id)
  if (result.ok) treeStore.toast('文件夹路径已复制', 'success')
  else treeStore.toast(result.error, 'error')
}

async function reveal(): Promise<void> {
  if (!node.value) return
  const result = await api.revealNode(node.value.id)
  if (!result.ok) treeStore.toast(result.error, 'error')
}
</script>

<style scoped>
.inspector {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 372px;
  z-index: 35;
  display: flex;
  flex-direction: column;
  background: var(--panel-strong);
  border-left: 1px solid var(--line);
  box-shadow: -24px 0 60px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(26px) saturate(1.1);
}

.insp-head {
  flex: none;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px 0 18px;
  border-bottom: 1px solid var(--line);
}

.crumbs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: var(--text-3);
  overflow: hidden;
  white-space: nowrap;
}

.crumb-parent {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 30%;
}

.crumb-sep {
  opacity: 0.5;
}

.crumb-current {
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-btn {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  color: var(--text-3);
  flex: none;
  opacity: 0.6;
}

.mini-btn:hover {
  opacity: 1;
  background: var(--glass);
  color: var(--text);
}

.close-btn {
  flex: none;
}

.insp-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px 20px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.node-title {
  flex: 1;
  min-width: 0;
  font-size: 21px;
  line-height: 1.35;
  letter-spacing: 0.04em;
  color: var(--text);
  overflow-wrap: anywhere;
}

.rename-input {
  flex: 1;
  font-size: 15px;
  padding: 6px 9px;
}

.stats {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  margin-top: 14px;
  padding: 11px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat + .stat {
  padding-left: 14px;
  border-left: 1px solid var(--line);
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 300;
  color: var(--text);
  line-height: 1.1;
}

.stat-value.gold {
  color: var(--gold);
  text-shadow: 0 0 22px rgba(var(--glow), 0.22);
}

.stat-label {
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: var(--text-3);
}

.stat-note {
  margin-top: 7px;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--text-3);
}

.block {
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px solid var(--line);
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 9px;
}

.block-head h3 {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: var(--text-2);
}

.mono-value {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--gold);
}

.mono-value small {
  font-size: 9px;
  color: var(--text-3);
  margin-left: 1px;
}

.lit-block {
  margin-top: 12px;
}

.lit-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.lit-cta {
  border-color: rgba(var(--glow), 0.35);
  background: var(--gold-soft);
  color: var(--gold-strong);
}

.lit-cta:hover {
  background: rgba(var(--glow), 0.18);
}

.lit-time {
  font-size: 10.5px;
  color: var(--text-3);
}

.range-ends {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  font-size: 10px;
  color: var(--text-3);
}

.ai-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.ai-btn {
  height: 24px;
  padding: 0 8px;
  border: 1px dashed var(--line-strong);
}

.ai-reason {
  font-size: 10.5px;
  color: var(--gold);
  line-height: 1.4;
  flex: 1;
  min-width: 120px;
}

.hint {
  margin-top: 7px;
  font-size: 10.5px;
  line-height: 1.65;
  color: var(--text-3);
}

.desc-input {
  min-height: 64px;
  font-size: 12px;
  line-height: 1.7;
}

.saving-dot {
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--gold);
  opacity: 0.8;
}

.compose-input {
  min-height: 94px;
  background: var(--input-focus);
  border-color: var(--line-strong);
}

.compose-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.deep-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-2);
  cursor: pointer;
  user-select: none;
}

.deep-hint {
  font-size: 10px;
  color: var(--text-3);
}

.char-count {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--text-3);
}

.compose-foot .btn {
  height: 29px;
  padding: 0 14px;
}

.count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-3);
}

.diary-block {
  padding-bottom: 4px;
}

.diary-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.diary-item {
  border-top: 1px solid var(--line);
}

.diary-item:first-child {
  border-top: 0;
}

.diary-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  text-align: left;
  color: var(--text-2);
  border-radius: 5px;
  padding: 0 4px;
}

.diary-head:hover {
  background: var(--glass);
}

.diary-date {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-2);
  flex: none;
}

.deep-badge {
  height: 15px;
  padding: 0 5px;
  font-size: 9px;
  flex: none;
}

.diary-excerpt {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diary-marks {
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--text-3);
  opacity: 0.7;
  flex: none;
}

.diary-caret {
  color: var(--text-3);
  transition: transform 0.16s var(--ease);
  flex: none;
}

.diary-caret.open {
  transform: rotate(90deg);
}

.diary-body {
  padding: 2px 4px 12px;
}

.diary-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-ui);
  font-size: 12px;
  line-height: 1.85;
  color: var(--text-2);
  background: var(--glass);
  border-radius: 8px;
  padding: 10px 11px;
  max-height: 280px;
  overflow-y: auto;
}

.diary-actions,
.edit-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 7px;
}

.diary-meta {
  font-size: 9.5px;
  color: var(--text-3);
}

.spacer {
  flex: 1;
}

.text-btn {
  font-size: 10.5px;
  color: var(--text-3);
  padding: 2px 4px;
  border-radius: 4px;
}

.text-btn:hover {
  color: var(--text);
  background: var(--glass);
}

.danger-text {
  color: var(--text-3);
}

.danger-text:hover {
  color: var(--danger);
  background: var(--danger-soft);
}

.diary-empty {
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-3);
  padding: 8px 2px 4px;
}

.insp-foot {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--line);
  background: var(--panel);
}

.insp-foot .btn {
  height: 28px;
  font-size: 11.5px;
}
</style>
