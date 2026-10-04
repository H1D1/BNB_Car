// Remotion CLI config (videos are rendered from src/remotion/index.ts).
import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(90);
// Mapbox GL needs WebGL in headless Chrome.
Config.setChromiumOpenGlRenderer("angle");
Config.overrideWebpackConfig((config) => {
  const withTw = enableTailwind(config);
  return {
    ...withTw,
    resolve: {
      ...withTw.resolve,
      alias: { ...(withTw.resolve?.alias ?? {}), "@": path.join(process.cwd(), "src") },
    },
  };
});
