// Custom footer copyright notice
(function() {
  function addCopyright() {
    const footer = document.querySelector('footer');
    if (footer && !document.getElementById('omcp-footer-note')) {
      const copyright = document.createElement('div');
      copyright.id = 'omcp-footer-note';
      copyright.innerHTML = 'Open Model Context Protocol — a community-driven fork. Built without permission.<br>Contributions are licensed under Apache-2.0; documentation under CC-BY-4.0. <a href="https://github.com/enclawed/omcp/blob/main/MANIFESTO.md">Read the manifesto</a>.';
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
