/**
 * @vitest-environment jsdom
 */
import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useElementStyle } from './useElementStyle'

describe('useElementStyle', () => {
  it('writes state rules and removes them when the style is cleared', async () => {
    const style = ref({
      base: { color: '#111', placeholderColor: '#999', iconColor: '#333', fontWeight: '500' },
      empty: { color: '#aaa' },
      complete: { color: '#0a0' },
      invalid: { color: '#a00' },
      focus: { color: '#00a' },
      disabled: { cursor: 'not-allowed' },
    })
    useElementStyle(style)
    const css = document.getElementById('nexus-element-style')?.textContent ?? ''
    expect(css).toContain('.nexus-input')
    expect(css).toContain('.nexus--invalid')
    expect(css).toContain('placeholder')
    style.value = {} as typeof style.value
    await nextTick()
    expect(document.getElementById('nexus-element-style')).toBeNull()
  })
})
