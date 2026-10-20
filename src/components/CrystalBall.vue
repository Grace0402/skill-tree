<template>
  <div
    class="ball-node"
    :class="{
      center: ball.isCenter,
      selected,
      dimmed,
      lit: ball.lit,
      invite: ball.isCenter && empty,
    }"
    :style="style"
    @click="select"
  >
    <div class="halo" />
    <div v-if="ball.isCenter" class="orbit orbit-outer" />
    <div v-if="ball.isCenter" class="orbit orbit-inner" />
    <div v-if="selected" class="focus-ring" />

    <div
      class="ball"
      role="button"
      tabindex="0"
      :aria-label="`${ball.isCenter ? '我，你自己' : ball.name}，亮度 ${formatBrightness(ball.brightness)}`"
      @keydown.enter.prevent="select"
      @keydown.space.prevent="select"
    >
      <span class="shine" />
      <span class="core" />
      <span class="rim" />
      <span v-if="ball.lit" class="lit-star" :title="'已点亮'">
        <Icon name="star" :size="starSize" />
      </span>
      <span class="tip" />
    </div>

    <div class="label" :class="{ 'label-center': ball.isCenter }">
      <template v-if="ball.isCenter">
        <span class="name">我</span>
        <span class="sub">你自己</span>
        <span class="value">{{ formatBrightness(ball.brightness) }}</span>
        <span v-if="empty" class="invite-inline">点我，长出第一根枝</span>
      </template>
      <template v-else>
        <span class="name">{{ ball.name }}</span>
        <span class="value">{{ formatBrightness(ball.brightness) }}</span>
      </template>
    </div>

    <button
      class="add-child"
      type="button"
      :title="ball.isCenter ? '长出一根新枝' : `在「${ball.name}」下长出新枝`"
      @click.stop="add"
    >
      <Icon name="plus" :size="11" :stroke="2.2" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import type { LayoutBall } from '../lib/layout'
import { formatBrightness } from '../lib/format'

const props = defineProps<{
  ball: LayoutBall
  x: number
  y: number
  size: number
  labelSize: number
  selected: boolean
  dimmed: boolean
  empty: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  add: [id: string]
}>()

const level = computed(() => Math.min(1, props.ball.brightness / 100))
const softLevel = computed(() => Math.pow(level.value, 0.65))
const starSize = computed(() => Math.max(8, Math.min(15, props.size * 0.17)))

const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  '--size': `${props.size}px`,
  '--b': level.value.toFixed(4),
  '--bl': softLevel.value.toFixed(4),
  '--label-size': `${props.labelSize}px`,
  zIndex: props.selected ? 30 : Math.max(2, 20 - props.ball.depth),
}))

function select(): void {
  emit('select', props.ball.id)
}

function add(): void {
  emit('add', props.ball.id)
}
</script>

<style scoped>
.ball-node {
  position: absolute;
  width: 0;
  height: 0;
  transition: opacity 0.35s var(--ease), filter 0.35s var(--ease);
}

.ball-node.dimmed {
  opacity: 0.24;
  filter: saturate(0.35);
}

.ball {
  position: absolute;
  left: calc(var(--size) / -2);
  top: calc(var(--size) / -2);
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  cursor: pointer;
  outline: none;
  transition: transform 0.24s var(--ease-out), box-shadow 0.3s var(--ease);
  overflow: visible;
}

.ball-node:hover .ball,
.ball:focus-visible {
  transform: scale(1.035);
}

.ball:focus-visible {
  outline: 1px solid rgba(var(--glow), 0.7);
  outline-offset: 5px;
}

/* ---------- 深色：从暗里亮起来的光晕 ---------- */

.halo {
  position: absolute;
  left: calc(var(--size) / -2 - var(--size) * 0.45);
  top: calc(var(--size) / -2 - var(--size) * 0.45);
  width: calc(var(--size) * 1.9);
  height: calc(var(--size) * 1.9);
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(
    circle,
    rgba(255, 190, 96, calc(0.05 + 0.44 * var(--b))) 0%,
    rgba(255, 176, 74, calc(0.02 + 0.18 * var(--b))) 42%,
    transparent 72%
  );
  filter: blur(12px);
  opacity: calc(0.4 + 0.6 * var(--b));
  transition: opacity 0.4s var(--ease);
}

[data-theme="light"] .halo {
  display: none;
}

