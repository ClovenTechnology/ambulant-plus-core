const path = require('path');
/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
};