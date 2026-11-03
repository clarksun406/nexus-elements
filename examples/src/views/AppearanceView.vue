<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { NexusElements, NexusCardElement } from '@nexus-elements/vue'
import type {
  Appearance,
  AppearanceVariables,
  ElementStyle,
  NexusElement as NexusElementInstance,
  SupportedLocale,
} from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const THEMES: NonNullable<Appearance['theme']>[] = ['stripe', 'flat', 'night', 'none']
const theme = ref<NonNullable<Appearance['theme']>>('stripe')

const LOCALES: SupportedLocale[] = ['zh', 'en', 'ja', 'ko', 'de', 'fr', 'es', 'ar']
const locale = ref<SupportedLocale>('zh')

const customVars = reactive<Partial<AppearanceVariables>>({
  colorPrimary: '#635bff',
  colorBackground: '#ffffff',
  colorText: '#32325d',
  colorDanger: '#fa755a',
  borderRadius: '4px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSizeBase: '14px',
})

const useCustomVars = ref(false)

const rulePresets = reactive<Record<string, boolean>>({
  '.Input': false,
  '.Input:hover': false,
  '.Input--disabled': false,
  '.Label': false,
  '.Tab': false,
  '.Tab:hover': false,
  '.Tab--selected': false,
  '.Block': false,
})

const customRules = computed(() => {
  const rules: Record<string, Record<string, string>> = {}
  if (rulePresets['.Input']) {
    rules['.Input'] = { backgroundColor: '#f6f9fc', border: '1px solid #e0e6ed' }
  }
  if (rulePresets['.Input:hover']) {
    rules['.Input:hover'] = { border: '1px solid #635bff' }
  }
  if (rulePresets['.Input--disabled']) {
    rules['.Input--disabled'] = { backgroundColor: '#f0f0f0', cursor: 'not-allowed' }
  }
  if (rulePresets['.Label']) {
    rules['.Label'] = { fontWeight: '600', color: '#1a1a2e' }
  }
  if (rulePresets['.Tab']) {
    rules['.Tab'] = { borderRadius: '8px', border: '1px solid #e0e6ed' }
  }
  if (rulePresets['.Tab:hover']) {
    rules['.Tab:hover'] = { backgroundColor: '#f6f9fc' }
  }
  if (rulePresets['.Tab--selected']) {
    rules['.Tab--selected'] = { backgroundColor: '#635bff', color: '#ffffff' }
  }
  if (rulePresets['.Block']) {
    rules['.Block'] = { padding: '16px', border: '1px solid #e0e6ed', borderRadius: '8px' }
  }
  return rules
})

