export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // Map workspace packages to their source so Jest transforms TS/ESM
    "^@gourmanddev/config-yaml(.*)$": "<rootDir>/../../config-yaml/src$1",
    // node-fetch ships ESM source; map to a CJS entry for Jest runtime
    "^node-fetch$": "node-fetch/lib/index.cjs",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        isolatedModules: true,
      },
    ],
  },
};
