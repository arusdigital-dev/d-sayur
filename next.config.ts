import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Next 16.3.8's draggable development badge can call
  // releasePointerCapture after the pointer has already been released.
  // Runtime and compilation errors remain available in the dev overlay.
  devIndicators: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
