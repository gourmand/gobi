declare module "@vscode/windows-ca-certs" {
  // Minimal ambient declarations to satisfy TypeScript when the package is used
  // at runtime via dynamic import. The actual runtime shape may differ; these
  // are intentionally permissive.

  export function addToAgent(agent: any): void;

  // Returns PEM string or an array/buffer depending on implementation.
  export function getCerts(): Promise<any>;

  // Provide a default export fallback (some builds may export a function as default)
  const _default: any;
  export default _default;
}
