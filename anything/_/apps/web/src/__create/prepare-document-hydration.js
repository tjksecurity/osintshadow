/**
 * React 18 hydrates this app's whole document. The in-app browser can insert its
 * comments widget beside BODY, where React treats it as unexpected HTML content.
 * Preserve that known widget (including its shadow root/listeners) at BODY's
 * tail, which React leaves alone. Never delete nodes or hide hydration errors.
 * Watch until the widget is handled once or initial hydration commits.
 * @param {Document | undefined} document
 */
export function prepareDocumentHydration(document) {
  const root = document?.documentElement;
  const body = document?.body;
  if (!root || !body) return () => {};

  let active = true;
  const preserveCommentsRoot = () => {
    if (!active) return;
    for (const node of Array.from(root.children)) {
      if (node.tagName === 'DIV' && node.id === 'codex-browser-sidebar-comments-root') {
        // The host owns this node and may enforce another placement. Stop before
        // moving it so competing observers cannot create an unbounded loop.
        stop();
        body.appendChild(node);
        return;
      }
    }
  };
  const view = document.defaultView;
  const observer = view?.MutationObserver ? new view.MutationObserver(preserveCommentsRoot) : null;
  const stop = () => {
    active = false;
    observer?.disconnect();
    view?.removeEventListener('pagehide', stop);
  };
  observer?.observe(root, { childList: true });
  view?.addEventListener('pagehide', stop, { once: true });
  preserveCommentsRoot();
  return stop;
}
