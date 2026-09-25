// Generates the app icons in public/ from public/favicon.svg. Run after changing the logo:
//   npx @vite-pwa/assets-generator@1
export default {
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']] },
    // Android crops maskable icons to its own shape, and iOS rounds the corners itself, so
    // these get a full-bleed brand-green background instead of white padding.
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: '#16a34a' } },
    apple: { sizes: [180], padding: 0.3, resizeOptions: { background: '#16a34a' } },
  },
  images: ['public/favicon.svg'],
}
