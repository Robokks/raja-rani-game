/* Shared, opt-in pause controls for single-player games. */
(function () {
  'use strict';
  window.GamePause = {
    install({ isPlaying, resetInput }) {
      let paused = false;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Ⅱ Pause';
      button.setAttribute('aria-label', 'Pause game');
      button.style.cssText = 'position:fixed;right:12px;top:72px;z-index:25;min-height:44px;padding:10px 16px;border:1px solid #ffffff60;border-radius:24px;background:#101528dd;color:white;font:600 14px system-ui;touch-action:manipulation';
      button.hidden = true;
      const overlay = document.createElement('div');
      overlay.hidden = true;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Game paused');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#080d20ed;color:white;text-align:center;align-content:center;padding:24px;font-family:system-ui';
      const title = document.createElement('h1');
      title.textContent = 'Game paused';
      const hint = document.createElement('p');
      hint.textContent = 'Take your time. Resume when you’re ready.';
      const resume = document.createElement('button');
      resume.type = 'button';resume.textContent = '▶ Resume game';
      resume.style.cssText = 'min-height:48px;padding:14px 24px;background:#67e8f9;border:0;border-radius:24px;color:#101528;font:700 16px system-ui;touch-action:manipulation';
      overlay.append(title, hint, resume);
      document.body.append(button, overlay);
      function setPaused(next) {
        if (next && !isPlaying()) return;
        paused = next;
        resetInput();
        overlay.hidden = !paused;
        button.hidden = paused || !isPlaying();
        if (paused) resume.focus();
        else button.focus();
      }
      button.addEventListener('click', () => setPaused(true));
      resume.addEventListener('click', () => setPaused(false));
      window.addEventListener('blur', () => {resetInput();setPaused(true);});
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {resetInput();setPaused(true);}
      });
      // Capture prevents gameplay handlers from firing while the dialog is open.
      document.addEventListener('keydown', e => {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          if (!e.repeat && isPlaying()) setPaused(!paused);
          e.preventDefault();e.stopImmediatePropagation();
        } else if (paused) {
          if (e.code === 'Enter' || e.code === 'Space') {
            e.preventDefault();if(!e.repeat)setPaused(false);
          } else if(e.code === 'Tab') {e.preventDefault();resume.focus();}
          e.stopImmediatePropagation();
        }
      }, true);
      return {
        get paused() { return paused; },
        sync() { button.hidden = paused || !isPlaying(); }
      };
    }
  };
})();
