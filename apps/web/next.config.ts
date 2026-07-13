import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@particle-network/authkit",
    "@particle-network/auth-core",
    "@particle-network/universal-account-sdk",
  ],
  webpack: (config, { isServer, webpack }) => {
    // Particle Auth Core → @aws-sdk/credential-providers → node:child_process.
    // Stub Node-only modules so the client bundle can compile.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        worker_threads: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        "@aws-sdk/credential-provider-process": false,
        "@aws-sdk/credential-provider-node": false,
        "@aws-sdk/credential-provider-ini": false,
      };

      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
    }

    return config;
  },
};

export default nextConfig;
