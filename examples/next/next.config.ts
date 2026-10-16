import type { NextConfig } from 'next';

// The repo root has its own lockfile, and Next would otherwise take it for this app's root.
const config: NextConfig = {
	turbopack: { root: import.meta.dirname },
	outputFileTracingRoot: import.meta.dirname
};

export default config;
