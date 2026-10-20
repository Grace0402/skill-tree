<template>
  <section
    ref="hostRef"
    class="canvas"
    :class="{ dragging, 'inspector-open': state.inspectorOpen }"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="onDoubleClick"
  >
    <div class="stars" />
    <div class="vignette" />

    <div
      class="aura"
      :style="{
        left: `${centerScreen.x}px`,
        top: `${centerScreen.y}px`,
        opacity: 0.25 + centerLevel * 0.75,
      }"
    />

    <svg
      v-if="size.w > 0"
      class="wires"
      :width="size.w"
      :height="size.h"
      aria-hidden="true"
    >
      <g class="rings">
        <circle
          v-for="ring in layout.rings"
          :key="`ring-${ring.depth}`"
          :cx="centerScreen.x"
          :cy="centerScreen.y"
          :r="Math.max(1, ring.radius * finalScale)"
          fill="none"
        />
      </g>
      <g class="links">
        <line
          v-for="link in screenLinks"
          :key="link.id"
          :x1="link.x1"
          :y1="link.y1"
          :x2="link.x2"
          :y2="link.y2"
          :stroke-opacity="link.opacity"
          :stroke-width="link.width"
        />
      </g>
    </svg>

    <CrystalBall
      v-for="item in screenBalls"
      :key="item.ball.isCenter ? 'center' : item.ball.id"
      :ball="item.ball"
      :x="item.x"
      :y="item.y"
      :size="item.size"
      :label-size="item.labelSize"
      :selected="item.ball.id === state.selectedId"
      :dimmed="isDimmed(item.ball)"
      :empty="isEmpty"
      @select="onSelect"
      @add="onAdd"
    />

    <div class="canvas-title">
      <p class="eyebrow">成长足迹树</p>
      <p class="tagline">光从叶子往上走，最后照亮中心的自己</p>
    </div>

    <div class="zoom-controls canvas-ui">
      <button type="button" class="zoom-btn" title="缩小" @click="zoomBy(1 / 1.22)">
        <Icon name="minus" :size="13" />
      </button>
      <span class="zoom-value">{{ zoomPercent }}%</span>
      <button type="button" class="zoom-btn" title="放大" @click="zoomBy(1.22)">
        <Icon name="plus" :size="13" />
      </button>
      <span class="zoom-divider" />
      <button type="button" class="zoom-btn" title="回到全览（双击空白处）" @click="resetView()">
        <Icon name="expand" :size="13" />
      </button>
    </div>

    <div class="center-card canvas-ui" :class="{ active: isCenterSelected }" @click="selectCenter">
      <div class="cc-head">
        <span class="cc-orb" :style="{ '--b': centerLevel }" />
        <span class="cc-name serif">我 · 你自己</span>
        <span v-if="isCenterSelected" class="cc-tag">整体</span>
      </div>
      <div class="cc-main">
        <span class="cc-value">{{ formatBrightness(center.brightness) }}</span>
        <span class="cc-unit">亮度</span>
      </div>
      <p class="cc-meta">
        {{ center.nodeCount }} 枝 · {{ center.diaryCount }} 次记录
        <template v-if="center.litCount"> · {{ center.litCount }} 次点亮</template>
      </p>
      <p v-if="lastEntryLabel" class="cc-last">最近记录 {{ lastEntryLabel }}</p>
      <p class="cc-note">永远差一点，因为人生没有学完的那天。</p>
      <button
        v-if="isEmpty"
        type="button"
        class="btn primary cc-cta"
        @click.stop="onAdd('')"
      >
        <Icon name="plus" :size="13" :stroke="2" />
        长出第一根枝
      </button>
      <button v-else type="button" class="btn small ghost cc-add" @click.stop="onAdd('')">
        <Icon name="plus" :size="12" />
        添一根新枝
      </button>
    </div>

    <p v-if="!state.inspectorOpen" class="canvas-hint">
      滚轮缩放 · 拖动平移 · 双击复位 · 点击水晶球聚焦
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import CrystalBall from './CrystalBall.vue'
import Icon from './Icon.vue'
import { buildLayout, type LayoutBall } from '../lib/layout'
import {
  focusPath,
  isCenterSelected,
  state,
  treeStore,
} from '../stores/tree'
import { formatBrightness, formatDayMoment } from '../lib/format'

const hostRef = ref<HTMLElement | null>(null)
const size = reactive({ w: 0, h: 0 })
const zoom = ref(1)
const pan = reactive({ x: 0, y: 0 })
const dragging = ref(false)

const nodes = computed(() => state.snapshot?.nodes ?? [])
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

