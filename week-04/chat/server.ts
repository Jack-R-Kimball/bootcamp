import { createServer } from 'http';
import { handler } from './build/handler.js';
import { attachWs } from './src/lib/server/ws.js';

const PORT = parseInt(process.env.PORT || '4323');

const server = createServer(handler);
attachWs(server);

server.listen(PORT, () => {
	console.log(`Chat server running on http://localhost:${PORT}`);
});
