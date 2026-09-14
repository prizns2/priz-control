(function(){
  const MODE_CLASS = 'priz-burger-mode';
  const OPEN_CLASS = 'priz-burger-open';

  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function ensureControls(){
    const sidebar = $('.sidebar');
    if(!sidebar) return;

    let burger = $('#prizMobileBurger', sidebar);
    if(!burger){
      burger = document.createElement('button');
      burger.type = 'button';
      burger.id = 'prizMobileBurger';
      burger.setAttribute('aria-label', 'Открыть меню');
      burger.setAttribute('aria-expanded', 'false');
      burger.innerHTML = '<span></span><span></span><span></span>';
      const bottom = $('.sidebar-bottom', sidebar);
      if(bottom) sidebar.insertBefore(burger, bottom);
      else sidebar.appendChild(burger);
      burger.addEventListener('click', function(e){
        e.preventDefault();
        document.body.classList.toggle(OPEN_CLASS);
        syncState();
      });
    }

    let backdrop = $('#prizBurgerBackdrop');
    if(!backdrop){
      backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.id = 'prizBurgerBackdrop';
      backdrop.setAttribute('aria-label', 'Закрыть меню');
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', closeMenu);
    }

    const nav = $('#nav');
    if(nav && !nav.dataset.prizBurgerBound){
      nav.dataset.prizBurgerBound = '1';
      nav.addEventListener('click', function(e){
        if(e.target.closest('.nav-btn, a, button')) closeMenu();
      });
    }
  }

  function shouldUseBurger(){
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const vv = window.visualViewport;
    const scale = vv && vv.scale ? vv.scale : 1;
    const coarse = window.matchMedia('(pointer: coarse)').matches;

    if (vw <= 560) return true; // phones / max zoom
    if (vw <= 760 && coarse) return true; // phone / small tablet touch
    if (vh <= 560 && vw <= 950) return true; // phone landscape
    if (scale > 1.12 && vw <= 980) return true; // strong zoom

    return false;
  }

  function closeMenu(){
    document.body.classList.remove(OPEN_CLASS);
    syncState();
  }

  function syncState(){
    const burger = document.getElementById('prizMobileBurger');
    if(burger){
      burger.setAttribute('aria-expanded', document.body.classList.contains(OPEN_CLASS) ? 'true' : 'false');
      burger.setAttribute('aria-label', document.body.classList.contains(OPEN_CLASS) ? 'Закрыть меню' : 'Открыть меню');
    }
  }

  function apply(){
    ensureControls();
    const useBurger = shouldUseBurger();
    document.body.classList.toggle(MODE_CLASS, useBurger);
    if(!useBurger) document.body.classList.remove(OPEN_CLASS);
    syncState();
  }

  let raf = 0;
  function schedule(){
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  }

  document.addEventListener('DOMContentLoaded', function(){
    apply();
    setTimeout(apply, 120);
    setTimeout(apply, 700);
  });

  window.addEventListener('resize', schedule, {passive:true});
  window.addEventListener('orientationchange', schedule, {passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', schedule, {passive:true});
    window.visualViewport.addEventListener('scroll', schedule, {passive:true});
  }

  document.addEventListener('click', function(e){
    if(!document.body.classList.contains(MODE_CLASS) || !document.body.classList.contains(OPEN_CLASS)) return;
    const sidebar = document.querySelector('.sidebar');
    if(sidebar && sidebar.contains(e.target)) return;
    closeMenu();
  });

  new MutationObserver(function(){
    schedule();
  }).observe(document.documentElement, {childList:true, subtree:true});

  apply();
})();
function syncLoginMode() {
  const loginView = document.getElementById('loginView');
  if (!loginView) return;

  const isVisible = loginView.offsetParent !== null &&
    getComputedStyle(loginView).display !== 'none' &&
    !loginView.classList.contains('hidden');

  document.body.classList.toggle('priz-login-active', isVisible);
}

window.addEventListener('load', syncLoginMode);
window.addEventListener('resize', syncLoginMode);
document.addEventListener('DOMContentLoaded', syncLoginMode);

new MutationObserver(syncLoginMode).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'style']
});
