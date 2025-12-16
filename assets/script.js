(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // -------- Theme --------
  const root = document.documentElement;
  const themeBtn = $("#themeBtn");
  const themeIcon = $("#themeIcon");
  const themeLabel = $("#themeLabel");

  function setTheme(mode){
    root.dataset.theme = mode;
    localStorage.setItem("theme", mode);
    const isDark = mode === "dark";
    if(themeIcon){
      themeIcon.innerHTML = isDark ? ICON_SUN : ICON_MOON;
    }
    if(themeLabel){
      themeLabel.textContent = isDark ? "Light" : "Dark";
    }
    // update meta theme-color for nicer mobile chrome
    const meta = $('meta[name="theme-color"]');
    if(meta){
      meta.setAttribute("content", isDark ? "#0b0f14" : "#ffffff");
    }
  }

  function initTheme(){
    const stored = localStorage.getItem("theme");
    if(stored === "light" || stored === "dark"){
      setTheme(stored);
      return;
    }
    // default to system
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }

  if(themeBtn){
    themeBtn.addEventListener("click", () => {
      const next = (root.dataset.theme === "dark") ? "light" : "dark";
      setTheme(next);
    });
  }

  // -------- Mobile menu --------
  const menuBtn = $("#menuBtn");
  const nav = $("#nav");
  if(menuBtn && nav){
    menuBtn.addEventListener("click", () => {
      nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", nav.classList.contains("open") ? "true" : "false");
    });
    // close menu when clicking a nav link
    $$("#nav a").forEach(a => a.addEventListener("click", () => {
      nav.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    }));
  }

  // -------- Copy email --------
  const copyEmailBtn = $("#copyEmailBtn");
  if(copyEmailBtn){
    copyEmailBtn.addEventListener("click", async () => {
      const parts = copyEmailBtn.dataset.email ? JSON.parse(copyEmailBtn.dataset.email) : null;
      const email = parts ? `${parts[0]}@${parts[1]}.${parts[2]}` : copyEmailBtn.dataset.emailRaw;
      try{
        await navigator.clipboard.writeText(email);
        toast("Copied email");
      }catch(e){
        // fallback: prompt
        window.prompt("Copy email:", email);
      }
    });
  }

  // -------- Filters --------
  function hookupFilter(inputSel, itemSel, countSel){
    const input = $(inputSel);
    const items = $$(itemSel);
    const count = $(countSel);
    if(!input || items.length === 0) return;

    function apply(){
      const q = (input.value || "").trim().toLowerCase();
      let shown = 0;
      items.forEach(it => {
        const hay = (it.dataset.search || "").toLowerCase();
        const ok = q === "" || hay.includes(q);
        it.style.display = ok ? "" : "none";
        if(ok) shown += 1;
      });
      if(count) count.textContent = `${shown}/${items.length}`;
    }
    input.addEventListener("input", apply);
    apply();
  }

  hookupFilter("#pubFilter", ".pub-item", "#pubCount");
  hookupFilter("#talkFilter", ".talk-item", "#talkCount");

  // -------- Active section highlight --------
  // Nav highlight is driven by `data-active="true"` on the current nav link.
  // Do NOT hardcode section IDs here (e.g. "papers" vs "publications").
  // Instead, derive the IDs from the actual nav anchors in the HTML.

  const navLinks = $$("#nav a");
  const navItems = navLinks
    .map(a => {
      const href = a.getAttribute("href") || "";
      if(!href.startsWith("#")) return null;
      const id = decodeURIComponent(href.slice(1));
      const section = document.getElementById(id);
      if(!section) return null;
      return { id, link: a, section };
    })
    .filter(Boolean);

  function setActive(id){
    navItems.forEach(({ id: sid, link }) => {
      link.dataset.active = (sid === id) ? "true" : "false";
    });
  }

  function headerOffset(){
    // Prefer the CSS `scroll-margin-top` (your sections use it so hash-nav lands nicely)
    // and fall back to the sticky header height.
    const firstSection = navItems[0]?.section || null;

    let scrollMargin = 0;
    if(firstSection){
      const smt = window.getComputedStyle(firstSection).scrollMarginTop;
      const px = parseFloat(smt || "0");
      if(!Number.isNaN(px)) scrollMargin = px;
    }

    const header = $(".site-header");
    const headerH = header ? header.getBoundingClientRect().height : 0;

    // Use whichever is larger, plus a tiny buffer.
    return Math.max(scrollMargin, headerH) + 4;
  }

  function updateActiveFromScroll(){
    if(!navItems.length) return;

    const offset = headerOffset();

    // Pick the last section whose top edge is above the sticky header (plus offset).
    let currentId = navItems[0].id;
    let bestTop = -Infinity;

    navItems.forEach(({ id, section }) => {
      const top = section.getBoundingClientRect().top;
      if(top <= offset && top > bestTop){
        bestTop = top;
        currentId = id;
      }
    });

    setActive(currentId);
  }

  // Set immediately on click, then let scroll keep it in sync.
  navItems.forEach(({ id, link }) => {
    link.addEventListener("click", () => {
      setActive(id);
      // After the smooth scroll finishes, recompute once.
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(updateActiveFromScroll)
      );
    });
  });

  // Lightweight scroll-spy (only 4 sections, so this is very cheap).
  let spyTicking = false;
  function onScrollSpy(){
    if(spyTicking) return;
    spyTicking = true;
    window.requestAnimationFrame(() => {
      updateActiveFromScroll();
      spyTicking = false;
    });
  }

  window.addEventListener("scroll", onScrollSpy, { passive: true });
  window.addEventListener("resize", onScrollSpy);
  window.addEventListener("hashchange", () => {
    window.requestAnimationFrame(updateActiveFromScroll);
  });

  // Initial state
  updateActiveFromScroll();

  // -------- Tiny toast --------
  let toastTimer = null;
  function toast(msg){
    let el = $("#toast");
    if(!el){
      el = document.createElement("div");
      el.id = "toast";
      el.setAttribute("role","status");
      el.setAttribute("aria-live","polite");
      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.bottom = "18px";
      el.style.transform = "translateX(-50%)";
      el.style.padding = "10px 12px";
      el.style.borderRadius = "12px";
      el.style.border = "1px solid var(--border)";
      el.style.background = "color-mix(in oklab, var(--surface) 92%, transparent)";
      el.style.color = "var(--text)";
      el.style.boxShadow = "var(--shadow)";
      el.style.fontSize = "13px";
      el.style.zIndex = "999";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.opacity = "0";
    }, 1400);
  }

  // -------- Icons (inline SVG) --------
  // set initial button icons by injecting into placeholders
  const ICON_MOON = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
    </svg>`;
  const ICON_SUN = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" stroke-width="1.7"/>
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M4.9 4.9 6.3 6.3M17.7 17.7l1.4 1.4M19.1 4.9 17.7 6.3M6.3 17.7 4.9 19.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`;
  const ICON_MENU = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`;
  const ICON_COPY = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 9h10v12H9V9Z" stroke="currentColor" stroke-width="1.7" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="1.7" />
    </svg>`;

  const menuIcon = $("#menuIcon");
  if(menuIcon) menuIcon.innerHTML = ICON_MENU;

  const copyIcon = $("#copyIcon");
  if(copyIcon) copyIcon.innerHTML = ICON_COPY;

  initTheme();

  // -------- Portrait fallback if image missing --------
  const portrait = $("#portraitImg");
  const fallback = $("#portraitFallback");
  if(portrait && fallback){
    portrait.addEventListener("error", () => {
      portrait.style.display = "none";
      fallback.style.display = "grid";
    });
  }
})();