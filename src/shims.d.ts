/**
 * Electrobun's Bun entrypoint re-exports its Three.js and Babylon.js adapters.
 * We never touch them, but TypeScript still follows the imports and neither
 * package ships types. Declaring them as untyped modules is cheaper than
 * pulling `@types/three` in for code that is never called.
 */
declare module 'three'
declare module '@babylonjs/core'

/** Injected by Vite's `define` from `package.json` — see `vite.config.ts`. */
declare const __APP_VERSION__: string
