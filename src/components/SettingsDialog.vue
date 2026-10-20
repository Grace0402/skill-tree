<template>
  <Teleport to="body">
    <Transition name="pop" appear>
      <div v-if="state.settingsOpen" class="modal-mask" @mousedown.self="closeSettings">
        <div class="sheet modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <header class="modal-head">
            <div>
              <p class="eyebrow">Preferences</p>
              <h2 id="settings-title" class="modal-title serif">设置</h2>
            </div>
            <button class="icon-btn" type="button" title="关闭（Esc）" @click="closeSettings">
              <Icon name="close" :size="16" />
            </button>
          </header>

          <div class="modal-body">
            <section class="section">
              <div class="section-head">
                <h3>外观</h3>
                <p>整屏同一个调子；深色靠发光，浅色靠色阶。</p>
              </div>
              <div class="theme-grid">
                <button
                  v-for="option in themes"
                  :key="option.mode"
                  type="button"
                  class="theme-card"
                  :class="{ active: state.themeMode === option.mode }"
                  @click="setTheme(option.mode)"
                >
                  <span class="theme-icon" :class="option.mode">
                    <Icon :name="option.icon" :size="17" :stroke="1.5" />
                  </span>
                  <span class="theme-name">{{ option.label }}</span>
                  <span class="theme-desc">{{ option.desc }}</span>
                  <span v-if="state.themeMode === option.mode" class="theme-check">
                    <Icon name="check" :size="10" :stroke="2.4" />
                  </span>
                </button>
              </div>
            </section>

            <section class="section">
              <div class="section-head">
                <h3>AI 难度建议</h3>
                <p>只在你点「AI 建议难度」时，把那段技能描述发出去。日记内容永远不发送。</p>
              </div>
              <div class="field">
                <label class="field-label" for="api-key">
                  <span>API Key</span>
                  <button type="button" class="text-btn" @click="showKey = !showKey">
                    {{ showKey ? '隐藏' : '显示' }}
                  </button>
                </label>
                <input
                  id="api-key"
                  v-model="drafts.apiKey"
                  class="input mono"
                  :type="showKey ? 'text' : 'password'"
                  placeholder="sk-…（只存在本地 config.json）"
                  autocomplete="off"
                  spellcheck="false"
                />
              </div>
              <div class="two-col">
                <div class="field">
                  <label class="field-label" for="base-url">接口地址</label>
                  <input
                    id="base-url"
                    v-model="drafts.baseUrl"
                    class="input mono"
                    placeholder="https://api.deepseek.com"
                    spellcheck="false"
                  />
                </div>
                <div class="field">
                  <label class="field-label" for="model">模型</label>
                  <input
                    id="model"
                    v-model="drafts.model"
                    class="input mono"
                    placeholder="deepseek-chat"
                    spellcheck="false"
                  />
                </div>
              </div>
              <p class="note">支持任意 OpenAI 兼容接口。没有 Key 不影响记日记、变亮、点亮。</p>
            </section>

            <section class="section">
              <div class="section-head">
                <h3>节奏</h3>
                <p>所有节点都慢：单篇几乎无感，一年才明显。这里可以全局微调。</p>
              </div>
              <div class="three-col">
                <div class="field">
                  <label class="field-label" for="alpha">
                    <span>衰减 α</span>
                  </label>
                  <input
                    id="alpha"
                    v-model.number="drafts.alpha"
                    class="input mono"
                    type="number"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                  />
                  <span class="field-hint">每向上一层，光只剩 {{ Math.round(alphaPercent) }}%</span>
                </div>
                <div class="field">
                  <label class="field-label" for="kmin">kMin（最难）</label>
                  <input
                    id="kmin"
                    v-model.number="drafts.kMin"
                    class="input mono"
                    type="number"
                    min="0.000001"
                    step="0.00005"
                  />
                  <span class="field-hint">难度 1 的变亮速度</span>
                </div>
                <div class="field">
                  <label class="field-label" for="kmax">kMax（最易）</label>
                  <input
                    id="kmax"
                    v-model.number="drafts.kMax"
                    class="input mono"
                    type="number"
                    min="0.000001"
                    step="0.00005"
                  />
                  <span class="field-hint">难度 0 的变亮速度</span>
                </div>
              </div>
              <div class="rhythm-preview">
                <Icon name="clock" :size="12" />
                <span>
                  每天记一次：最容易的事一年约 {{ easyYear.toFixed(0) }}%，最难的事一年约
                  {{ hardYear.toFixed(0) }}%。中心圆还要再慢一层。
                </span>
              </div>
            </section>

            <section class="section">
              <div class="section-head">
                <h3>数据</h3>
                <p>整棵树就是一个普通文件夹，可以直接用文件管理器或 Obsidian 打开、编辑、备份。</p>
              </div>
              <div class="path-box" :title="rootPath">
                <Icon name="folder" :size="12" />
                <span class="path-text">{{ rootPath }}</span>
                <button class="mini-text" type="button" @click="openFolder">打开</button>
              </div>
              <div class="data-actions">
                <button class="btn small" type="button" @click="changeDir">
                  <Icon name="refresh" :size="12" />
                  更换数据文件夹
                </button>
                <span class="note">换一个文件夹，就是换一棵树；原文件夹不会被删除。</span>
              </div>
            </section>

            <section class="section about">
              <div class="section-head">
                <h3>关于</h3>
              </div>
              <p class="about-line">
                个人技能树 <span class="mono-inline">v{{ state.appInfo?.version ?? '1.0.0' }}</span>
                <span class="dot">·</span>
                Electron {{ state.appInfo?.electron ?? '—' }}
                <span class="dot">·</span>
                Chromium {{ state.appInfo?.chrome ?? '—' }}
              </p>
              <p class="about-note">
                它不给你打分、不催你点满，只记录你点亮了什么、长出了什么。
              </p>
            </section>
          </div>

          <footer class="modal-foot">
            <button class="btn small ghost" type="button" @click="resetRhythm">
              恢复默认节奏
            </button>
            <span class="spacer" />
            <button class="btn ghost" type="button" @click="closeSettings">取消</button>
            <button class="btn primary" type="button" :disabled="state.saving" @click="save">
              {{ state.saving ? '保存中…' : '保存设置' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Icon, { type IconName } from './Icon.vue'
import { state, treeStore } from '../stores/tree'
import { api } from '../ipc'
import type { ThemeMode } from '../../shared/types'

const themes: Array<{ mode: ThemeMode; label: string; desc: string; icon: IconName }> = [
  { mode: 'dark', label: '深色', desc: '从暗里亮起来的光晕', icon: 'moon' },
  { mode: 'light', label: '浅色', desc: '暖黄实心色阶，不发光', icon: 'sun' },
  { mode: 'system', label: '跟随系统', desc: '随系统深浅色自动切换', icon: 'monitor' },
]

const showKey = ref(false)

const drafts = reactive({
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  alpha: 0.6,
  kMin: 0.00025,
  kMax: 0.001,
})

const rootPath = computed(() => state.snapshot?.rootPath ?? '')

const alphaPercent = computed(() => {
  const value = Number(drafts.alpha)
  return Number.isFinite(value) ? Math.round(value * 100) : 60
})

const easyYear = computed(() => {
  const k = Number(drafts.kMax)
  return Number.isFinite(k) && k > 0 ? 100 * (1 - Math.exp(-k * 365)) : 0
})

const hardYear = computed(() => {
  const k = Number(drafts.kMin)
  return Number.isFinite(k) && k > 0 ? 100 * (1 - Math.exp(-k * 365)) : 0
})

const { closeSettings, setTheme, saveConfig, chooseDataDir } = treeStore

function hydrate(): void {
  const config = state.snapshot?.config
  drafts.apiKey = config?.apiKey ?? ''
  drafts.baseUrl = config?.baseUrl ?? 'https://api.deepseek.com'
  drafts.model = config?.model ?? 'deepseek-chat'
  drafts.alpha = config?.alpha ?? 0.6
  drafts.kMin = config?.kMin ?? 0.00025
  drafts.kMax = config?.kMax ?? 0.001
  showKey.value = false
}

watch(
  () => state.settingsOpen,
  (open) => {
    if (open) hydrate()
  },
)

function resetRhythm(): void {
  drafts.alpha = 0.6
  drafts.kMin = 0.00025
  drafts.kMax = 0.001
  treeStore.toast('已恢复默认节奏，保存后生效', 'info')
}

async function save(): Promise<void> {
  const alpha = Number(drafts.alpha)
  const kMin = Number(drafts.kMin)
  const kMax = Number(drafts.kMax)
  if (!Number.isFinite(alpha) || alpha <= 0.05 || alpha >= 0.95) {
    treeStore.toast('衰减 α 需要在 5% 与 95% 之间', 'error')
    return
  }
  if (!Number.isFinite(kMin) || !Number.isFinite(kMax) || kMin <= 0 || kMax <= 0) {
    treeStore.toast('变亮速度需要大于 0', 'error')
    return
  }
  if (kMin > kMax) {
    treeStore.toast('kMin 应该不大于 kMax', 'error')
    return
  }
  const ok = await saveConfig({
    apiKey: drafts.apiKey,
    baseUrl: drafts.baseUrl,
    model: drafts.model,
    alpha,
    kMin,
    kMax,
  })
  if (ok) closeSettings()
}

async function openFolder(): Promise<void> {
  const result = await api.openDataDir()
  if (!result.ok) treeStore.toast(result.error, 'error')
}

async function changeDir(): Promise<void> {
  await chooseDataDir()
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
  width: min(620px, 100%);
  max-height: calc(100vh - 56px);
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
  padding: 20px 22px 10px 26px;
}

.eyebrow {
  font-size: 9.5px;
  letter-spacing: 0.3em;
  color: var(--text-3);
  text-transform: uppercase;
}

.modal-title {
  margin-top: 4px;
  font-size: 22px;
  font-weight: 400;
  letter-spacing: 0.08em;
}

.modal-head .icon-btn {
  margin-left: auto;
  margin-top: -2px;
}

.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 26px 22px;
}

.section {
  padding-top: 17px;
  margin-top: 15px;
  border-top: 1px solid var(--line);
}

.section:first-child {
  border-top: 0;
  margin-top: 0;
  padding-top: 4px;
}

.section-head {
  margin-bottom: 11px;
}

.section-head h3 {
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: var(--text);
}

.section-head p {
  margin-top: 4px;
  font-size: 10.5px;
  line-height: 1.65;
  color: var(--text-3);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 11px 12px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--glass);
  text-align: left;
  transition: border-color 0.16s var(--ease), background 0.16s var(--ease);
}

