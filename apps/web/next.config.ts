import type { NextConfig } from "next";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);

/** Particle Auth only needs Cognito from this package — force its browser entry. */
const awsCredentialProvidersBrowser = path.join(
  path.dirname(require.resolve("@aws-sdk/credential-providers/package.json")),
  "dist-es/index.browser.js"
);

const nextConfig: NextConfig = {
  // AuthKit's OAuth Index effect is not StrictMode-safe: remount sees empty
  // URL params and force-sets "disconnected" after a successful connect start.
  reactStrictMode: false,
  transpilePackages: [
    "@particle-network/authkit",
    "@particle-network/auth-core",
    "@particle-network/universal-account-sdk",
  ],
  webpack: (config, { isServer, webpack }) => {
    // Particle Auth → @aws-sdk/credential-providers Node barrel pulls SSO/fs.
    // Point client builds at the Cognito-only browser entry instead.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        worker_threads: false,
        path: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
        buffer: require.resolve("buffer/"),
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        "@aws-sdk/credential-providers": awsCredentialProvidersBrowser,
        // Belt-and-suspenders: never pull Node-only AWS credential chains
        "@aws-sdk/credential-provider-node": false,
        "@aws-sdk/credential-provider-process": false,
        "@aws-sdk/credential-provider-ini": false,
        "@aws-sdk/credential-provider-sso": false,
        "@aws-sdk/token-providers": false,
        "@aws-sdk/credential-provider-login": false,
      };

      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
        }),
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          }
        )
      );
    }

    return config;
  },
};

export default nextConfig;
