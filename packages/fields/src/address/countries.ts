export interface StateOption {
  value: string
  label: string
}

export interface CountryFieldConfig {
  stateLabel: string
  stateType: 'text' | 'select'
  stateRequired: boolean
  stateOptions?: StateOption[]
  postalLabel: string
  postalRequired: boolean
  postalFormat?: RegExp
  postalPlaceholder?: string
  cityLabel: string
}

export interface Country {
  code: string
  name: string
}

export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States' },
  { code: 'CN', name: 'China' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'IN', name: 'India' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IE', name: 'Ireland' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'KR', name: 'South Korea' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'ZA', name: 'South Africa' },
]

const US_STATES: StateOption[] = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
]

const CA_PROVINCES: StateOption[] = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
]

const DEFAULT_CONFIG: CountryFieldConfig = {
  stateLabel: 'State / Province',
  stateType: 'text',
  stateRequired: false,
  postalLabel: 'Postal code',
  postalRequired: true,
  cityLabel: 'City',
}

const CONFIGS: Record<string, CountryFieldConfig> = {
  US: {
    stateLabel: 'State',
    stateType: 'select',
    stateRequired: true,
    stateOptions: US_STATES,
    postalLabel: 'ZIP',
    postalRequired: true,
    postalFormat: /^\d{5}(-\d{4})?$/,
    postalPlaceholder: '10001',
    cityLabel: 'City',
  },
  CA: {
    stateLabel: 'Province',
    stateType: 'select',
    stateRequired: true,
    stateOptions: CA_PROVINCES,
    postalLabel: 'Postal code',
    postalRequired: true,
    postalFormat: /^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/,
    postalPlaceholder: 'K1A 0B1',
    cityLabel: 'City',
  },
  GB: {
    stateLabel: 'County',
    stateType: 'text',
    stateRequired: false,
    postalLabel: 'Postcode',
    postalRequired: true,
    postalFormat: /^[A-Za-z]{1,2}\d[A-Za-z\d]?[ ]?\d[A-Za-z]{2}$/,
    postalPlaceholder: 'SW1A 1AA',
    cityLabel: 'Town / City',
  },
  CN: {
    stateLabel: 'Province',
    stateType: 'text',
    stateRequired: true,
    postalLabel: 'Postal code',
    postalRequired: false,
    postalFormat: /^\d{6}$/,
    postalPlaceholder: '100000',
    cityLabel: 'City',
  },
  AU: {
    stateLabel: 'State / Territory',
    stateType: 'text',
    stateRequired: true,
    postalLabel: 'Postcode',
    postalRequired: true,
    postalFormat: /^\d{4}$/,
    postalPlaceholder: '2000',
    cityLabel: 'Suburb',
  },
  DE: {
    stateLabel: 'State',
    stateType: 'text',
    stateRequired: false,
    postalLabel: 'PLZ',
    postalRequired: true,
    postalFormat: /^\d{5}$/,
    postalPlaceholder: '10115',
    cityLabel: 'City',
  },
  FR: {
    stateLabel: 'Region',
    stateType: 'text',
    stateRequired: false,
    postalLabel: 'Code postal',
    postalRequired: true,
    postalFormat: /^\d{5}$/,
    postalPlaceholder: '75001',
    cityLabel: 'City',
  },
  NL: {
    stateLabel: 'Province',
    stateType: 'text',
    stateRequired: false,
    postalLabel: 'Postcode',
    postalRequired: true,
    postalFormat: /^\d{4}[ ]?[A-Za-z]{2}$/,
    postalPlaceholder: '1012 AB',
    cityLabel: 'City',
  },
  JP: {
    stateLabel: 'Prefecture',
    stateType: 'text',
    stateRequired: true,
    postalLabel: 'Postal code',
    postalRequired: true,
    postalFormat: /^\d{3}-?\d{4}$/,
    postalPlaceholder: '100-0001',
    cityLabel: 'City',
  },
}

export function getCountryConfig(code: string): CountryFieldConfig {
  return CONFIGS[code] ?? DEFAULT_CONFIG
}
