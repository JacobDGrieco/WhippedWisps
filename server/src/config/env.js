import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(moduleDir, '../../../.env');

// Local development starts the server from the workspace package, so dotenv's
// default cwd lookup misses the repository-level .env file.
if (fs.existsSync(rootEnvPath)) {
	dotenv.config({ path: rootEnvPath, quiet: true });
}
