module.exports = {
  roots: ["<rootDir>/test"],
  transform: {
    "^.+\\.ts?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
    "^.+\\.js$": [
      "babel-jest",
      {
        presets: [["@babel/preset-env", { targets: { node: "current" } }]],
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node", ".d.ts"],
  extensionsToTreatAsEsm: [".ts", ".d.ts"],
  moduleNameMapper: {
    "^(.*)\\.js$": "$1",
  },
  // Ensure certain ESM packages in node_modules are transformed by Jest
  transformIgnorePatterns: [],
};
