<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite">
      <TransitionGroup name="toast">
        <button
          v-for="item in state.toasts"
          :key="item.id"
          type="button"
          class="toast"
          :class="[item.kind]"
          @click="dismissToast(item.id)"
        >
          <span class="toast-mark">
            <Icon
              :name="item.kind === 'error' ? 'info' : item.kind === 'success' ? 'check' : 'dot'"
              :size="11"
              :stroke="2"
            />
          </span>
          <span class="toast-text">{{ item.text }}</span>
        </button>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Icon from './Icon.vue'
import { state, treeStore } from '../stores/tree'

const { dismissToast } = treeStore
</script>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(560px, 80vw);
  padding: 8px 14px 8px 9px;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: var(--panel-strong);
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow-soft);
  color: var(--text);
  font-size: 12px;
  pointer-events: auto;
  cursor: pointer;
}

.toast-mark {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  flex: none;
  background: var(--glass-strong);
  color: var(--text-2);
}

.toast.success .toast-mark {
  color: var(--gold-strong);
  background: var(--gold-soft);
}

.toast.error .toast-mark {
  color: var(--danger);
  background: var(--danger-soft);
}

.toast.info .toast-mark {
  color: var(--gold);
}

.toast-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.22s var(--ease), transform 0.24s var(--ease-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

.toast-move {
  transition: transform 0.22s var(--ease);
}
</style>
