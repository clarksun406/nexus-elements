/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { applyAppearance, applyFonts } from './appearance'

describe('appearance', () => {
  it('writes variables, rules, and the flat radius onto the card shell', () => {
    document.body.innerHTML = '<div class="nexus-card-element"></div>'
    applyAppearance({
      variables: { '--nexus-border-radius': '2px', '--nexus-color-primary': '#0570de', '--nexus-outline': '2px solid red', '--nexus-z-index': '4' },
      rules: { '.Checkbox': { color: 'black' }, '.Unknown': { margin: '1px' } },
    })
    expect(document.documentElement.style.getPropertyValue('--nexus-border-radius')).toBe('2px')
    expect((document.querySelector('.nexus-card-element') as HTMLElement).style.borderRadius).toBe('2px')
    expect(document.getElementById('nexus-appearance-rules')?.textContent).toContain('.nexus-checkbox')
    applyFonts([{ family: 'Inter', src: 'https://example.test/inter.woff2', weight: '500' }])
    expect(document.getElementById('nexus-fonts')?.textContent).toContain('Inter')
    applyFonts([])
    expect(document.getElementById('nexus-fonts')).toBeNull()
  })
})
