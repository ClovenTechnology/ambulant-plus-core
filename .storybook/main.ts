import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: [
    // shared packages
    '../packages/**/*.stories.@(ts|tsx|mdx)',
    // both apps
    '../apps/**/components/**/*.stories.@(ts|tsx|mdx)',
    '../apps/**/app/**/*.stories.@(ts|tsx|mdx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y', // ✅ axe/contrast
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  docs: {
    autodocs: true,
  },
};
export default config;
