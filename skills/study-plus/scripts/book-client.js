// Runs inside book.html. It turns am's flat document into a three-column book:
// chapter navigation, one section at a time, page contents, and search.
//
// This file is injected into <head>, not the end of <body>: am's own script
// leaves scripts placed after it inert. init() waits for the DOM.
(function () {
  function init() {
    var payload = document.getElementById('bk-book');
    if (!payload) return;

    var book = JSON.parse(payload.textContent);
    var panels = [].slice.call(document.querySelectorAll('.am-doc-body > .am-panel'));
    if (!panels.length) return;

    var L = book.lang === 'en'
      ? { search: 'Search the book', toc: 'Contents', none: 'No match', hits: ' hits', chapter: 'Chapter', section: 'Section', sections: 'sections', menu: 'Chapters', draft: 'Draft' }
      : { search: '搜索全书', toc: '目录', none: '没有匹配', hits: ' 处', chapter: '第', section: '第', sections: '节', menu: '章节', draft: '草稿' };

    var layout = document.querySelector('.am-doc-layout');
    var body = document.querySelector('.am-doc-body');
    var doc = document.querySelector('.am-doc');
    var current = 0;
    var timer = 0;

    function esc(s) {
      return String(s).replace(/[&<>\"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c];
      });
    }

    function chapterTitle(chapter) {
      return book.lang === 'en'
        ? L.chapter + ' ' + chapter.n + '. ' + chapter.name
        : L.chapter + chapter.n + '章 ' + chapter.name;
    }

    function sectionLabel(unit) {
      return book.lang === 'en'
        ? L.section + ' ' + unit.section
        : L.section + unit.section + '节';
    }

    function chapterCount(chapter) {
      return book.lang === 'en'
        ? chapter.count + (chapter.count === 1 ? ' section included' : ' sections included')
        : '已收录 ' + chapter.count + ' ' + L.sections;
    }

    function sectionTitle(unit) {
      return book.lang === 'en'
        ? L.section + ' ' + unit.section + '. ' + unit.title
        : L.section + unit.section + '节 ' + unit.title;
    }

    var style = document.createElement('style');
    style.textContent = [
      ':root { --bk-bar: 52px; }',
      'body { padding-top: var(--bk-bar); }',
      '.am-doc { max-width: 1440px; padding-top: 4px; }',
      '.am-doc > header { display: none !important; }',
      '.am-doc-layout, .am-doc-layout--notoc { grid-template-columns: 232px minmax(0, 1fr) 208px !important; max-width: none !important; gap: 28px !important; align-items: start; }',
      '.am-toc { display: none !important; }',
      '.am-toolbar { top: 10px !important; z-index: 30 !important; }',
      '.bk-top { position: fixed; top: 0; left: 0; right: 0; height: var(--bk-bar); z-index: 25; display: flex; align-items: center; gap: 16px; padding: 0 24px; background: var(--paper); border-bottom: 1px solid var(--line-2); }',
      '.am-toolbar .am-btn { display: none !important; }',
      '.am-panel-id, .am-comment-btn { display: none !important; }',
      '.am-doc-body .am-panel { border: 0 !important; background: transparent !important; border-radius: 0 !important; padding: 0 !important; }',
      '.am-doc-body .am-panel + .am-panel { margin-top: 0; }',
      '.am-doc-body .am-panel-head { padding-bottom: 12px; margin-bottom: 20px; }',
      '.am-doc-body .am-panel-head h2 { font-size: 24px; font-weight: 650; line-height: 1.3; }',
      '.am-doc-body .am-md h3 { font-size: 18px; font-weight: 650; margin-top: 28px; }',
      '.am-doc-body .am-md h3:first-child { margin-top: 0; }',
      '.am-doc-body .am-md h4 { font-size: 16px; font-weight: 600; margin-top: 20px; }',
      '.bk-context { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin: 0 0 8px; font-size: 13px; }',
      '.bk-context-chapter { color: var(--ink-2); font-weight: 600; }',
      '.bk-context-section { color: var(--ink-3); white-space: nowrap; }',
      '.bk-title { flex: 0 1 auto; min-width: 0; font-weight: 650; font-size: 15px; color: var(--ink); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.bk-search { position: relative; margin-left: 18px; }',
      '.bk-search input { width: 210px; height: 30px; padding: 0 10px; border: 1px solid var(--line-2); border-radius: 6px; background: var(--bg); color: var(--ink); font: inherit; font-size: 13px; }',
      '.bk-results { position: absolute; top: 36px; right: 0; width: min(300px, calc(100vw - 24px)); margin: 0; padding: 4px; list-style: none; background: var(--paper); border: 1px solid var(--line-2); border-radius: 8px; box-shadow: 0 10px 28px rgba(0,0,0,.14); max-height: 60vh; overflow: auto; z-index: 40; }',
      '.bk-results li { padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--ink); }',
      '.bk-results li:hover { background: var(--fill); }',
      '.bk-results .bk-n { color: var(--ink-3); font-size: 12px; margin-left: 6px; }',
      '.bk-nav { position: sticky; top: calc(var(--bk-bar) + 16px); max-height: calc(100vh - var(--bk-bar) - 40px); overflow: auto; font-size: 13px; padding-right: 6px; }',
      '.bk-ch { margin: 0 0 12px; }',
      '.bk-ch > summary { cursor: pointer; font-weight: 600; color: var(--ink); padding: 3px 0; }',
      '.bk-ch > summary::marker { color: var(--ink-3); }',
      '.bk-ch-count { color: var(--ink-3); font-size: 11px; font-weight: 400; margin-left: 6px; white-space: nowrap; }',
      '.bk-draft { color: var(--ink-3); border: 1px solid var(--line-2); border-radius: 4px; padding: 0 4px; margin-left: 6px; font-size: 11px; letter-spacing: .02em; vertical-align: middle; text-transform: uppercase; }',
      '.bk-u { display: block; padding: 4px 0 4px 12px; margin-left: 2px; color: var(--ink-2); text-decoration: none; border-left: 2px solid var(--line-2); }',
      '.bk-u:hover { color: var(--ink); }',
      '.bk-u.on { color: var(--accent); border-left-color: var(--accent); font-weight: 600; }',
      '.bk-toc { position: sticky; top: calc(var(--bk-bar) + 16px); max-height: calc(100vh - var(--bk-bar) - 40px); overflow: auto; font-size: 12.5px; }',
      '.bk-toc-t { color: var(--ink-3); margin-bottom: 6px; }',
      '.bk-h { display: block; padding: 3px 0; color: var(--ink-2); text-decoration: none; }',
      '.bk-h.lv2 { padding-left: 12px; font-size: 12px; }',
      '.bk-h:hover, .bk-h.on { color: var(--accent); }',
      '.bk-mobile { display: none; position: relative; }',
      '.bk-mobile > summary { list-style: none; cursor: pointer; color: var(--ink); font-size: 12px; padding: 6px 8px; border: 1px solid var(--line-2); border-radius: 6px; white-space: nowrap; }',
      '.bk-mobile > summary::-webkit-details-marker { display: none; }',
      '.bk-mobile-list { position: absolute; top: calc(100% + 8px); right: 0; width: min(300px, calc(100vw - 24px)); max-height: calc(100vh - var(--bk-bar) - 24px); overflow: auto; padding: 12px; background: var(--paper); border: 1px solid var(--line-2); border-radius: 8px; box-shadow: 0 10px 28px rgba(0,0,0,.14); z-index: 40; }',
      '.bk-nav-mobile { position: static; max-height: none; overflow: visible; padding-right: 0; }',
      '.am-panel[hidden] { display: none !important; }',
      '@media print { .bk-nav, .bk-toc, .bk-top, .am-toolbar { display: none !important; } body { padding-top: 0; } .am-panel[hidden] { display: block !important; } }',
      '@media (max-width: 1100px) { .bk-toc { display: none; } .am-doc-layout, .am-doc-layout--notoc { grid-template-columns: 200px minmax(0, 1fr) !important; } }',
      '@media (max-width: 800px) { .bk-top { gap: 8px; padding: 0 12px; } .bk-title { flex: 1 1 0; } .bk-search { margin-left: auto; } .bk-search input { width: clamp(88px, 34vw, 150px); } .bk-mobile { display: block; } .bk-nav { display: none; } .bk-nav-mobile { display: block; } .am-doc-layout, .am-doc-layout--notoc { grid-template-columns: minmax(0, 1fr) !important; } .bk-context { flex-wrap: wrap; } .bk-context-section { white-space: normal; } }'
    ].join('\n');
    document.head.appendChild(style);

    if (doc) {
      var header = doc.querySelector(':scope > header');
      if (header) header.style.display = 'none';
    }

    var top = document.createElement('header');
    top.className = 'bk-top';
    top.innerHTML =
      '<a class="bk-title" href="#' + esc(panels[0].id) + '">' + esc(book.title) + '</a>' +
      '<div class="bk-search"><input id="bk-q" type="search" placeholder="' + L.search + '" aria-label="' + L.search + '"><ul id="bk-results" class="bk-results" hidden></ul></div>' +
      '<details class="bk-mobile"><summary>' + L.menu + '</summary><div class="bk-mobile-list"><nav class="bk-nav bk-nav-mobile"></nav></div></details>';
    document.body.appendChild(top);

    var nav = document.createElement('nav');
    nav.className = 'bk-nav';
    var groups = (book.chapters || []).map(function (chapter) { return { chapter: chapter, units: [] }; });
    book.units.forEach(function (u) {
      for (var i = 0; i < groups.length; i++) {
        if (groups[i].chapter.n === u.chapter) {
          groups[i].units.push(u);
          break;
        }
      }
    });

    function draftTag(u) {
      return u.status === 'draft' ? '<span class="bk-draft">' + esc(L.draft) + '</span>' : '';
    }

    function link(u) {
      var index = Number(u.index);
      return '<a class="bk-u" href="#' + esc(panels[index].id) + '" data-i="' + esc(index) + '">' +
        esc(sectionTitle(u)) + draftTag(u) + '</a>';
    }

    var navHtml = '';
    groups.forEach(function (g) {
      if (!g.units.length) return;
      navHtml += '<details class="bk-ch" open><summary>' + esc(chapterTitle(g.chapter)) +
        '<span class="bk-ch-count">' + esc(chapterCount(g.chapter)) + '</span></summary>' +
        g.units.map(link).join('') + '</details>';
      g.units.forEach(function (u) {
        var panel = panels[Number(u.index)];
        var context = document.createElement('div');
        context.className = 'bk-context';
        var chapter = document.createElement('span');
        chapter.className = 'bk-context-chapter';
        chapter.textContent = chapterTitle(g.chapter);
        var section = document.createElement('span');
        section.className = 'bk-context-section';
        section.innerHTML = esc(sectionLabel(u)) + draftTag(u);
        context.appendChild(chapter);
        context.appendChild(section);
        var heading = panel.querySelector('.am-panel-head');
        panel.insertBefore(context, heading || panel.firstChild);
      });
    });
    nav.innerHTML = navHtml;
    layout.insertBefore(nav, body);
    var mobileNav = top.querySelector('.bk-nav-mobile');
    mobileNav.innerHTML = navHtml;
    var mobileMenu = top.querySelector('.bk-mobile');

    var toc = document.createElement('aside');
    toc.className = 'bk-toc';
    layout.appendChild(toc);

    function buildToc(i) {
      var heads = [].slice.call(panels[i].querySelectorAll('h3, h4'));
      if (!heads.length) { toc.innerHTML = ''; toc.hidden = true; return; }
      toc.hidden = false;
      toc.innerHTML = '<div class="bk-toc-t">' + L.toc + '</div>' + heads.map(function (h, k) {
        if (!h.id) h.id = panels[i].id + '-h' + k;
        return '<a class="bk-h' + (h.tagName === 'H4' ? ' lv2' : '') + '" href="#' + esc(h.id) + '" data-t="' + esc(h.id) + '">' + esc(h.textContent) + '</a>';
      }).join('');
    }

    function show(i, silent) {
      current = i;
      panels.forEach(function (p, j) { p.hidden = j !== i; });
      [nav, mobileNav].forEach(function (menu) {
        [].forEach.call(menu.querySelectorAll('.bk-u'), function (a) {
          a.classList.toggle('on', Number(a.dataset.i) === i);
        });
      });
      buildToc(i);
      if (!silent) history.replaceState(null, '', '#' + panels[i].id);
      window.scrollTo(0, 0);
      spy();
    }

    function bindNavigation(menu, isMobile) {
      menu.addEventListener('click', function (e) {
        var a = e.target.closest('.bk-u');
        if (!a) return;
        e.preventDefault();
        show(Number(a.dataset.i));
        if (isMobile) mobileMenu.open = false;
      });
    }

    bindNavigation(nav, false);
    bindNavigation(mobileNav, true);

    toc.addEventListener('click', function (e) {
      var a = e.target.closest('.bk-h');
      if (!a) return;
      e.preventDefault();
      var h = document.getElementById(a.dataset.t);
      if (h) h.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });

    function spy() {
      var heads = [].slice.call(panels[current].querySelectorAll('h3, h4'));
      if (!heads.length) return;
      var line = window.scrollY + 120;
      var active = heads[0];
      heads.forEach(function (h) { if (h.getBoundingClientRect().top + window.scrollY <= line) active = h; });
      [].forEach.call(toc.querySelectorAll('.bk-h'), function (a) {
        a.classList.toggle('on', a.dataset.t === active.id);
      });
    }

    window.addEventListener('scroll', function () {
      clearTimeout(timer);
      timer = setTimeout(spy, 90);
    }, { passive: true });

    var q = document.getElementById('bk-q');
    var results = document.getElementById('bk-results');

    q.addEventListener('input', function () {
      var term = q.value.trim();
      if (term.length < 2) { results.hidden = true; results.innerHTML = ''; return; }
      var lower = term.toLowerCase();
      var hits = [];
      book.units.forEach(function (u) {
        var text = panels[u.index].textContent.toLowerCase();
        var n = text.split(lower).length - 1;
        if (n) hits.push({ u: u, n: n });
      });
      if (!hits.length) {
        results.innerHTML = '<li>' + L.none + '</li>';
      } else {
        results.innerHTML = hits.slice(0, 8).map(function (h) {
          return '<li data-i="' + esc(h.u.index) + '">' + esc(sectionTitle(h.u)) +
            '<span class="bk-n">' + h.n + L.hits + '</span></li>';
        }).join('');
      }
      results.hidden = false;
    });

    results.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-i]');
      if (!li) return;
      var i = Number(li.dataset.i);
      var term = q.value.trim();
      show(i);
      results.hidden = true;
      // shortcut: window.find is Chromium-only and jumps to the first match;
      // the unit still opens when the host lacks it.
      setTimeout(function () {
        try { window.find(term, false, false, true); } catch (err) { /* no jump */ }
      }, 60);
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.bk-search')) results.hidden = true;
    });

    var start = 0;
    var hash = decodeURIComponent(location.hash.slice(1));
    for (var i = 0; i < panels.length; i++) if (panels[i].id === hash) start = i;
    show(start, !hash);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  function boot() {
    try { init(); } catch (e) { console.error('[book]', e); }
  }
})();
