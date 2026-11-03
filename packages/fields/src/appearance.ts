import type { ResolvedAppearancePayload } from './bridge/types'

const RULE_SELECTOR_MAP: Record<string, string> = {
  '.Input': '.nexus-input',
  '.Input:hover': '.nexus-input:hover',
  '.Input--focus': '.nexus--focused .nexus-input, .nexus-input:focus',
  '.Input--error': '.nexus--invalid .nexus-input',
  '.Input--disabled': '.nexus--disabled .nexus-input',
  '.Label': '.nexus-label',
  '.Error': '.nexus-error',
  '.Tab': '.nexus-tab',
  '.Tab:hover': '.nexus-tab:hover',
  '.Tab--selected': '.nexus-tab--selected',
  '.Block': '.nexus-block',
  '.AccordionItem': '.nexus-accordion-item',
  '.Radio': '.nexus-radio',
  '.Checkbox': '.nexus-checkbox',
  '.CheckboxInput': '.nexus-checkbox-input',
  '.CheckboxInput--checked': '.nexus-checkbox-input--checked',
  '.CheckboxInput:focus': '.nexus-checkbox-input:focus',
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

const RADIUS_TARGETS = '.nexus-card-element, .nexus-field, .nexus-payment-element, .nexus-express-checkout'

function paintBorderRadius(radius: string | undefined): void {
  if (!radius) return
  const apply = () => {
    document.querySelectorAll<HTMLElement>(RADIUS_TARGETS).forEach((el) => {
      el.style.borderRadius = radius
    })
  }
  apply()
  requestAnimationFrame(apply)
}

export function applyAppearance(appearance: ResolvedAppearancePayload): void {
  const root = document.documentElement
  for (const [cssVar, value] of Object.entries(appearance.variables)) {
    root.style.setProperty(cssVar, value)
  }
  paintBorderRadius(appearance.variables['--nexus-border-radius'])
  if (appearance.variables['--nexus-outline']) {
    root.style.setProperty('--nexus-outline', appearance.variables['--nexus-outline'])
  }
  if (appearance.variables['--nexus-z-index']) {
    root.style.setProperty('--nexus-z-index', appearance.variables['--nexus-z-index'])
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

interface FontDefinition {
  family: string
  src: string
  weight?: string
  style?: string
}

const FONT_STYLE_TAG_ID = 'nexus-fonts'

export function applyFonts(fonts: FontDefinition[] | undefined): void {
  let styleTag = document.getElementById(FONT_STYLE_TAG_ID) as HTMLStyleElement | null
  if (!fonts || fonts.length === 0) {
    styleTag?.remove()
    return
  }

  let css = ''
  for (const font of fonts) {
    const weight = font.weight ?? '400'
    const style = font.style ?? 'normal'
    css += `@font-face { font-family: '${font.family}'; src: url('${font.src}'); font-weight: ${weight}; font-style: ${style}; font-display: swap; }\n`
  }

  if (!styleTag) {
    styleTag = document.createElement('style')
    styleTag.id = FONT_STYLE_TAG_ID
    document.head.appendChild(styleTag)
  }
  styleTag.textContent = css

  if (fonts.length > 0) {
    const primary = fonts[0]!
    document.documentElement.style.setProperty('--nexus-font-family', `'${primary.family}', sans-serif`)
  }
}
