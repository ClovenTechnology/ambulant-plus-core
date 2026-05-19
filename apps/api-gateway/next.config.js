const path = require("path");

/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
    externalDir: true
  },
  transpilePackages: [
    "@ambulant/client-core",
    "@ambulant/payments",
    "@ambulant/clinical-codes",
    "@ambulant/shared-utils",
    "@ambulant/shared-mocks",
    "@shared/medreach"
  ]
};