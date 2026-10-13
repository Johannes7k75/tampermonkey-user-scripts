import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'AniWorld Filler highlighter',
        description: 'Highlights Filler episodes on aniworld in red',
        namespace: 'https://github.com/Johannes7k75',
        version: '1.0.2',
        match: ['https://aniworld.to/anime/stream/*'],
        updateURL:
          'https://github.com/Johannes7k75/tampermonkey-user-scripts/releases/latest/download/filler-highlighter.user.js',
        downloadURL:
          'https://github.com/Johannes7k75/tampermonkey-user-scripts/releases/latest/download/filler-highlighter.user.js',
        grant: ['GM_getResourceText', 'GM_addStyle'],
        resource: {
          'fillers.json':
            'https://github.com/Johannes7k75/tampermonkey-user-scripts/releases/download/AniWorld-Filler/fillers.json',
        },
      },
    }),
  ],
});
