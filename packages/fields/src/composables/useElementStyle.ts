import { watch, type Ref } from 'vue'

export interface ElementStyleState {
  color?: string
  backgroundColor?: string
  fontFamily?: string
  fontSize?: string
  fontWeight?: string
  fontStyle?: string
  fontVariant?: string
  lineHeight?: string | number
  letterSpacing?: string
  textAlign?: string
  textDecoration?: string
  textShadow?: string
  textTransform?: string
  placeholderColor?: string
  iconColor?: string
  border?: string
  borderRadius?: string
  padding?: string
  margin?: string
  boxShadow?: string
  cursor?: string
  transition?: string
  [key: string]: string | number | undefined
}

export interface ElementStyle {
  base?: ElementStyleState
  complete?: ElementStyleState
  empty?: ElementStyleState
  invalid?: ElementStyleState
  focus?: ElementStyleState
  disabled?: ElementStyleState
}

const STYLE_TAG_ID = 'nexus-element-style'

function toKebabCase(property: string): string {
  if (property === 'placeholderColor') return '--nexus-placeholder-color'
  if (property === 'iconColor') return '--nexus-icon-color'
  return property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

function declarationsToCss(decl: ElementStyleState): string {
  return Object.entries(decl)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${toKebabCase(k)}: ${v};`)
    .join('\n  ')
}

function buildStyleCss(style: ElementStyle): string {
  let css = ''
  const base = style.base ?? {}

  css += `.nexus-input {\n  ${declarationsToCss(base)}\n}\n`

  if (style.base?.placeholderColor) {
    css += `.nexus-input::placeholder { color: ${style.base.placeholderColor}; }\n`
  }

  if (style.empty) {
    css += `.nexus--empty .nexus-input {\n  ${declarationsToCss(style.empty)}\n}\n`
  }

  if (style.complete) {
    css += `.nexus--complete .nexus-input {\n  ${declarationsToCss(style.complete)}\n}\n`
  }

  if (style.invalid) {
    css += `.nexus--invalid .nexus-input {\n  ${declarationsToCss(style.invalid)}\n}\n`
  }

  if (style.focus) {
    css += `.nexus--focused .nexus-input {\n  ${declarationsToCss(style.focus)}\n}\n`
  }

  if (style.disabled) {
    css += `.nexus--disabled .nexus-input {\n  ${declarationsToCss(style.disabled)}\n}\n`
  }

  return css
}

export function useElementStyle(styleRef: Ref<ElementStyle | undefined>): void {
  function apply(): void {
    const style = styleRef.value
    let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null

    if (!style || (!style.base && !style.complete && !style.empty && !style.invalid && !style.focus && !style.disabled)) {
      tag?.remove()
      return
    }

    if (!tag) {
      tag = document.createElement('style')
      tag.id = STYLE_TAG_ID
      document.head.appendChild(tag)
    }

    tag.textContent = buildStyleCss(style)
  }

  watch(styleRef, apply, { immediate: true, deep: true })
}
