// @ts-check
import { defineConfig } from 'astro/config';

// Hosted on GitHub Pages until a custom domain is chosen.
export default defineConfig({
	site: 'https://dmccuk.github.io',
	base: '/worksindev',
	trailingSlash: 'always',
});
