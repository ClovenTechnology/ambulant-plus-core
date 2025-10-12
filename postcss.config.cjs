// postcss.config.cjs (monorepo root)
// Keep it minimal to avoid the root overriding app-specific behavior
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