const layout = computed(() => buildLayout(nodes.value, center.value))
const isEmpty = computed(() => nodes.value.length === 0)
const centerLevel = computed(() => Math.min(1, center.value.brightness / 100))
const lastEntryLabel = computed(() =>
  center.value.lastEntryAt ? formatDayMoment(center.value.lastEntryAt) : '',
)

const fitScale = computed(() => {
  if (!size.w || !size.h) return 1
  const paddingX = size.w < 760 ? 74 : 112
  const paddingY = size.h < 600 ? 70 : 104
  const sx = (size.w - paddingX * 2) / Math.max(layout.value.bounds.width, 40)
  const sy = (size.h - paddingY * 2) / Math.max(layout.value.bounds.height, 40)
  return Math.max(0.16, Math.min(sx, sy, 1.12))
})

const finalScale = computed(() => fitScale.value * zoom.value)

const shiftX = computed(() => {
  if (!state.inspectorOpen) return 0
  return -Math.min(196, size.w * 0.15)
})

/** 给左下角的「我」卡片让出空间，避免压住底部的球 */
const contentShift = computed(() => (isEmpty.value ? { x: 0, y: 0 } : { x: 66, y: -18 }))

const centerScreen = computed(() => toScreen(0, 0))

function toScreen(x: number, y: number): { x: number; y: number } {
  const s = finalScale.value
  return {
    x:
      size.w / 2 +
      shiftX.value +
      contentShift.value.x +
      pan.x +
      (x - layout.value.bounds.cx) * s,
    y:
      size.h / 2 +
      contentShift.value.y +
      pan.y +
      (y - layout.value.bounds.cy) * s,
  }
}

const screenBalls = computed(() =>
  layout.value.balls.map((ball) => {
    const point = toScreen(ball.x, ball.y)
    const s = finalScale.value
    const factor = Math.max(0.82, Math.min(1.12, s))
    return {
      ball,
      x: point.x,
      y: point.y,
      size: Math.max(16, ball.size * s),
      labelSize: Math.max(11, (ball.isCenter ? 15.5 : 13) * factor),
    }
  }),
)

const screenLinks = computed(() =>
  layout.value.links.map((link) => {
    const from = toScreen(link.x1, link.y1)
    const to = toScreen(link.x2, link.y2)
    const focused = Boolean(state.selectedId) && focusPath.value.has(link.id)
    const base = 0.15 + (link.brightness / 100) * 0.3
    const opacity = state.selectedId
      ? focused
        ? Math.min(0.9, base + 0.38)
        : 0.05
      : base
    return {
      id: link.id,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      opacity,
      width: Math.max(0.7, Math.min(1.5, 1.05 * finalScale.value)),
    }
  }),
)

const zoomPercent = computed(() => Math.round(zoom.value * 100))

function isDimmed(ball: LayoutBall): boolean {
  if (!state.selectedId) return false
  if (ball.isCenter) return false
  return !focusPath.value.has(ball.id)
}

function onSelect(id: string): void {
  if (id === '' && isEmpty.value) {
    treeStore.openNewNode('')
    return
  }
  treeStore.selectNode(id, { openInspector: id !== '' })
}

function onAdd(id: string): void {
  treeStore.openNewNode(id)
}

function selectCenter(): void {
  treeStore.selectNode('', { openInspector: false })
}

/* ---------------- 缩放 / 平移 ---------------- */

function onWheel(event: WheelEvent): void {
  if (!hostRef.value) return
  const rect = hostRef.value.getBoundingClientRect()
  const px = event.clientX - rect.left
  const py = event.clientY - rect.top
  const oldScale = finalScale.value
  const nextZoom = Math.min(4, Math.max(0.5, zoom.value * Math.exp(-event.deltaY * 0.0015)))
  const nextScale = fitScale.value * nextZoom
  const anchorX = size.w / 2 + shiftX.value + contentShift.value.x
  const anchorY = size.h / 2 + contentShift.value.y
  const worldX = (px - anchorX - pan.x) / oldScale + layout.value.bounds.cx
  const worldY = (py - anchorY - pan.y) / oldScale + layout.value.bounds.cy
  pan.x = px - anchorX - (worldX - layout.value.bounds.cx) * nextScale
  pan.y = py - anchorY - (worldY - layout.value.bounds.cy) * nextScale
  zoom.value = nextZoom
}

function zoomBy(factor: number): void {
  const next = Math.min(4, Math.max(0.5, zoom.value * factor))
  const ratio = next / zoom.value
  pan.x *= ratio
  pan.y *= ratio
  zoom.value = next
}

