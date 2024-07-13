import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import { string } from 'rollup-plugin-string';
import babel from '@rollup/plugin-babel';

export default {
	input: 'src/worker.mjs',
	output: {
		exports: "named",
		format: "esm",
		file: "dist/index.min.mjs",
		sourcemap: true,
		sourcemapExcludeSources: true,
		inlineDynamicImports: true
	},
	treeshake: {
		moduleSideEffects: false,
	},
	plugins: [
		commonjs(),
		nodeResolve({ browser: true }),
		babel({
			babelHelpers: 'bundled',
			presets: ['@babel/preset-react'],
			plugins: ['@babel/plugin-transform-react-jsx'],
			extensions: ['.js', '.jsx'],
			exclude: 'node_modules/**'
		}),
		terser({
			sourceMap: true,
			format: {
				comments: false,
			},
		}),
		string({
			include: ["src/client.js", "src/client.html", "src/openapi.yaml", "src/ai-plugin.json"]
		})
	]
};
