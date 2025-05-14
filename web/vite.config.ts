import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
// import devtools from 'solid-devtools/vite';
import path from 'path'

export default defineConfig({
	plugins: [
		/*
		Uncomment the following line to enable solid-devtools.
		For more info see https://github.com/thetarnav/solid-devtools/tree/main/packages/extension#readme
		*/
		// devtools(),
		solidPlugin(),
	],
	server: {
		port: 3000,
		host: '127.0.0.1',
		https: {
			key: 'certs/key.pem',
			cert: 'certs/cert.pem',
		},
	},
	resolve: {
		alias: {
			'~': path.resolve(__dirname, './src'),
		},
	},
	build: {
		target: 'esnext',
	},
})
