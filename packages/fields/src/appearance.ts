import type { ResolvedAppearancePayload } from './bridge/types'

const RULE_SELECTOR_MAP: Record<string, string> = {
  '.Input': '.nexus-input',
  '.Input--focus': '.nexus--focused .nexus-input, .nexus-input:focus',
  '.Input--error': '.nexus--invalid .nexus-input',
  '.Label': '.nexus-label',
  '.Error': '.nexus-error',
  '.Tab': '.nexus-tab',
  '.Tab--selected': '.nexus-tab--selected',
  '.Block': '.nexus-block',
  '.Radio': '.nexus-radio',
  '.Icon': '.nexus-brand-icon',
}

const STYLE_TAG_ID = 'nexus-appearance-rules'

function toKebabCase(property: string): string {
  return property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

function buildRuleCss(rules: Record<string, Record<string, string>>): string {
  let css = ''
  for (const [selector, declarations] of Object.entries(rules)) {
    const mapped = RULE_SELECTOR_MAP[selector] ?? selector
    const body = Object.entries(declarations)
      .map(([property, value]) => `  ${toKebabCase(property)}: ${value};`)
      .join('\n')
    css += `${mapped} {\n${body}\n}\n`
  }
  return css
}

export function applyAppearance(appearance: ResolvedAppearancePayload): void {
  const root = document.documentElement
  for (const [cssVar, value] of Object.entries(appearance.variables)) {
    root.style.setProperty(cssVar, value)
  }

  const css = buildRuleCss(appearance.rules)
  let styleTag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
  if (!styleTag) {
    styleTag = document.createElement('style')
    styleTag.id = STYLE_TAG_ID
    document.head.appendChild(styleTag)
  }
  styleTag.textContent = css
}