function resetView(): void {
  zoom.value = 1
  pan.x = 0
  pan.y = 0
}

/* ---------------- 拖动 / 空白点击 ---------------- */

let dragState: {
  pointerId: number
  startX: number
  startY: number
  panX: number
  panY: number
  moved: boolean
} | null = null

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  const target = event.target as HTMLElement
  if (target.closest('.ball-node, .canvas-ui, button, a, input, textarea')) return
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX: pan.x,
    panY: pan.y,
    moved: false,
  }
  dragging.value = true
  hostRef.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!dragState) return
  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  if (Math.hypot(dx, dy) > 4) dragState.moved = true
  pan.x = dragState.panX + dx
  pan.y = dragState.panY + dy
}

function onPointerUp(event: PointerEvent): void {
  if (!dragState) return
  const moved = dragState.moved
  if (hostRef.value?.hasPointerCapture(dragState.pointerId)) {
    hostRef.value.releasePointerCapture(dragState.pointerId)
  }
  dragState = null
  dragging.value = false
  if (!moved) selectCenter()
}

function onDoubleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (target.closest('.ball-node, .canvas-ui')) return
  resetView()
}

/* ---------------- 让选中的球留在视野里 ---------------- */

watch(
  () => state.selectedId,
  async () => {
    if (!state.selectedId) return
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    const target = screenBalls.value.find((item) => item.ball.id === state.selectedId)
    if (!target) return
    const leftLimit = 66
    const rightLimit = size.w - (state.inspectorOpen ? 392 : 76)
    const topLimit = 88
    const bottomLimit = size.h - 88
    let dx = 0
    let dy = 0
    if (target.x < leftLimit) dx = leftLimit - target.x
    if (target.x > rightLimit) dx = rightLimit - target.x
    if (target.y < topLimit) dy = topLimit - target.y
    if (target.y > bottomLimit) dy = bottomLimit - target.y
    if (dx || dy) {
      pan.x += dx
      pan.y += dy
    }
  },
)

watch(
  () => state.inspectorOpen,
  (open) => {
    if (!open) return
    if (!state.selectedId) return
    requestAnimationFrame(() => {
      const target = screenBalls.value.find((item) => item.ball.id === state.selectedId)
      if (!target) return
      const rightLimit = size.w - 392
      if (target.x > rightLimit) pan.x += rightLimit - target.x
    })
  },
)

watch(
  () => state.snapshot?.rootPath,
  () => {
    resetView()
  },
)

/* ---------------- 尺寸 ---------------- */

let observer: ResizeObserver | null = null

onMounted(() => {
  if (!hostRef.value) return
  observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (!rect) return
    size.w = rect.width
    size.h = rect.height
  })
  observer.observe(hostRef.value)
  size.w = hostRef.value.clientWidth
  size.h = hostRef.value.clientHeight
  window.addEventListener('skill-tree:reset-view', resetView)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  window.removeEventListener('skill-tree:reset-view', resetView)
})
</script>

<style scoped>
.canvas {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  cursor: grab;
  background:
    radial-gradient(ellipse 70% 60% at 52% 46%, var(--glass), transparent 72%),
    linear-gradient(180deg, transparent, var(--bg-2));
  touch-action: none;
}

.canvas.dragging {
  cursor: grabbing;
}

.stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: var(--star-opacity);
  background-image:
    radial-gradient(1px 1px at 22px 34px, rgba(255, 255, 255, 0.75), transparent 100%),
    radial-gradient(1px 1px at 140px 120px, rgba(255, 255, 255, 0.5), transparent 100%),
    radial-gradient(1.4px 1.4px at 260px 60px, rgba(255, 236, 200, 0.8), transparent 100%),
    radial-gradient(1px 1px at 80px 200px, rgba(255, 255, 255, 0.45), transparent 100%);
  background-size: 340px 280px, 340px 280px, 340px 280px, 340px 280px;
}

[data-theme="light"] .stars {
  background-image:
    radial-gradient(1px 1px at 22px 34px, rgba(120, 95, 50, 0.5), transparent 100%),
    radial-gradient(1px 1px at 140px 120px, rgba(120, 95, 50, 0.35), transparent 100%),
    radial-gradient(1.2px 1.2px at 260px 60px, rgba(150, 110, 40, 0.4), transparent 100%),
    radial-gradient(1px 1px at 80px 200px, rgba(120, 95, 50, 0.3), transparent 100%);
}

.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.18) 100%);
}

[data-theme="light"] .vignette {
  background: radial-gradient(ellipse 90% 85% at 50% 45%, transparent 60%, rgba(120, 95, 55, 0.07) 100%);
}

