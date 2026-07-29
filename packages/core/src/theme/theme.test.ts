import { describe, expect, it } from 'vitest'
import { THEME_PRESETS, resolveAppearance } from './index'

describe('resolveAppearance', () => {
  it('defaults to the stripe theme', () => {
    const resolved = resolveAppearance(null)
    expect(resolved.variables['--nexus-color-primary']).toBe('#635bff')
    expect(resolved.variables['--nexus-color-background']).toBe('#ffffff')
    expect(resolved.variables['--nexus-spacing']).toBe('8px')
    expect(resolved.rules).toEqual({})
  })

  it('applies the night theme', () => {
    const resolved = resolveAppearance({ theme: 'night' })
    expect(resolved.variables['--nexus-color-background']).toBe('#30313d')
    expect(resolved.variables['--nexus-color-text']).toBe('#ffffff')
  })

  it('applies the flat theme', () => {
    const resolved = resolveAppearance({ theme: 'flat' })
    expect(resolved.variables['--nexus-border-radius']).toBe('2px')
  })

  it('applies the none theme with transparent chrome', () => {
    const resolved = resolveAppearance({ theme: 'none' })
    expect(resolved.variables['--nexus-color-border']).toBe('transparent')
    expect(resolved.variables['--nexus-border-radius']).toBe('0px')
  })

  it('lets custom variables override the preset', () => {
    const resolved = resolveAppearance({
      theme: 'stripe',
      variables: { colorPrimary: '#000000', borderRadius: '12px' },
    })
    expect(resolved.variables['--nexus-color-primary']).toBe('#000000')
    expect(resolved.variables['--nexus-border-radius']).toBe('12px')
    expect(resolved.variables['--nexus-color-text']).toBe('#30313d')
  })

  it('passes rules through untouched', () => {
    const rules = { '.Input': { fontWeight: '500' } }
    const resolved = resolveAppearance({ rules })
    expect(resolved.rules).toEqual(rules)
  })

  it('every preset resolves a full variable set', () => {
    for (const theme of Object.keys(THEME_PRESETS)) {
      const resolved = resolveAppearance({ theme: theme as keyof typeof THEME_PRESETS })
      expect(Object.keys(resolved.variables)).toHaveLength(21)
    }
  })
})
