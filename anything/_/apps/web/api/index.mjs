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
    const app = await getApplication();
    if (!new URL(request.url).pathname.startsWith('/api/')) {
      // A direct dependency edge lets Vercel trace the split SSR build's
      // external packages. Wait until the app initializes to avoid its cycle.
      await import('../build/server/assets/server-build.js');
    }
    return app.fetch(request);
  },
};
