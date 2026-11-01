let application;

function getApplication() {
  if (!application) {
    // Set before evaluating the bundled server, which otherwise starts its own
    // standalone listener. Request input never selects the server runtime.
    process.env.SHADOWTRACE_SERVER_MODE = 'fetch';
    application = import('../build/server/index.js').then(({ default: app }) => app);
  }
  return application;
}

export default {
  async fetch(request) {
    return (await getApplication()).fetch(request);
  },
};
