// Custom footer copyright notice
(function() {
  function addCopyright() {
    const footer = document.querySelector('footer');
    if (footer && !document.getElementById('omcp-footer-note')) {
      const copyright = document.createElement('div');
      copyright.id = 'omcp-footer-note';
      copyright.innerHTML = 'omcp\u2122 — a community-driven fork. Built without permission.<br>omcp and the omcp logo are trademarks of Enclawed, Inc. Contributions are licensed under Apache-2.0; documentation under CC-BY-4.0.<br><a href="https://github.com/enclawed/omcp/blob/main/MANIFESTO.md">Manifesto</a> · <a href="https://github.com/enclawed/omcp/blob/main/TRADEMARK.md">Trademark policy</a>.';
      footer.appendChild(copyright);
    }
  }

  // Run on initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addCopyright);
  } else {
    addCopyright();
  }

  // Handle SPA navigation
  const observer = new MutationObserver(addCopyright);
  observer.observe(document.body, { childList: true, subtree: true });
})();
