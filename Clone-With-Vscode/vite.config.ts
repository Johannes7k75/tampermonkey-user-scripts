import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'Clone with VSCode',
        description: 'Open github repo in vscode',
        namespace: 'https://github.com/Johannes7k75',
        version: '1.0.1',
        match: ['https://github.com/*/*'],
        updateURL:
          'https://github.com/Johannes7k75/tampermonkey-user-scripts/releases/latest/download/clone-with-vscode.user.js',
        downloadURL:
          'https://github.com/Johannes7k75/tampermonkey-user-scripts/releases/latest/download/clone-with-vscode.user.js',
      },
    }),
  ],
});
