'use strict';

document.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('message', (e) => {
  if (e.data?.mila === 'pause') {
    document.querySelectorAll('video, audio').forEach(function (el) {
      el.pause();
      el.muted = true;
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const s = document.createElement('style');
  s.textContent = '*{scrollbar-width:none;-ms-overflow-style:none}::-webkit-scrollbar{display:none}';
  document.head.appendChild(s);
});

try { Object.defineProperty(document, 'fullscreenEnabled', { get: () => true }); } catch (_) {}
try { Object.defineProperty(document, 'webkitFullscreenEnabled', { get: () => true }); } catch (_) {}