.aura {
  position: absolute;
  width: 520px;
  height: 520px;
  margin-left: -260px;
  margin-top: -260px;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(
    circle,
    rgba(255, 190, 92, 0.16) 0%,
    rgba(255, 175, 70, 0.05) 40%,
    transparent 68%
  );
  filter: blur(20px);
  transition: opacity 1.2s var(--ease);
}

[data-theme="light"] .aura {
  background: radial-gradient(circle, rgba(200, 140, 35, 0.1), transparent 66%);
}

.wires {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: rgba(var(--glow), 0.9);
}

.rings circle {
  stroke: currentColor;
  stroke-opacity: 0.075;
  stroke-dasharray: 2 8;
  stroke-width: 1;
}

.links line {
  stroke: currentColor;
  stroke-linecap: round;
  transition: stroke-opacity 0.3s var(--ease);
}

.canvas-title {
  position: absolute;
  left: 24px;
  top: 20px;
  pointer-events: none;
  z-index: 20;
}

.eyebrow {
  font-size: 10px;
  letter-spacing: 0.32em;
  color: var(--text-2);
  opacity: 0.65;
  text-transform: uppercase;
}

.tagline {
  margin-top: 5px;
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--text-2);
  opacity: 0.7;
}

.zoom-controls {
  position: absolute;
  right: 20px;
  top: 18px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(14px);
  z-index: 30;
  box-shadow: var(--shadow-soft);
}

.zoom-btn {
  width: 26px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--text-2);
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}

.zoom-btn:hover {
  background: var(--glass-strong);
  color: var(--text);
}

.zoom-value {
  min-width: 38px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-3);
}

.zoom-divider {
  width: 1px;
  height: 13px;
  margin: 0 3px;
  background: var(--line);
}

.center-card {
  position: absolute;
  left: 24px;
  bottom: 26px;
  width: 252px;
  padding: 15px 16px 14px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(22px) saturate(1.15);
  box-shadow: var(--shadow-soft);
  z-index: 30;
  cursor: pointer;
  transition: border-color 0.2s var(--ease), background 0.2s var(--ease), transform 0.2s var(--ease);
}

.center-card:hover {
  border-color: var(--line-strong);
  transform: translateY(-1px);
}

.center-card.active {
  border-color: rgba(var(--glow), 0.32);
  background: linear-gradient(180deg, var(--gold-soft), var(--panel));
}

.cc-head {
  display: flex;
  align-items: center;
  gap: 7px;
}

.cc-orb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 28%, rgba(255, 255, 255, 0.9), transparent 55%),
    hsl(41 80% calc(62% + 22% * (1 - var(--b))));
  box-shadow: 0 0 calc(4px + 12px * var(--b)) rgba(255, 196, 104, 0.35);
  flex: none;
}

.cc-name {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--text-2);
}

.cc-tag {
  margin-left: auto;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: var(--gold);
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--gold-soft);
}

.cc-main {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 9px;
}

.cc-value {
  font-family: var(--font-mono);
  font-size: 30px;
  line-height: 1;
  font-weight: 300;
  color: var(--gold);
  letter-spacing: -0.02em;
  text-shadow: 0 0 26px rgba(var(--glow), 0.25);
}

.cc-unit {
  font-size: 10.5px;
  color: var(--text-3);
  letter-spacing: 0.1em;
}

.cc-meta {
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-2);
}

.cc-last {
  margin-top: 3px;
  font-size: 10.5px;
  color: var(--text-3);
}

.cc-note {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
  font-size: 10.5px;
  line-height: 1.65;
  color: var(--text-3);
  font-family: var(--font-display);
  letter-spacing: 0.02em;
}

.cc-cta {
  margin-top: 11px;
  width: 100%;
}

.cc-add {
  margin-top: 9px;
  height: 25px;
  padding: 0 8px;
  color: var(--text-3);
}

.cc-add:hover {
  color: var(--gold);
}

.canvas-hint {
  position: absolute;
  right: 22px;
  bottom: 22px;
  font-size: 10px;
  letter-spacing: 0.05em;
  color: var(--text-3);
  opacity: 0.65;
  pointer-events: none;
  z-index: 20;
}

.empty-invite {
  display: none;
}

@media (max-width: 900px) {
  .center-card {
    width: 226px;
    left: 16px;
    bottom: 18px;
  }

  .canvas-title {
    left: 18px;
    top: 16px;
  }

  .cc-note {
    display: none;
  }
}

@media (max-height: 620px) {
  .cc-note,
  .cc-last {
    display: none;
  }
}
</style>