[data-theme="dark"] .ball {
  background:
    radial-gradient(
      circle at 31% 24%,
      rgba(255, 255, 255, 0.4) 0%,
      rgba(255, 255, 255, 0.05) 24%,
      transparent 45%
    ),
    radial-gradient(
      circle at 68% 82%,
      rgba(255, 206, 130, calc(0.05 + 0.56 * var(--b))) 0%,
      transparent 57%
    ),
    radial-gradient(
      circle at 50% 52%,
      rgba(255, 234, 196, calc(0.02 + 0.36 * var(--b))) 0%,
      rgba(26, 30, 47, 0.5) 68%,
      rgba(12, 15, 26, 0.8) 100%
    );
  border: 1px solid rgba(255, 255, 255, 0.17);
  box-shadow:
    0 0 calc(9px + 52px * var(--b)) rgba(255, 194, 100, calc(0.07 + 0.46 * var(--b))),
    inset 0 1px 1px rgba(255, 255, 255, 0.38),
    inset 0 -12px 26px rgba(0, 0, 0, 0.28),
    inset 0 0 28px rgba(255, 214, 150, calc(0.06 + 0.26 * var(--b)));
  backdrop-filter: blur(7px) saturate(1.25);
}

/* ---------- 浅色：实心色阶，不发光 ---------- */

[data-theme="light"] .ball {
  background:
    radial-gradient(
      circle at 30% 23%,
      rgba(255, 255, 255, 0.9) 0%,
      rgba(255, 255, 255, 0.22) 20%,
      transparent 38%
    ),
    radial-gradient(
      circle at 65% 82%,
      hsla(36, 95%, 50%, calc(0.04 + 0.4 * var(--bl))) 0%,
      transparent 56%
    ),
    radial-gradient(
      circle at 50% 55%,
      hsl(41 calc(6% + 76% * var(--bl)) calc(90% - 34% * var(--bl))) 0%,
      hsl(40 calc(8% + 66% * var(--bl)) calc(94% - 24% * var(--bl))) 62%,
      hsl(38 calc(10% + 56% * var(--bl)) calc(88% - 15% * var(--bl))) 100%
    );
  border: 1px solid rgba(120, 82, 22, calc(0.16 + 0.3 * var(--bl)));
  box-shadow:
    0 10px 22px rgba(110, 75, 20, calc(0.1 + 0.18 * var(--bl))),
    inset 0 1px 2px rgba(255, 255, 255, 0.92),
    inset 0 -10px 18px rgba(150, 95, 25, calc(0.05 + 0.16 * var(--bl)));
}

/* ---------- 玻璃细节 ---------- */

.shine {
  position: absolute;
  left: 23%;
  top: 14%;
  width: 27%;
  height: 19%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, calc(0.45 + 0.3 * var(--b))) 0%,
    rgba(255, 255, 255, 0.05) 55%,
    transparent 72%
  );
  filter: blur(1.5px);
  transform: rotate(-22deg);
  pointer-events: none;
}

[data-theme="light"] .shine {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.95), transparent 68%);
}

.core {
  position: absolute;
  inset: 24%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 216, 148, calc(0.04 + 0.46 * var(--b))) 0%,
    transparent 68%
  );
  filter: blur(5px);
  pointer-events: none;
}

[data-theme="light"] .core {
  background: radial-gradient(
    circle,
    rgba(255, 236, 190, calc(0.25 + 0.4 * var(--b))) 0%,
    transparent 70%
  );
  filter: blur(7px);
}

.rim {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow:
    inset -2px -3px 9px rgba(255, 205, 140, 0.16),
    inset 2px 3px 7px rgba(255, 255, 255, 0.18);
  pointer-events: none;
}

[data-theme="light"] .rim {
  box-shadow:
    inset -2px -3px 8px rgba(160, 115, 40, 0.14),
    inset 2px 3px 6px rgba(255, 255, 255, 0.75);
}

.tip {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
}

.lit-star {
  position: absolute;
  right: 12%;
  top: 9%;
  color: #ffe2a6;
  filter: drop-shadow(0 0 6px rgba(255, 190, 90, 0.9));
  animation: star-twinkle 3.8s ease-in-out infinite;
  pointer-events: none;
  z-index: 2;
}

[data-theme="light"] .lit-star {
  color: #a96e10;
  filter: drop-shadow(0 1px 2px rgba(160, 105, 20, 0.35));
}

/* ---------- 中心球：你自己 ---------- */

.ball-node.center .ball {
  border-width: 1px;
}

