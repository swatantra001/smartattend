const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Critical: resolve from project root first, not monorepo root
config.resolver.disableHierarchicalLookup = false;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;