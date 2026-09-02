const http = require('node:http');

const healthUrl = new URL(process.argv[2] || 'http://127.0.0.1:3001/api/health');
const timeoutMs = Number(process.argv[3] || 15000);
const retryDelayMs = 250;
const startedAtMs = Date.now();

function checkHealth() {
	const request = http.get(healthUrl, (response) => {
		response.resume();

		if (response.statusCode >= 200 && response.statusCode < 500) {
			process.exit(0);
			return;
		}

		retry();
	});

	request.on('error', retry);
	request.setTimeout(retryDelayMs, () => {
		request.destroy();
		retry();
	});
}

function retry() {
	if (Date.now() - startedAtMs >= timeoutMs) {
		console.error(`Timed out waiting for ${healthUrl.toString()}`);
		process.exit(1);
		return;
	}

	setTimeout(checkHealth, retryDelayMs);
}

checkHealth();
