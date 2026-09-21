const nextConfig = require('./next.config');
module.exports = {
  ...nextConfig,
  experiments: {
    ...nextConfig.experimental,
    optimizePackageImports: false
  }
};
