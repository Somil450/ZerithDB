import { defineConfig } from "tsup";
import { compile } from "svelte/compiler";
import fs from "fs";

const sveltePlugin = {
  name: "svelte",
  setup(build: any) {
    build.onLoad({ filter: /\.svelte$/ }, async (args: any) => {
      const source = await fs.promises.readFile(args.path, "utf8");
      const { js } = compile(source, {
        filename: args.path,
      });
      return {
        contents: js.code,
        loader: "js",
      };
    });
  },
};

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  treeshake: true,
  external: ["svelte", /\.svelte$/],
  esbuildPlugins: [sveltePlugin],
});
