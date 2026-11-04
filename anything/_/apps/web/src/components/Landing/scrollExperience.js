// Progressive enhancement: text remains visible without JavaScript or animation APIs.
export function installScrollExperience(root, win = window) {
  if (!root || !win.matchMedia) return () => {};
  const preference = win.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let observer;
  let frame = 0;
  const progress = root.querySelector('[data-scroll-progress]');
  const updateProgress = () => {
    frame = 0;
    const distance = Math.max(1, root.scrollHeight - win.innerHeight);
    const amount = Math.max(0, Math.min(1, win.scrollY / distance));
    if (progress) progress.style.transform = `scaleX(${amount})`;
  };
  const onScroll = () => {
    if (!frame) frame = win.requestAnimationFrame(updateProgress);
  };
  const start = () => {
    observer?.disconnect();
    for (const animation of animations) animation.cancel();
    animations.clear();
    if (preference.matches || !win.IntersectionObserver) return;
    observer = new win.IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (typeof entry.target.animate !== 'function') continue;
        const animation = entry.target.animate(
          [{ transform: 'translateY(28px)', opacity: 0.35 }, { transform: 'translateY(0)', opacity: 1 }],
          { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'none' },
        );
        animations.add(animation);
        animation.finished?.then(() => animations.delete(animation), () => animations.delete(animation));
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });
    root.querySelectorAll('[data-reveal]').forEach(node => observer.observe(node));
  };
  start();
  updateProgress();
  win.addEventListener('scroll', onScroll, { passive: true });
  win.addEventListener('resize', onScroll);
  preference.addEventListener?.('change', start);
  return () => {
    observer?.disconnect();
    for (const animation of animations) animation.cancel();
    if (frame) win.cancelAnimationFrame(frame);
    win.removeEventListener('scroll', onScroll);
    win.removeEventListener('resize', onScroll);
    preference.removeEventListener?.('change', start);
  };
}
