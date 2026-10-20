<template>
  <Teleport to="body">
    <Transition name="pop" appear>
      <div v-if="state.newNodeOpen" class="modal-mask" @mousedown.self="closeNewNode">
        <form class="sheet modal" role="dialog" aria-modal="true" aria-labelledby="new-node-title" @submit.prevent="submit">
          <header class="modal-head">
            <div>
              <p class="eyebrow">新的分支</p>
              <h2 id="new-node-title" class="modal-title serif">
                {{ isRoot ? '长出第一根枝' : '长出一根新枝' }}
              </h2>
              <p class="parent-line">
                在 <span class="parent-name">{{ parentName }}</span> 之下
              </p>
            </div>
            <button class="icon-btn" type="button" title="关闭（Esc）" @click="closeNewNode">
              <Icon name="close" :size="16" />
            </button>
          </header>

          <div class="modal-body">
            <div class="field">
              <label class="field-label" for="node-name">
                <span>名字</span>
                <span class="faint">会成为文件夹名</span>
              </label>
              <input
                id="node-name"
                ref="nameRef"
                v-model="name"
                class="input name-input"
                type="text"
                maxlength="60"
                placeholder="例如：口语表达、烘焙、理财"
                autocomplete="off"
                spellcheck="false"
                @keydown.enter.prevent="submit"
              />
              <p v-if="nameError" class="field-error">{{ nameError }}</p>
            </div>

            <div class="field">
              <label class="field-label" for="node-desc">
                <span>你想达到的样子</span>
                <span class="faint">可稍后再写</span>
              </label>
              <textarea
                id="node-desc"
                v-model="description"
                class="textarea"
                rows="3"
                placeholder="写清楚“学会”是什么样子，AI 会据此给一个难度建议。"
                @keydown.ctrl.enter.prevent="submit"
                @keydown.meta.enter.prevent="submit"
              />
              <div class="ai-row">
                <button
                  class="btn small ghost ai-btn"
                  type="button"
                  :disabled="state.aiBusy || !description.trim()"
                  @click="askAi"
                >
                  <Icon name="sparkles" :size="12" />
                  {{ state.aiBusy ? 'AI 正在读…' : 'AI 建议难度' }}
                </button>
                <span v-if="aiReason" class="ai-reason">{{ aiReason }}</span>
                <span v-else class="field-hint">
                  {{ apiKeyConfigured ? 'AI 只看这段描述，不评价你' : '没有 API Key 也能用，手动调即可' }}
                </span>
              </div>
            </div>

            <div class="field difficulty-field">
              <label class="field-label" for="node-difficulty">
                <span>难度</span>
                <span class="difficulty-value">{{ Math.round(difficulty * 100) }}<small>%</small></span>
              </label>
              <input
                id="node-difficulty"
                v-model.number="difficulty"
                type="range"
                min="0"
                max="1"
                step="0.01"
                :style="{ '--fill': `${Math.round(difficulty * 100)}%` }"
              />
              <div class="range-ends">
                <span>容易 · 亮得快</span>
                <span>极难 · 亮得慢</span>
              </div>
              <p class="field-hint">
                难度只影响“同样一次记录让球亮多快”：越难，光涨得越慢。你随时可以改。
              </p>
            </div>
          </div>

          <footer class="modal-foot">
            <p class="foot-note">新枝不需要解锁，随时都能长出来。</p>
            <span class="spacer" />
            <button class="btn ghost" type="button" @click="closeNewNode">取消</button>
            <button class="btn primary" type="submit" :disabled="!canCreate || state.saving">
              {{ state.saving ? '正在长…' : '长出来' }}
            </button>
          </footer>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Icon from './Icon.vue'
import {
  apiKeyConfigured,
  nodeMap,
  state,
  treeStore,
} from '../stores/tree'

const name = ref('')
const description = ref('')
const difficulty = ref(0.5)
const aiReason = ref('')
const nameRef = ref<HTMLInputElement | null>(null)

const { closeNewNode } = treeStore

const isRoot = computed(() => !state.newNodeParentId)

const parentName = computed(() => {
  if (!state.newNodeParentId) return '中心 · 我自己'
  return nodeMap.value.get(state.newNodeParentId)?.name ?? '中心 · 我自己'
})

const nameError = computed(() => {
  const value = name.value.trim()
  if (!value) return ''
  if ([...value].length > 60) return '最多 60 个字'
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(value)) return '不能包含 \\ / : * ? " < > | 等字符'
  if (value.startsWith('.')) return '不能以 . 开头'
  if (value.toLowerCase() === '_archived') return '「_archived」是归档区专用名称'
  return ''
})

const canCreate = computed(() => Boolean(name.value.trim()) && !nameError.value)

watch(
  () => state.newNodeOpen,
  async (open) => {
    if (!open) return
    name.value = ''
    description.value = ''
    difficulty.value = 0.5
    aiReason.value = ''
    await nextTick()
    nameRef.value?.focus()
  },
)

async function submit(): Promise<void> {
  if (!canCreate.value || state.saving) return
  const nameValue = name.value.replace(/\s+/g, ' ').trim()
  if (!nameValue) return
  await treeStore.createNode({
    name: nameValue,
    description: description.value,
    difficulty: difficulty.value,
  })
}

async function askAi(): Promise<void> {
  const suggestion = await treeStore.suggestDifficulty(
    name.value.trim() || '这项技能',
    description.value,
  )
  if (!suggestion) return
  difficulty.value = suggestion.difficulty
  aiReason.value = suggestion.reason
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--scrim);
  backdrop-filter: blur(4px);
}

.modal {
  width: min(486px, 100%);
  max-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  border: 1px solid var(--line-strong);
  background: var(--panel-strong);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.modal-head {
  flex: none;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 22px 22px 12px 26px;
}

.eyebrow {
  font-size: 9.5px;
  letter-spacing: 0.3em;
  color: var(--text-3);
  text-transform: uppercase;
}

.modal-title {
  margin-top: 5px;
  font-size: 23px;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: var(--text);
}

.parent-line {
  margin-top: 5px;
  font-size: 11px;
  color: var(--text-3);
}

.parent-name {
  color: var(--gold);
}

.modal-head .icon-btn {
  margin-left: auto;
  margin-top: -2px;
}

.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 26px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.name-input {
  height: 40px;
  font-family: var(--font-display);
  font-size: 15px;
  letter-spacing: 0.03em;
}

.modal-body textarea {
  min-height: 72px;
  font-size: 12.5px;
  line-height: 1.75;
}

.field-error {
  font-size: 10.5px;
  color: var(--danger);
}

.ai-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 1px;
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
  min-width: 140px;
}

.difficulty-field {
  padding-top: 2px;
}

.difficulty-value {
  font-family: var(--font-mono);
  font-size: 15px;
  color: var(--gold);
}

.difficulty-value small {
  font-size: 9px;
  color: var(--text-3);
  margin-left: 1px;
}

.range-ends {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-3);
  margin-top: 1px;
}

.modal-foot {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 22px;
  border-top: 1px solid var(--line);
  background: linear-gradient(180deg, transparent, var(--glass));
}

.foot-note {
  font-size: 10px;
  color: var(--text-3);
  max-width: 200px;
  line-height: 1.5;
}

.spacer {
  flex: 1;
}

@media (max-height: 700px) {
  .foot-note {
    display: none;
  }
}
</style>