[data-theme="dark"] .ball-node.center .ball {
  box-shadow:
    0 0 calc(14px + 50px * var(--b)) rgba(255, 194, 100, calc(0.08 + 0.36 * var(--b))),
    inset 0 1px 1px rgba(255, 255, 255, 0.42),
    inset 0 -14px 30px rgba(0, 0, 0, 0.3),
    inset 0 0 36px rgba(255, 214, 150, calc(0.08 + 0.22 * var(--b))),
    inset 0 0 0 1px rgba(255, 226, 170, 0.1);
}

[data-theme="light"] .ball-node.center .ball {
  box-shadow:
    0 12px 26px rgba(120, 88, 40, calc(0.12 + 0.16 * var(--b))),
    inset 0 1px 2px rgba(255, 255, 255, 0.95),
    inset 0 -12px 22px rgba(150, 108, 40, calc(0.06 + 0.12 * var(--b))),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5);
}

.orbit {
  position: absolute;
  border-radius: 50%;
  border: 1px dashed rgba(var(--glow), 0.16);
  pointer-events: none;
  animation: spin-slow 140s linear infinite;
}

.orbit-outer {
  left: calc(var(--size) / -2 - var(--size) * 0.34);
  top: calc(var(--size) / -2 - var(--size) * 0.34);
  width: calc(var(--size) * 1.68);
  height: calc(var(--size) * 1.68);
}

.orbit-inner {
  left: calc(var(--size) / -2 - var(--size) * 0.13);
  top: calc(var(--size) / -2 - var(--size) * 0.13);
  width: calc(var(--size) * 1.26);
  height: calc(var(--size) * 1.26);
  border-style: solid;
  border-color: rgba(var(--glow), 0.08);
  animation-direction: reverse;
  animation-duration: 90s;
}

.ball-node.invite .halo {
  animation: breathe 5s ease-in-out infinite;
}

.focus-ring {
  position: absolute;
  left: calc(var(--size) / -2 - 8px);
  top: calc(var(--size) / -2 - 8px);
  width: calc(var(--size) + 16px);
  height: calc(var(--size) + 16px);
  border-radius: 50%;
  border: 1px solid rgba(var(--glow), 0.45);
  box-shadow: 0 0 22px rgba(var(--glow), 0.1);
  pointer-events: none;
}

/* ---------- 标签 ---------- */

.label {
  position: absolute;
  top: calc(var(--size) / 2 + 9px);
  left: 0;
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 6px;
  max-width: 190px;
  white-space: nowrap;
  pointer-events: none;
}

.label .name {
  font-family: var(--font-display);
  font-size: var(--label-size);
  letter-spacing: 0.04em;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 156px;
  text-shadow:
    0 1px 6px var(--bg),
    0 0 16px var(--bg);
}

.label .value {
  font-family: var(--font-mono);
  font-size: calc(var(--label-size) * 0.76);
  color: var(--text-2);
  opacity: 0.75;
  text-shadow: 0 1px 5px var(--bg);
}

.label-center {
  top: calc(var(--size) / 2 + 13px);
  flex-wrap: wrap;
  justify-content: center;
  max-width: 240px;
}

.label-center .name {
  font-size: calc(var(--label-size) * 1.18);
  color: var(--gold-strong);
  letter-spacing: 0.16em;
}

.label-center .sub {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--text-3);
}

.label-center .value {
  font-size: calc(var(--label-size) * 0.78);
  color: var(--gold);
}

.ball-node.selected .label .name {
  color: var(--gold-strong);
}

.ball-node.selected .label .value {
  color: var(--gold);
}

.invite-inline {
  flex-basis: 100%;
  margin-top: 5px;
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: var(--gold);
  text-align: center;
  opacity: 0.85;
  animation: breathe 4.5s ease-in-out infinite;
}

/* ---------- 加子节点按钮 ---------- */

.add-child {
  position: absolute;
  left: calc(var(--size) * 0.34);
  top: calc(var(--size) * -0.34);
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid rgba(var(--glow), 0.36);
  background: var(--panel-strong);
  color: var(--gold);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
  transform: translate(-50%, -50%) scale(0.8);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s var(--ease), transform 0.16s var(--ease), background 0.16s var(--ease);
  z-index: 4;
}

.ball-node:hover .add-child,
.ball-node.selected .add-child,
.add-child:focus-visible {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, -50%) scale(1);
}

.add-child:hover {
  background: var(--gold);
  color: #241706;
  border-color: transparent;
}
</style>
