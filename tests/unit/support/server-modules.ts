// Preload (`node --import`) that lets a child process load the server composition modules outside
// Next.js: `server-only` becomes an empty module (as in Next's server layers) and extensionless
// `next/*` subpaths resolve to their CommonJS files. Test support only; never imported by src/.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return { url: "data:text/javascript,export{}", shortCircuit: true };
    try {
      return next(specifier, context);
    } catch (error) {
      if (/^next\/[a-z/-]+$/.test(specifier)) return next(`${specifier}.js`, context);
      throw error;
    }
  },
});
