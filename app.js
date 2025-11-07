"use strict";

// -----------------------------
// Theme: Auto Day/Night with Sunrise/Sunset
// -----------------------------

/**
 * Lightweight sunrise/sunset calculation (approximate)
 * Based on common solar position approximations; adequate for theming.
 */
function computeSunTimes(lat, lng, date = new Date()) {
  const rad = Math.PI / 180;
  const dayMs = 24 * 60 * 60 * 1000;

  function toJulian(d) {
    return d / dayMs - 0.5 + 2440587.5;
  }
  function fromJulian(j) {
    return (j + 0.5 - 2440587.5) * dayMs;
  }
  function solarMeanAnomaly(d) {
    return rad * (357.5291 + 0.98560028 * d);
  }
  function eclipticLongitude(M) {
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const P = rad * 102.9372;
    return M + C + P + Math.PI;
  }
  function declination(L) {
    return Math.asin(Math.sin(L) * Math.sin(rad * 23.4397));
  }
  function julianCycle(d, lw) {
    return Math.round(d - lw / (2 * Math.PI));
  }
  function approxTransit(Ht, L, lw, n) {
    return 0.0009 + (Ht + lw) / (2 * Math.PI) + n;
  }
  function hourAngle(h, phi, dec) {
    return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  }
  function getSetJ(h, lw, phi, dec, n, M, L) {
    const w = hourAngle(h, phi, dec);
    const a = approxTransit(w, L, lw, n);
    const Jset = 2451545 + d + a;
    const Jrise = Jset - (w * 2) / (2 * Math.PI);
    return { Jrise, Jset };
  }

  const lw = rad * -lng;
  const phi = rad * lat;

  const localMidnight = new Date(date);
  localMidnight.setHours(0, 0, 0, 0);
  const d = toJulian(localMidnight) - 2451545;

  const n = julianCycle(d, lw);
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const h = rad * -0.833;

  const { Jrise, Jset } = getSetJ(h, lw, phi, dec, n, M, L);
  const sunrise = new Date(fromJulian(Jrise));
  const sunset = new Date(fromJulian(Jset));
  return { sunrise, sunset };
}

function debounce(fn, wait = 250) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

