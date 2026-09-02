import { createApp } from './app.js';

const port = process.env.PORT || 3001;
const host = process.env.HOST || '0.0.0.0';
const app = createApp();
const server = app.listen(port, host, () => {
	console.log(`Server listening on http://${host}:${port}`);
});

server.on('error', (error) => {
	if (error.code === 'EADDRINUSE') {
		console.error(`Port ${port} is already in use. Stop the existing server or set PORT to a different value.`);
		process.exit(1);
	}

	throw error;
});
