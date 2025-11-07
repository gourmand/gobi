// Minimal stub for react-devtools-core to avoid runtime import errors
// during bundling for the CLI. Exposes a tiny surface that ink/devtools
// may call. All functions are no-ops.

export function connectToDevTools() {
  return {
    unsubscribe() {},
  };
}

export function registerDevtoolsMessageListener() {
  return {
    unsubscribe() {},
  };
}

export default {
  connectToDevTools,
  registerDevtoolsMessageListener,
};
// End of stub
