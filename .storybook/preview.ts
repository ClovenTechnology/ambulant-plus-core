import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    a11y: {
      // axe will run and include WCAG AA color-contrast checks
      options: {
        element: '#storybook-root', // safe default
      },
    },
    controls: { expanded: true },
    layout: 'fullscreen',
  },
};

export default preview;
