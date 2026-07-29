import type { Appearance, AppearanceVariables } from '../types'

export interface ResolvedAppearance {
  variables: Record<string, string>
  rules: Record<string, Record<string, string>>
}

export const THEME_PRESETS: Record<NonNullable<Appearance['theme']>, AppearanceVariables> = {
  stripe: {
    colorPrimary: '#635bff',
    colorBackground: '#ffffff',
    colorText: '#30313d',
    colorTextSecondary: '#8792a2',
    colorDanger: '#df1b41',
    colorSuccess: '#30b130',
    colorBorder: '#e0e0e0',
    colorBorderFocus: '#635bff',
    borderRadius: '6px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSizeBase: '16px',
    fontSizeSm: '13px',
    spacingUnit: '8px',
    gridGutter: '12px',
  },
  flat: {
    colorPrimary: '#0570de',
    colorBackground: '#ffffff',
    colorText: '#1f2937',
    colorTextSecondary: '#6b7280',
    colorDanger: '#d92d20',
    colorSuccess: '#12b76a',
    colorBorder: '#cfd7df',
    colorBorderFocus: '#0570de',
    borderRadius: '2px',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSizeBase: '15px',
    fontSizeSm: '12px',
    spacingUnit: '8px',
    gridGutter: '10px',
  },
  night: {
    colorPrimary: '#7a73ff',
    colorBackground: '#30313d',
    colorText: '#ffffff',
    colorTextSecondary: '#a3acbf',
    colorDanger: '#ff5b6a',
    colorSuccess: '#30d158',
    colorBorder: '#575f75',
    colorBorderFocus: '#7a73ff',
    borderRadius: '6px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSizeBase: '16px',
    fontSizeSm: '13px',
    spacingUnit: '8px',
    gridGutter: '12px',
  },
  none: {
    colorPrimary: '#30313d',
    colorBackground: 'transparent',
    colorText: '#30313d',
    colorTextSecondary: '#8792a2',
    colorDanger: '#df1b41',
    colorSuccess: '#30b130',
    colorBorder: 'transparent',
    colorBorderFocus: 'transparent',
    borderRadius: '0px',
    fontFamily: 'inherit',
    fontSizeBase: '16px',
    fontSizeSm: '13px',
    spacingUnit: '0px',
    gridGutter: '12px',
  },
}

const VARIABLE_MAP: Record<keyof AppearanceVariables, string> = {
  colorPrimary: '--nexus-color-primary',
  colorBackground: '--nexus-color-background',
  colorText: '--nexus-color-text',
  colorTextSecondary: '--nexus-color-text-secondary',
  colorDanger: '--nexus-color-danger',
  colorSuccess: '--nexus-color-success',
  colorBorder: '--nexus-color-border',
  colorBorderFocus: '--nexus-color-border-focus',
  borderRadius: '--nexus-border-radius',
  fontFamily: '--nexus-font-family',
  fontSizeBase: '--nexus-font-size',
  fontSizeSm: '--nexus-font-size-sm',
  spacingUnit: '--nexus-spacing',
  gridGutter: '--nexus-grid-gutter',
}

export function resolveAppearance(appearance: Appearance | null | undefined): ResolvedAppearance {
  const theme = appearance?.theme ?? 'stripe'
  const preset = THEME_PRESETS[theme] ?? THEME_PRESETS.stripe
  const merged: AppearanceVariables = { ...preset, ...appearance?.variables }

  const variables: Record<string, string> = {}
  for (const [key, cssVar] of Object.entries(VARIABLE_MAP)) {
    const value = merged[key as keyof AppearanceVariables]
    if (value !== undefined) {
      variables[cssVar] = value
    }
  }

  return { variables, rules: appearance?.rules ?? {} }
}
