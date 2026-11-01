/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the wallet SDKs out of the server bundle.
  serverExternalPackages: ["@base-org/account"],
  // NEAR deployment (chai-pot-near): the home page is the NEAR app.
  async redirects() {
    return process.env.NEAR_HOME === "1" ? [{ source: "/", destination: "/near", permanent: false }] : [];
  },
  async headers() {
    return [{ source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }];
  },
};
export default nextConfig;