.theme-card:hover {
  border-color: var(--line-strong);
  background: var(--glass-strong);
}

.theme-card.active {
  border-color: rgba(var(--glow), 0.45);
  background: var(--gold-soft);
}

.theme-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  margin-bottom: 3px;
  color: var(--text-2);
  background: var(--glass);
}

.theme-icon.dark {
  color: #ffd9a0;
  background: #171b28;
}

.theme-icon.light {
  color: #a06a12;
  background: #f5efe1;
}

.theme-icon.system {
  color: var(--text-2);
  background: linear-gradient(135deg, #171b28 50%, #f5efe1 50%);
}

.theme-name {
  font-size: 12px;
  color: var(--text);
}

.theme-desc {
  font-size: 10px;
  line-height: 1.45;
  color: var(--text-3);
}

.theme-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--gold);
  color: #241706;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field + .field {
  margin-top: 10px;
}

.two-col,
.three-col {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.two-col {
  grid-template-columns: 1.4fr 1fr;
}

.three-col {
  grid-template-columns: repeat(3, 1fr);
}

.three-col .field + .field {
  margin-top: 0;
}

.text-btn {
  font-size: 10px;
  color: var(--gold);
  opacity: 0.85;
}

.text-btn:hover {
  opacity: 1;
}

.input {
  height: 34px;
  font-size: 12px;
}

.field-hint {
  font-size: 9.5px;
  color: var(--text-3);
  line-height: 1.5;
}

.note {
  margin-top: 9px;
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-3);
}

