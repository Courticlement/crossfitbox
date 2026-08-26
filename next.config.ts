import type { NextConfig } from "next";
import os from "node:os";

// Coaches (and you) access this app over the box WiFi, not just localhost —
// allow that origin so dev-mode hot reload works from other devices too.
function localLanAddress(): string | undefined {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  const lan = interfaces.find(
    (i) => i && i.family === "IPv4" && !i.internal
  );
  return lan?.address;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: (() => {
    const address = localLanAddress();
    return address ? [address] : undefined;
  })(),
};

export default nextConfig;
