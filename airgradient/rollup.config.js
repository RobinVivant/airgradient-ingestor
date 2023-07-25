import {nodeResolve} from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import {string} from 'rollup-plugin-string';


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
		nodeResolve({browser: true}),
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