const Theme = (function () {
  let mode = localStorage.getItem('themeMode') || 'auto';
  let sunTimes = null;
  let nextTimer = null;

  function isNight(date = new Date()) {
    if (sunTimes && sunTimes.sunrise && sunTimes.sunset) {
      const now = date.getTime();
      return now < sunTimes.sunrise.getTime() || now >= sunTimes.sunset.getTime();
    }
    // Default 06:00 → 18:00
    const d = new Date(date);
    const sunrise = new Date(d); sunrise.setHours(6, 0, 0, 0);
    const sunset = new Date(d); sunset.setHours(18, 0, 0, 0);
    const now = d.getTime();
    return now < sunrise.getTime() || now >= sunset.getTime();
  }

  // In Theme module: applyTheme()
  function applyTheme(night) {
      const html = document.documentElement;
      const body = document.body;
      html.classList.toggle('theme-night', night);
      html.classList.toggle('theme-day', !night);
      // Synchronize Tailwind dark mode with custom theme
      html.classList.toggle('dark', night);
      if (body) {
        body.classList.toggle('theme-night', night);
        body.classList.toggle('theme-day', !night);
      }
      localStorage.setItem('themeLast', night ? 'night' : 'day');
  
      const toggle = document.getElementById('themeToggle');
      if (toggle) {
        toggle.setAttribute('aria-checked', (!night).toString());
        toggle.textContent = night ? '🌜' : '🌞';
      }
  
      triggerIconAnimation(night ? 'moon' : 'sun');
      updateBadgesVisibility(night);
  }

  function triggerIconAnimation(which) {
    const el = which === 'sun' ? document.getElementById('sunBadge') : document.getElementById('moonBadge');
    const cls = which === 'sun' ? 'animate-sun-rise' : 'animate-moon-rise';
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 700);
  }

  function updateBadgesVisibility(night) {
    const sun = document.getElementById('sunBadge');
    const moon = document.getElementById('moonBadge');
    if (sun) sun.style.opacity = night ? '0.2' : '1';
    if (moon) moon.style.opacity = night ? '1' : '0.2';
  }

  function scheduleNextSwitch() {
    if (nextTimer) {
      clearTimeout(nextTimer);
      nextTimer = null;
    }
    const next = nextSwitchTime();
    if (!next) return;
    const delay = Math.max(0, next.getTime() - Date.now());
    nextTimer = setTimeout(() => {
      if (mode === 'auto') {
        applyTheme(isNight());
        scheduleNextSwitch();
      }
    }, delay);
  }

  function nextSwitchTime() {
    const now = new Date();
    if (!sunTimes) return null;
    const { sunrise, sunset } = sunTimes;
    const nowMs = now.getTime();
    const sunriseMs = sunrise.getTime();
    const sunsetMs = sunset.getTime();
    const currentlyNight = nowMs < sunriseMs || nowMs >= sunsetMs;
    if (currentlyNight) {
      if (nowMs < sunriseMs) return sunrise;
      const t = new Date(sunrise);
      t.setDate(t.getDate() + 1);
      return t;
    } else {
      return sunset;
    }
  }

  function setMode(newMode) {
    mode = newMode;
    localStorage.setItem('themeMode', mode);
    document.documentElement.setAttribute('data-theme-mode', mode);
    if (mode === 'day') {
      applyTheme(false);
    } else if (mode === 'night') {
      applyTheme(true);
    } else {
      recalcTheme();
    }
  }

  const recalcTheme = debounce(function () {
    if (mode !== 'auto') return;
    const nowNight = isNight();
    applyTheme(nowNight);
    scheduleNextSwitch();
  }, 200);

  function initLocationAndTimes() {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        sunTimes = null;
        return resolve(false);
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            sunTimes = computeSunTimes(latitude, longitude, new Date());
            resolve(true);
          } catch {
            sunTimes = null;
            resolve(false);
          }
        },
        () => {
          sunTimes = null;
          resolve(false);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }
      );
    });
  }

  async function init() {
    document.documentElement.setAttribute('data-theme-mode', mode);

    // Error boundary / console check
    window.addEventListener('error', (e) => {
      console.error('Runtime error:', e.error || e.message);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled promise rejection:', e.reason);
    });

    // Controls: ARIA + keyboard
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        if (mode === 'auto') {
          const night = document.documentElement.classList.contains('theme-night');
          setMode(night ? 'day' : 'night');
        } else {
          setMode(mode === 'night' ? 'day' : 'night');
        }
      });
      toggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle.click();
        }
      });
    }

    const autoBtn = document.getElementById('autoMode');
    if (autoBtn) {
      autoBtn.addEventListener('click', () => setMode('auto'));
    }

    // Parallax drift on scroll (2–4px)
    const container = document.getElementById('todoContainer') || document.body;
    let raf = null;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const y = container.scrollTop || window.scrollY || 0;
        const drift = Math.max(2, Math.min(4, y * 0.02));
        const sun = document.getElementById('sunBadge');
        const moon = document.getElementById('moonBadge');
        if (sun) sun.style.transform = `translateY(${drift}px)`;
        if (moon) moon.style.transform = `translateY(${drift}px)`;
      });
    }
    container.addEventListener('scroll', onScroll, { passive: true });

    // Immediate render: default Day; geolocation updates async
    if (mode === 'auto') {
      applyTheme(false); // render Day by default
      // Async geolocation & sun times (won't block initial paint)
      setTimeout(async () => {
        await initLocationAndTimes();
        recalcTheme();
      }, 0);
    } else {
      applyTheme(mode === 'night');
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) recalcTheme();
    });
    window.addEventListener('resize', recalcTheme);
  }

  return {
    get mode() { return mode; },
    setMode,
    isNight,
    nextSwitchTime,
    _init: init
  };
})();

// Bootstrap theme after DOMContentLoaded (client-only)
document.addEventListener('DOMContentLoaded', () => {
  Theme._init();
});

// Expose Theme API globally for other components/tests
window.Theme = {
  get mode() { return Theme.mode; },
  setMode: Theme.setMode,
  isNight: Theme.isNight,
  nextSwitchTime: Theme.nextSwitchTime
};

const STATE_KEY = "todo_state_v1"; // new schema
const OLD_TASKS_KEY = "todo_tasks_v1"; // migration from old schema

