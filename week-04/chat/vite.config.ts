import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import type { ViteDevServer } from 'vite';
import { attachWs } from './src/lib/server/ws';
import type { Server } from 'http';

function wsDevPlugin() {
	return {
		name: 'ws-dev-plugin',
		configureServer(server: ViteDevServer) {
			if (server.httpServer) {
				attachWs(server.httpServer as unknown as Server);
			}
		}
	};
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), wsDevPlugin()],
	server: {
		port: 4323
	}
});