.rhythm-preview {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 12px;
  padding: 9px 11px;
  border-radius: 8px;
  background: var(--gold-soft);
  color: var(--gold);
  font-size: 10.5px;
  line-height: 1.6;
}

.rhythm-preview svg {
  margin-top: 2px;
  flex: none;
}

.path-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--input);
  color: var(--text-2);
}

.path-text {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 10.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-text {
  font-size: 10.5px;
  color: var(--gold);
  flex: none;
}

.mini-text:hover {
  text-decoration: underline;
}

.data-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.data-actions .note {
  margin-top: 0;
  flex: 1;
  min-width: 160px;
}

.about-line {
  font-size: 11px;
  color: var(--text-2);
}

.mono-inline {
  font-family: var(--font-mono);
  color: var(--text-3);
}

.dot {
  margin: 0 6px;
  color: var(--text-3);
}

.about-note {
  margin-top: 6px;
  font-size: 10.5px;
  line-height: 1.7;
  color: var(--text-3);
  font-family: var(--font-display);
  letter-spacing: 0.02em;
}

.modal-foot {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 22px;
  border-top: 1px solid var(--line);
  background: linear-gradient(180deg, transparent, var(--glass));
}

.spacer {
  flex: 1;
}

@media (max-height: 720px) {
  .about {
    display: none;
  }
}
</style>