const FONT_PRESETS = [
  { label: 'System Default', family: '' },
  { label: 'Inter', family: 'Inter, sans-serif', src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2' },
  { label: 'Roboto Mono', family: '"Roboto Mono", monospace', src: 'https://fonts.gstatic.com/s/robotomono/v23/L0xuDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_3vq_ROW4.woff2' },
]
const fontIndex = ref(0)

const fonts = computed(() => {
  const preset = FONT_PRESETS[fontIndex.value]
  if (!preset?.src) return undefined
  const family = preset.family.split(',')[0]?.replace(/"/g, '') ?? preset.family
  return [{ family, src: `url("${preset.src}") format("woff2")` }]
})

const elementStyle = reactive<ElementStyle>({
  base: { color: '#32325d', fontSize: '14px' },
  focus: { color: '#1a1a2e' },
  invalid: { color: '#fa755a' },
})
const useElementStyle = ref(false)

const appearance = computed<Appearance>(() => {
  const vars = useCustomVars.value ? { ...customVars } : undefined
  const rules = Object.keys(customRules.value).length > 0 ? customRules.value : undefined
  return { theme: theme.value, variables: vars, rules }
})

const elementsOptions = computed(() => ({
  appearance: appearance.value,
  locale: locale.value,
  fonts: fonts.value,
}))

const cardOptions = computed(() => {
  const opts: Record<string, unknown> = { showIcon: true }
  if (useElementStyle.value) {
    opts.style = { ...elementStyle }
  }
  return opts
})

const cardElementRef = ref<{ getElement: () => NexusElementInstance | undefined } | null>(null)

const eventLog = ref<{ type: string; time: string; data?: string }[]>([])

function logEvent(type: string, data?: unknown) {
  const time = new Date().toLocaleTimeString()
  const entry = { type, time, data: data ? JSON.stringify(data).slice(0, 80) : undefined }
  eventLog.value.unshift(entry)
  if (eventLog.value.length > 20) eventLog.value.pop()
}

function onFocus() { logEvent('focus') }
function onBlur() { logEvent('blur') }
function onError(event: unknown) { logEvent('error', event) }
function onEscape() { logEvent('escape') }
function onClick() { logEvent('click') }

function handleFocus() { cardElementRef.value?.getElement()?.focus() }
function handleBlur() { cardElementRef.value?.getElement()?.blur() }
function handleClear() { cardElementRef.value?.getElement()?.clear() }

function onChange(event: unknown) {
  const e = event as { complete?: boolean; empty?: boolean; brand?: string }
  logEvent('change', { complete: e.complete, empty: e.empty, brand: e.brand })
}

function clearLog() { eventLog.value = [] }
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" :options="elementsOptions" fields-url="/fields/index.html">
    <div class="playground">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>Appearance Playground</h1>
      <p class="subtitle">主题 / 变量 / 规则 / 字体 / 语言 / 元素样式 / API 方法 全面演示</p>

      <div class="playground-grid">
        <div class="controls-panel">
          <section class="control-section">
            <h3>Theme</h3>
            <div class="chip-group">
              <button
                v-for="t in THEMES"
                :key="t"
                class="chip"
                :class="{ 'chip--active': theme === t }"
                @click="theme = t"
              >{{ t }}</button>
            </div>
          </section>

          <section class="control-section">
            <h3>Locale</h3>
            <div class="chip-group">
              <button
                v-for="l in LOCALES"
                :key="l"
                class="chip"
                :class="{ 'chip--active': locale === l }"
                @click="locale = l"
              >{{ l }}</button>
            </div>
          </section>

          <section class="control-section">
            <h3>Font</h3>
            <div class="chip-group">
              <button
                v-for="(f, i) in FONT_PRESETS"
                :key="f.label"
                class="chip"
                :class="{ 'chip--active': fontIndex === i }"
                @click="fontIndex = i"
              >{{ f.label }}</button>
            </div>
          </section>

          <section class="control-section">
            <h3>
              <label class="toggle-label">
                <input v-model="useCustomVars" type="checkbox" />
                Custom Variables
              </label>
            </h3>
            <div v-if="useCustomVars" class="var-grid">
              <label class="var-item">
                <span>colorPrimary</span>
                <input v-model="customVars.colorPrimary" type="color" class="color-input" />
              </label>
              <label class="var-item">
                <span>colorBackground</span>
                <input v-model="customVars.colorBackground" type="color" class="color-input" />
              </label>
              <label class="var-item">
                <span>colorText</span>
                <input v-model="customVars.colorText" type="color" class="color-input" />
              </label>
              <label class="var-item">
                <span>colorDanger</span>
                <input v-model="customVars.colorDanger" type="color" class="color-input" />
              </label>
              <label class="var-item">
                <span>borderRadius</span>
                <select v-model="customVars.borderRadius" class="select-input">
                  <option value="0px">0px</option>
                  <option value="4px">4px</option>
                  <option value="8px">8px</option>
                  <option value="12px">12px</option>
                  <option value="16px">16px</option>
                </select>
              </label>
              <label class="var-item">
                <span>fontSizeBase</span>
                <select v-model="customVars.fontSizeBase" class="select-input">
                  <option value="12px">12px</option>
                  <option value="14px">14px</option>
                  <option value="16px">16px</option>
                  <option value="18px">18px</option>
                </select>
              </label>
            </div>
          </section>

          <section class="control-section">
            <h3>Rules Override</h3>
            <div class="rules-list">
              <label v-for="(_val, key) in rulePresets" :key="key" class="rule-item">
                <input v-model="rulePresets[key]" type="checkbox" />
                <code>{{ key }}</code>
              </label>
            </div>
          </section>

          <section class="control-section">
            <h3>
              <label class="toggle-label">
                <input v-model="useElementStyle" type="checkbox" />
                Element Style (per-element)
              </label>
            </h3>
            <div v-if="useElementStyle" class="var-grid">
              <label class="var-item">
                <span>base.color</span>
                <input v-model="elementStyle.base!.color" type="color" class="color-input" />
              </label>
              <label class="var-item">
                <span>focus.color</span>
                <input v-model="elementStyle.focus!.color" type="color" class="color-input" />
              </label>
              <label class="var-item">
                <span>invalid.color</span>
                <input v-model="elementStyle.invalid!.color" type="color" class="color-input" />
              </label>
            </div>
          </section>

          <section class="control-section">
            <h3>Element Methods</h3>
            <div class="method-btns">
              <button class="method-btn" data-method="focus" @click="handleFocus">focus()</button>
              <button class="method-btn" data-method="blur" @click="handleBlur">blur()</button>
              <button class="method-btn" data-method="clear" @click="handleClear">clear()</button>
            </div>
          </section>
        </div>

        <div class="preview-panel">
          <div class="preview-card">
            <div class="field-group">
              <label class="field-label">Card Element</label>
              <NexusCardElement
                ref="cardElementRef"
                :options="cardOptions"
                @change="onChange"
                @focus="onFocus"
                @blur="onBlur"
                @error="onError"
                @escape="onEscape"
                @click="onClick"
              />
            </div>
          </div>

          <div class="event-log">
            <div class="event-log-header">
              <h3>Event Log</h3>
              <button class="clear-btn" @click="clearLog">Clear</button>
            </div>
            <div class="event-log-body">
              <div v-if="eventLog.length === 0" class="event-empty">No events yet — interact with the card element</div>
              <div v-for="(entry, i) in eventLog" :key="i" class="event-entry">
                <span class="event-time">{{ entry.time }}</span>
                <span class="event-type" :class="`event-type--${entry.type}`">{{ entry.type }}</span>
                <span v-if="entry.data" class="event-data">{{ entry.data }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.playground {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  padding: 40px;
  width: 100%;
  max-width: 960px;
}

.playground h1 {
  font-size: 22px;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.playground .subtitle {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 28px;
}

.playground-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 32px;
}

.control-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.control-section:last-child {
  border-bottom: none;
}

.control-section h3 {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10px;
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  text-transform: capitalize;
  transition: all 0.15s ease;
}

.chip:hover {
  border-color: #635bff;
  color: #635bff;
}

.chip--active {
  background: #635bff;
  border-color: #635bff;
  color: #fff;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.toggle-label input[type="checkbox"] {
  accent-color: #635bff;
}

.var-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.var-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.var-item span {
  font-size: 11px;
  color: #6b7280;
  font-family: monospace;
}

.color-input {
  width: 100%;
  height: 28px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 2px;
  cursor: pointer;
}

.select-input {
  height: 28px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 12px;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
}

.rule-item input {
  accent-color: #635bff;
}

.rule-item code {
  font-size: 11px;
  color: #635bff;
  background: #f0f0ff;
  padding: 1px 6px;
  border-radius: 3px;
}

.method-btns {
  display: flex;
  gap: 8px;
}

.method-btn {
  flex: 1;
  padding: 8px;
  font-size: 12px;
  font-family: monospace;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f9fafb;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
}

.method-btn:hover {
  border-color: #635bff;
  color: #635bff;
  background: #f0f0ff;
}

.preview-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
}

.event-log {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.event-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.event-log-header h3 {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.clear-btn {
  font-size: 11px;
  color: #6b7280;
  background: none;
  border: none;
  cursor: pointer;
}

.clear-btn:hover {
  color: #635bff;
}

.event-log-body {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px 12px;
}

.event-empty {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  padding: 16px;
}

.event-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 11px;
  border-bottom: 1px solid #f5f5f5;
}

.event-time {
  color: #9ca3af;
  font-family: monospace;
  min-width: 70px;
}

.event-type {
  font-weight: 600;
  font-family: monospace;
  padding: 1px 6px;
  border-radius: 3px;
  min-width: 56px;
  text-align: center;
}

.event-type--change { background: #eff6ff; color: #1d4ed8; }
.event-type--focus { background: #ecfdf5; color: #059669; }
.event-type--blur { background: #fef3c7; color: #d97706; }
.event-type--error { background: #fef2f2; color: #dc2626; }
.event-type--escape { background: #f5f3ff; color: #7c3aed; }
.event-type--click { background: #f0f0ff; color: #635bff; }

.event-data {
  color: #6b7280;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .playground-grid {
    grid-template-columns: 1fr;
  }
}
</style>
