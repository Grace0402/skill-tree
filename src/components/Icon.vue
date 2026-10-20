<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    class="icon"
  >
    <g v-html="markup" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type IconName =
  | 'chevronRight'
  | 'chevronDown'
  | 'chevronLeft'
  | 'plus'
  | 'minus'
  | 'close'
  | 'square'
  | 'restore'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'settings'
  | 'star'
  | 'spark'
  | 'folder'
  | 'external'
  | 'refresh'
  | 'archive'
  | 'restoreArchive'
  | 'trash'
  | 'edit'
  | 'copy'
  | 'check'
  | 'clock'
  | 'panelLeft'
  | 'expand'
  | 'collapse'
  | 'search'
  | 'sapling'
  | 'tree'
  | 'sparkles'
  | 'info'
  | 'dot'

const props = withDefaults(
  defineProps<{
    name: IconName
    size?: number
    stroke?: number
  }>(),
  { size: 16, stroke: 1.7 },
)

const icons: Record<IconName, string> = {
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  square: '<path d="M5.5 5.5h13v13h-13z"/>',
  restore: '<path d="M8.5 8.5h10v10h-10z"/><path d="M5.5 15.5v-10h10"/>',
  sun: '<path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"/>',
  moon: '<path d="M20.6 14.3A8.6 8.6 0 0 1 9.7 3.4a8.6 8.6 0 1 0 10.9 10.9Z"/>',
  monitor: '<path d="M3 4.5h18v11H3z"/><path d="M8.5 20h7M12 15.5V20"/>',
  settings:
    '<path d="M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  star: '<path d="M12 2.8l2.5 6.1 6.6.5-5 4.3 1.5 6.5-5.6-3.4-5.6 3.4 1.5-6.5-5-4.3 6.6-.5Z" fill="currentColor" stroke="none"/>',
  spark:
    '<path d="M12 3v4M12 17v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M3 12h4M17 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
  folder:
    '<path d="M3 7.5A2 2 0 0 1 5 5.5h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  external:
    '<path d="M14 4h6v6M20 4l-8 8M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h4.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4"/>',
  archive:
    '<path d="M3.5 7 5 4h14l1.5 3M4.5 7h15v12.5h-15z"/><path d="M9.5 11.5h5"/>',
  restoreArchive: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/>',
  trash:
    '<path d="M4 7h16M10 4h4l1 3H9zM6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16zM14 6l4 4"/>',
  copy: '<path d="M9 9h10.5v11H9z"/><path d="M5 15V4.5h10v2"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 6.5"/>',
  clock: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"/><path d="M12 7.5V12l3 2"/>',
  panelLeft: '<path d="M4 4h16v16H4zM9.5 4v16"/>',
  expand: '<path d="M9 4H4v5M15 20h5v-5M4 9l5-5M20 15l-5 5"/>',
  collapse: '<path d="M4 4h16v16H4zM9 9l6 6M15 9l-6 6"/>',
  search: '<path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"/><path d="M20 20l-4-4"/>',
  sapling:
    '<path d="M12 21v-7.5"/><path d="M12 14.5C7.5 14.5 4.5 12 4.5 7.8c4.4 0 7.5 2.4 7.5 6.7Z"/><path d="M12 11.5c0-4 2.7-6.9 7-6.9 0 4.4-2.8 6.9-7 6.9Z"/>',
  tree: '<path d="M12 3v18M12 8l-4-3M12 13l4-3M12 18l-5-3.5"/>',
  sparkles:
    '<path d="M12 3l1.7 4.5L18 9l-4.3 1.5L12 15l-1.7-4.5L6 9l4.3-1.5Z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/><path d="M5.5 3.5l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4L3.6 5.4l1.4-.5Z"/>',
  info: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"/><path d="M12 11v5M12 7.8v.4"/>',
  dot: '<path d="M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" fill="currentColor" stroke="none"/>',
}

const markup = computed(() => icons[props.name] ?? '')
</script>

<style scoped>
.icon {
  display: block;
  flex: none;
  overflow: visible;
}
</style>
