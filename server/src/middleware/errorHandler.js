export function notFound(req, res) {
	res.status(404).json({ message: 'Not found' });
}

export function errorHandler(err, req, res, next) {
	if (res.headersSent) {
		next(err);
		return;
	}

	const status = err.status || 500;
	const message = status >= 500 ? 'Something went wrong' : err.message;
	if (status >= 500) {
		console.error(err);
	}

	res.status(status).json({ message });
}

export function badRequest(message) {
	const error = new Error(message);
	error.status = 400;
	return error;
}