// Helper: create element with classes/attrs/text
function el(tag, { classes = "", attrs = {}, text = "" } = {}) {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (text) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw);
    // Migrate from old tasks-only key
    const old = localStorage.getItem(OLD_TASKS_KEY);
    if (old) {
      const tasks = JSON.parse(old);
      return {
        tasks: tasks.map((t) => ({
          id: t.id,
          text: t.text,
          completed: !!t.completed,
          createdAt: Date.now(),
          dueDate: "",
          priority: "medium",
          tags: [],
        })),
        filter: "all",
        sort: "created",
        confirmDelete: false,
        darkMode: false,
        search: "",
        tagFilter: "",
      };
    }
    return {
      tasks: [],
      filter: "all",
      sort: "created", // created | due | priority | text
      confirmDelete: false,
      darkMode: false,
      search: "",
      tagFilter: "",
    };
  } catch {
    return {
      tasks: [],
      filter: "all",
      sort: "created",
      confirmDelete: false,
      darkMode: false,
      search: "",
      tagFilter: "",
    };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

// DOMContentLoaded UI builder: after mounting container
document.addEventListener("DOMContentLoaded", () => {
    const app = document.getElementById("app");

    // استخدم حاوية موجودة فعلاً في الصفحة: #todoContainer أو .app-content أو body
    const mount =
      document.getElementById("todoContainer") ||
      document.querySelector(".app-content") ||
      document.body;

    // Container (card)
    const container = el("div", {
      classes:
        "max-w-2xl mx-auto mt-12 p-6 bg-white/95 dark:bg-slate-900/60 backdrop-blur rounded-2xl shadow-lg border border-emerald-200 dark:border-emerald-700",
      attrs: { id: "todoCard", role: "region", "aria-label": "To-Do list" }, // تغيير المعرّف لتجنّب التكرار
    });

    // Header with title (use global header theme controls from index.html to avoid duplicates)
    const header = el("div", { classes: "flex items-center justify-between mb-4" });
    const title = el("h1", {
      classes: "text-2xl font-semibold text-emerald-700 dark:text-emerald-300",
      text: "To-Do List",
    });
    const headerRight = el("div", { classes: "flex items-center gap-2" });
    // Do not create local #themeToggle/#autoMode/#sunBadge/#moonBadge here — they already exist in index.html
    header.append(title, headerRight);

    // Search and sorting row
    const controlsRow = el("div", { classes: "grid grid-cols-1 md:grid-cols-3 gap-3 mb-4" });
    const searchInput = el("input", {
      classes:
        "w-full border border-emerald-300 dark:border-emerald-600 rounded-xl px-4 py-2 outline-none focus:ring focus:ring-emerald-200 dark:bg-slate-800 dark:text-slate-100",
      attrs: { type: "text", placeholder: "Search tasks or tags...", "aria-label": "Search" },
    });
    const sortSelect = el("select", {
      classes:
        "w-full border border-emerald-300 dark:border-emerald-600 rounded-xl px-3 py-2 dark:bg-slate-800 dark:text-slate-100",
      attrs: { "aria-label": "Sorting preference" },
    });
    [
      { v: "created", t: "Sort: Created" },
      { v: "due", t: "Sort: Due Date" },
      { v: "priority", t: "Sort: Priority" },
      { v: "text", t: "Sort: Task Text" },
    ].forEach(({ v, t }) => sortSelect.appendChild(el("option", { attrs: { value: v }, text: t })));

    const confirmDeleteToggle = el("label", { classes: "inline-flex items-center gap-2" });
    const confirmDeleteCheckbox = el("input", { attrs: { type: "checkbox" } });
    const confirmDeleteLabel = el("span", { classes: "text-slate-800 dark:text-slate-200", text: "Confirm deletes" });
    confirmDeleteToggle.append(confirmDeleteCheckbox, confirmDeleteLabel);

    controlsRow.append(searchInput, sortSelect, confirmDeleteToggle);

    // Add row: text, due date, priority, tags, add button
    const addRow = el("div", { classes: "grid grid-cols-1 md:grid-cols-5 gap-3 mb-4" });
    const input = el("input", {
      classes:
        "w-full border border-emerald-300 dark:border-emerald-600 rounded-xl px-4 py-2 outline-none focus:ring focus:ring-emerald-200 dark:bg-slate-800 dark:text-slate-100",
      attrs: { type: "text", placeholder: "Add a new task...", "aria-label": "Task text" },
    });
    const dueInput = el("input", {
      classes:
        "w-full border border-emerald-300 dark:border-emerald-600 rounded-xl px-3 py-2 dark:bg-slate-800 dark:text-slate-100",
      attrs: { type: "date", "aria-label": "Due date" },
    });
    const prioritySelect = el("select", {
      classes:
        "w-full border border-emerald-300 dark:border-emerald-600 rounded-xl px-3 py-2 dark:bg-slate-800 dark:text-slate-100",
      attrs: { "aria-label": "Priority" },
    });
    [
      { v: "low", t: "Low" },
      { v: "medium", t: "Medium" },
      { v: "high", t: "High" },
    ].forEach(({ v, t }) => prioritySelect.appendChild(el("option", { attrs: { value: v }, text: t })));
    prioritySelect.value = "medium";

    const tagsInput = el("input", {
      classes:
        "w-full border border-emerald-300 dark:border-emerald-600 rounded-xl px-3 py-2 dark:bg-slate-800 dark:text-slate-100",
      attrs: { type: "text", placeholder: "Tags (comma separated)", "aria-label": "Tags" },
    });
    const addBtn = el("button", {
      classes:
        "w-full md:w-auto px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 active:scale-[.99] transition",
      text: "Add Task",
      attrs: { "aria-label": "Add task" },
    });
    addRow.append(input, dueInput, prioritySelect, tagsInput, addBtn);

    // Filter and bulk actions row
    const filterRow = el("div", { classes: "flex flex-wrap items-center justify-between gap-2 mb-4" });
    const filterBtns = el("div", { classes: "inline-flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" });
    const btnAll = el("button", { classes: "px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100", text: "All" });
    const btnActive = el("button", { classes: "px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100", text: "Active" });
    const btnCompleted = el("button", { classes: "px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100", text: "Completed" });
    filterBtns.append(btnAll, btnActive, btnCompleted);
    const bulkRow = el("div", { classes: "inline-flex items-center gap-2" });
    const toggleAllBtn = el("button", { classes: "px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-600 text-slate-800 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-slate-800", text: "Toggle All" });
    const clearCompletedBtn = el("button", { classes: "px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-600 text-slate-800 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-slate-800", text: "Clear Completed" });
    bulkRow.append(toggleAllBtn, clearCompletedBtn);
    filterRow.append(filterBtns, bulkRow);

    // Tags quick filter row
    const tagsQuickRow = el("div", { classes: "flex flex-wrap gap-2 mb-4" });

    // Summary stats
    const summaryRow = el("div", { classes: "flex items-center justify-between mb-2" });
    const summaryText = el("div", { classes: "text-sm text-slate-700 dark:text-slate-300" });

    // List and empty state
    const list = el("ul", { classes: "space-y-2", attrs: { role: "list", "aria-live": "polite" } });
    const emptyState = el("div", { classes: "text-center text-slate-500 dark:text-slate-400 py-8 hidden" });
    emptyState.innerHTML = `
      <div class="flex flex-col items-center gap-2">
        <svg class="w-12 h-12 opacity-60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 7h10M7 12h10M7 17h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <p>No tasks yet. Add your first task above.</p>
      </div>`;

    container.append(header, controlsRow, addRow, filterRow, tagsQuickRow, summaryRow, list, emptyState);
    mount.appendChild(container);
    // Remove duplicate init; Theme is initialized globally once
    // Theme._init();

    // State
    let state = loadState();

    // Helper: update tags quick filter chips
    function refreshTagChips() {
      tagsQuickRow.innerHTML = "";
      const tagSet = new Set();
      state.tasks.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
      const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));
      if (tags.length === 0) return;
      tags.forEach((tag) => {
        const chip = el("button", {
          classes:
            `px-3 py-1 rounded-full text-sm border ${state.tagFilter === tag ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"}`,
          text: `#${tag}`,
        });
        chip.addEventListener("click", () => {
          state.tagFilter = state.tagFilter === tag ? "" : tag;
          render();
        });
        tagsQuickRow.appendChild(chip);
      });
      const clearChip = el("button", { classes: "px-3 py-1 rounded-full text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-100", text: "Clear tag filter" });
      clearChip.addEventListener("click", () => { state.tagFilter = ""; render(); });
      tagsQuickRow.appendChild(clearChip);
    }

    // Create a task <li>
    function makeTaskItem(task) {
      const li = el("li", {
        classes:
          "flex items-center justify-between gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-all duration-200",
        attrs: { draggable: "true" },
      });

      // Enter animation
      li.classList.add("opacity-0", "translate-y-1");
      requestAnimationFrame(() => li.classList.remove("opacity-0", "translate-y-1"));

      // Left side: checkbox + text + meta
      const left = el("div", { classes: "flex items-center gap-3 flex-1" });
      const checkbox = el("input", { attrs: { type: "checkbox", "aria-label": "Mark complete" } });
      checkbox.checked = !!task.completed;
      checkbox.addEventListener("change", () => {
        task.completed = checkbox.checked;
        render();
      });

      const textWrap = el("div", { classes: "flex-1" });
      const span = el("span", {
        classes: `text-slate-900 dark:text-slate-100 ${task.completed ? "line-through opacity-60" : ""}`,
        text: task.text,
      });
      // Inline editing on double-click
      span.addEventListener("dblclick", () => {
        const inputEdit = el("input", {
          classes:
            "w-full border border-emerald-300 dark:border-emerald-600 rounded-md px-2 py-1 dark:bg-slate-700 dark:text-slate-100",
          attrs: { type: "text" },
        });
        inputEdit.value = task.text;
        textWrap.replaceChild(inputEdit, span);
        inputEdit.focus();
        const commit = () => {
          const v = inputEdit.value.trim();
          if (v) task.text = v;
          textWrap.replaceChild(span, inputEdit);
          span.textContent = task.text;
          render();
        };
        const cancel = () => {
          textWrap.replaceChild(span, inputEdit);
        };
        inputEdit.addEventListener("keydown", (e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        });
        inputEdit.addEventListener("blur", commit);
      });

      const meta = el("div", { classes: "flex items-center gap-2 mt-1" });
      if (task.dueDate) meta.appendChild(el("span", { classes: "px-2 py-0.5 rounded-full text-xs bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100", text: task.dueDate }));
      const prioColor = task.priority === "high" ? "bg-red-500 text-white" : task.priority === "medium" ? "bg-amber-400 text-slate-900" : "bg-emerald-400 text-slate-900";
      meta.appendChild(el("span", { classes: `px-2 py-0.5 rounded-full text-xs ${prioColor}`, text: task.priority }));
      task.tags.forEach((tg) => meta.appendChild(el("span", { classes: "px-2 py-0.5 rounded-full text-xs border border-emerald-300 dark:border-emerald-600 text-slate-800 dark:text-slate-100", text: `#${tg}` })));

      textWrap.append(span, meta);
      left.append(checkbox, textWrap);

      // Right side: delete button and drag handle
      const right = el("div", { classes: "flex items-center gap-2" });
      const delBtn = el("button", {
        classes:
          "px-3 py-1 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 transition",
        text: "Delete",
        attrs: { "aria-label": "Delete task" },
      });
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const doDelete = () => {
          // Exit animation then remove
          li.classList.add("opacity-0", "translate-y-1");
          setTimeout(() => {
            state.tasks = state.tasks.filter((t) => t.id !== task.id);
            render();
          }, 150);
        };
        if (state.confirmDelete) {
          if (confirm("Delete this task?")) doDelete();
        } else {
          doDelete();
        }
      });
      const dragHandle = el("span", { classes: "cursor-grab text-slate-400 select-none", text: "⋮⋮" });

      right.append(delBtn, dragHandle);
      li.append(left, right);

      // Drag and drop reordering
      li.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("text/plain", task.id);
        ev.dataTransfer.effectAllowed = "move";
        li.classList.add("opacity-60");
      });
      li.addEventListener("dragend", () => li.classList.remove("opacity-60"));
      li.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
      });
      li.addEventListener("drop", (ev) => {
        ev.preventDefault();
        const srcId = ev.dataTransfer.getData("text/plain");
        if (!srcId || srcId === task.id) return;
        const fromIdx = state.tasks.findIndex((t) => t.id === srcId);
        const toIdx = state.tasks.findIndex((t) => t.id === task.id);
        if (fromIdx < 0 || toIdx < 0) return;
        const [moved] = state.tasks.splice(fromIdx, 1);
        state.tasks.splice(toIdx, 0, moved);
        render();
      });

      return li;
    }

    // Render the list and UI state
    function render() {
      // Theme toggle text is handled by Theme module

      // Update controls from state
      sortSelect.value = state.sort;
      confirmDeleteCheckbox.checked = state.confirmDelete;
      searchInput.value = state.search;

      // Filter buttons active styles
      [btnAll, btnActive, btnCompleted].forEach((b) => b.classList.remove("bg-emerald-600", "text-white"));
      const activeBtn = state.filter === "all" ? btnAll : state.filter === "active" ? btnActive : btnCompleted;
      activeBtn.classList.add("bg-emerald-600", "text-white");

      // Compute filtered tasks
      let filtered = state.tasks.slice();
      if (state.filter === "active") filtered = filtered.filter((t) => !t.completed);
      if (state.filter === "completed") filtered = filtered.filter((t) => t.completed);
      if (state.tagFilter) filtered = filtered.filter((t) => t.tags.includes(state.tagFilter));
      const q = state.search.trim().toLowerCase();
      if (q) filtered = filtered.filter((t) => t.text.toLowerCase().includes(q) || t.tags.some((tg) => tg.toLowerCase().includes(q)));

      // Sort
      const byPrio = { high: 2, medium: 1, low: 0 };
      filtered.sort((a, b) => {
        switch (state.sort) {
          case "due": {
            const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            return ad - bd;
          }
          case "priority":
            return byPrio[b.priority] - byPrio[a.priority];
          case "text":
            return a.text.localeCompare(b.text);
          case "created":
          default:
            return (b.createdAt || 0) - (a.createdAt || 0);
          }
        });

        // Summary
        const total = state.tasks.length;
        const active = state.tasks.filter((t) => !t.completed).length;
        const completed = total - active;
        summaryText.textContent = `Total: ${total} • Active: ${active} • Completed: ${completed}`;

        // List and empty state
        list.innerHTML = "";
        if (filtered.length === 0) {
          emptyState.classList.remove("hidden");
        } else {
          emptyState.classList.add("hidden");
          filtered.forEach((task) => list.appendChild(makeTaskItem(task)));
        }

        // Tag chips
        refreshTagChips();

        // Persist
        saveState(state);
      }

      // Initialize UI values
      sortSelect.value = state.sort;
      confirmDeleteCheckbox.checked = state.confirmDelete;
      searchInput.value = state.search;

      render();

      // Add logic + validation
      function onAdd() {
        const value = input.value.trim();
        if (!value) {
          alert("Please enter a task.");
          input.focus();
          return;
        }
        const tags = tagsInput.value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const newTask = {
          id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
          text: value,
          completed: false,
          createdAt: Date.now(),
          dueDate: dueInput.value || "",
          priority: prioritySelect.value || "medium",
          tags,
        };
        state.tasks.unshift(newTask);
        input.value = "";
        dueInput.value = "";
        prioritySelect.value = "medium";
        tagsInput.value = "";
        render();
        input.focus();
      }

      addBtn.addEventListener("click", onAdd);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") onAdd(); });

      // Controls handlers
      // Theme toggle is handled by Theme module via #themeToggle and #autoMode
      sortSelect.addEventListener("change", () => { state.sort = sortSelect.value; render(); });
      confirmDeleteCheckbox.addEventListener("change", () => { state.confirmDelete = confirmDeleteCheckbox.checked; render(); });
      searchInput.addEventListener("input", () => { state.search = searchInput.value; render(); });

      // Filter buttons
      btnAll.addEventListener("click", () => { state.filter = "all"; render(); });
      btnActive.addEventListener("click", () => { state.filter = "active"; render(); });
      btnCompleted.addEventListener("click", () => { state.filter = "completed"; render(); });

      // Bulk actions
      toggleAllBtn.addEventListener("click", () => {
        const anyActive = state.tasks.some((t) => !t.completed);
        state.tasks.forEach((t) => (t.completed = anyActive));
        render();
      });
      clearCompletedBtn.addEventListener("click", () => {
        state.tasks = state.tasks.filter((t) => !t.completed);
        render();
      });
});
