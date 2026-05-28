import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'surface-0': '#0A0A0A',
        'surface-1': '#141414',
        'surface-2': '#1F1F1F',
        'text-primary': '#F0EDE8',
        'text-secondary': '#8A8580',
        'text-disabled': '#3D3B38',
        accent: '#E8FF47',
        'accent-dim': '#B8CC2E',
        success: '#3ECF6A',
        danger: '#FF4C4C',
        warning: '#FFB020',
      },
      fontFamily: {
        sans: ['Inter_400Regular', 'System'],
        'sans-medium': ['Inter_500Medium', 'System'],
        'sans-bold': ['Inter_700Bold', 'System'],
        mono: ['JetBrainsMono_400Regular', 'Courier'],
        'mono-bold': ['JetBrainsMono_700Bold', 'Courier'],
      },
      fontSize: {
        xs: ['14px', { lineHeight: '18px' }],
        sm: ['16px', { lineHeight: '22px' }],
        base: ['18px', { lineHeight: '26px' }],
        lg: ['20px', { lineHeight: '30px' }],
        xl: ['22px', { lineHeight: '30px' }],
        '2xl': ['26px', { lineHeight: '34px' }],
        '3xl': ['32px', { lineHeight: '38px' }],
        '4xl': ['40px', { lineHeight: '44px' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
