(() => {
  const book = window.HCES_BOOK;
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  const storageKey = book?.storageKey || "solvequest.truth.hces.reader";
  const settingsVersion = 5;
  const fontSizes = [12, 14, 16, 17, 19, 21, 23, 26, 29, 32, 36, 40, 45, 50];
  const lineHeights = [1.35, 1.5, 1.65, 1.8, 1.9, 2.05, 2.2, 2.4, 2.6];
  const fontWeights = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900];
  const textAlphas = [0.45, 0.55, 0.65, 0.75, 0.85, 0.92, 1];
  const paddingSizes = [20, 24, 28, 32, 38, 46, 54, 64, 78, 92, 108, 124];
  const continuousRenderCount = 3;
  const sliderToolbarLockMs = 1200;
  const sliderCommitDelayMs = 60;
  const sliderLoadingMinMs = 320;
  const fontFamilies = {
    pmingliu: "\"PMingLiU\", \"新細明體\", serif",
    sans: "\"PingFang TC\", \"Microsoft JhengHei\", \"Noto Sans TC\", sans-serif",
  };

  const els = {
    body: document.body,
    toc: document.getElementById("toc"),
    tocToggle: document.getElementById("tocToggle"),
    tocClose: document.getElementById("tocClose"),
    tocBackdrop: document.getElementById("tocBackdrop"),
    tocSignature: document.querySelector(".library-signature"),
    chapterSearch: document.getElementById("chapterSearch"),
    chapterCount: document.getElementById("chapterCount"),
    readerShell: document.querySelector(".reader-shell"),
    readerHeader: document.querySelector(".reader-header"),
    desktopBookTitle: document.querySelector(".desktop-book-title"),
    topbarBookTitle: document.querySelector(".topbar-book-title"),
    readerLoading: document.getElementById("readerLoading"),
    bookContent: document.getElementById("bookContent"),
    bookPosition: document.querySelector(".book-position"),
    currentChapter: document.getElementById("currentChapter"),
    bookPercent: document.getElementById("bookPercent"),
    fontFamilySelect: document.getElementById("fontFamilySelect"),
    styleButtons: document.getElementById("styleButtons"),
    paddingDown: document.getElementById("paddingDown"),
    paddingUp: document.getElementById("paddingUp"),
    fontWeightDown: document.getElementById("fontWeightDown"),
    fontWeightUp: document.getElementById("fontWeightUp"),
    textAlphaDown: document.getElementById("textAlphaDown"),
    textAlphaUp: document.getElementById("textAlphaUp"),
    prevChapter: document.getElementById("prevChapter"),
    nextChapter: document.getElementById("nextChapter"),
    fontDown: document.getElementById("fontDown"),
    fontUp: document.getElementById("fontUp"),
    lineHeightDown: document.getElementById("lineHeightDown"),
    lineHeightUp: document.getElementById("lineHeightUp"),
    sliderToggle: document.getElementById("sliderToggle"),
    readingModeSelect: document.getElementById("readingModeSelect"),
    bookSlider: document.getElementById("bookSlider"),
    themeSelect: document.getElementById("themeSelect"),
  };

  const state = loadState();
  const continuousWindow = { start: 0, end: -1 };
  const chapterHeights = [];
  const chapterHtmlCache = new Map();
  let sliderFrame = 0;
  let sliderCommitTimer = 0;
  let pendingSliderRatio = null;
  let lastCommittedSliderRatio = null;
  let readerLoadingTimer = 0;
  let readerLoadingToken = 0;
  let scrollFrame = 0;
  let saveTimer = 0;
  let windowShiftTimer = 0;
  let pendingWindowCenter = null;
  let continuousLayoutSignature = "";
  let continuousLayoutTimer = 0;
  let pendingContinuousLayoutAnchor = null;
  let isContinuousLayoutRefreshing = false;
  let isSliderInteracting = false;
  let sliderInteractionUntil = 0;
  let sliderInteractionTimer = 0;
  let toolbarScrollY = Math.max(els.readerShell.scrollTop, 0);
  const customSelectControls = [];

  if (!book || !Array.isArray(book.chapters) || book.chapters.length === 0) {
    els.bookContent.innerHTML = "<h2>找不到書籍資料</h2>";
    return;
  }

  els.chapterCount.textContent = `${book.chapters.length} 章`;
  els.bookSlider.max = String(book.chapters.length * 1000);
  els.themeSelect.value = state.theme;
  els.readingModeSelect.value = state.readingMode;
  setupCustomSelects();
  applyReaderSettings();
  renderToc();
  renderReader(state.chapter, { restoreScroll: true });
  bindEvents();

  function loadState() {
    const fallback = {
      settingsVersion,
      chapter: 0,
      fontIndex: 2,
      lineHeightIndex: 4,
      fontFamily: "sans",
      fontWeightIndex: 6,
      textAlphaIndex: textAlphas.length - 1,
      paddingIndex: 3,
      theme: "paper",
      readingMode: "continuous",
      sliderVisible: true,
      scrollRatio: 0,
      chapterScrollRatio: 0,
      search: "",
    };

    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      Object.assign(fallback, stored || {});
    } catch {
      localStorage.removeItem(storageKey);
    }

    const hashIndex = getIndexFromHash();
    if (hashIndex >= 0) {
      fallback.chapter = hashIndex;
      fallback.scrollRatio = 0;
      fallback.chapterScrollRatio = 0;
    }

    if (fallback.settingsVersion !== settingsVersion && fallback.fontFamily === "pmingliu") {
      fallback.fontFamily = "sans";
    }
    if (fallback.settingsVersion < 3) {
      const oldFontWeights = [300, 350, 400, 450, 500, 600, 700];
      const oldWeight = oldFontWeights[clamp(fallback.fontWeightIndex, 0, oldFontWeights.length - 1)] || 400;
      fallback.fontWeightIndex = fontWeights.indexOf(oldWeight);
    }
    if (fallback.settingsVersion < 4) {
      fallback.readingMode = "continuous";
      fallback.scrollRatio = 0;
      fallback.chapterScrollRatio = 0;
    }
    if (fallback.settingsVersion < 5 && fallback.paddingIndex === 5) {
      fallback.paddingIndex = 3;
    }
    fallback.settingsVersion = settingsVersion;
    fallback.chapter = clamp(fallback.chapter, 0, Number.MAX_SAFE_INTEGER);
    fallback.fontIndex = clamp(fallback.fontIndex, 0, fontSizes.length - 1);
    fallback.lineHeightIndex = clamp(fallback.lineHeightIndex, 0, lineHeights.length - 1);
    fallback.fontWeightIndex = clamp(fallback.fontWeightIndex, 0, fontWeights.length - 1);
    fallback.textAlphaIndex = clamp(fallback.textAlphaIndex, 0, textAlphas.length - 1);
    fallback.paddingIndex = clamp(fallback.paddingIndex, 0, paddingSizes.length - 1);
    if (!["continuous", "single"].includes(fallback.readingMode)) {
      fallback.readingMode = "continuous";
    }
    if (!fontFamilies[fallback.fontFamily]) {
      fallback.fontFamily = "sans";
    }
    return fallback;
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function scheduleSaveState() {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
      saveTimer = 0;
      saveState();
    }, 120);
  }

  function setupCustomSelects() {
    const roots = Array.from(document.querySelectorAll("[data-custom-select]"));

    roots.forEach((root) => {
      const select = root.querySelector("select");
      if (!select) {
        return;
      }

      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "custom-select-trigger";
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-label", select.getAttribute("aria-label") || "選擇");

      const menu = document.createElement("div");
      menu.className = "custom-select-menu";
      menu.setAttribute("role", "listbox");

      Array.from(select.options).forEach((option) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "custom-select-option";
        item.dataset.value = option.value;
        item.setAttribute("role", "option");
        item.textContent = option.textContent;

        item.addEventListener("click", (event) => {
          event.stopPropagation();
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          closeCustomSelects();
          syncCustomSelects();
        });

        menu.append(item);
      });

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const shouldOpen = !root.classList.contains("is-open");
        showToolbar();
        closeCustomSelects(root);
        root.classList.toggle("is-open", shouldOpen);
        syncCustomSelects();
      });

      root.append(trigger, menu);
      root.classList.add("is-ready");
      customSelectControls.push({ root, select, trigger, menu });
    });

    document.addEventListener("click", () => closeCustomSelects());
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeCustomSelects();
      }
    });

    syncCustomSelects();
  }

  function closeCustomSelects(exceptRoot) {
    customSelectControls.forEach(({ root }) => {
      if (root !== exceptRoot) {
        root.classList.remove("is-open");
      }
    });
    syncCustomSelects();
  }

  function syncCustomSelects() {
    customSelectControls.forEach(({ root, select, trigger, menu }) => {
      const selected = select.options[select.selectedIndex] || select.options[0];
      const isOpen = root.classList.contains("is-open");

      trigger.textContent = selected ? selected.textContent : "";
      trigger.setAttribute("aria-expanded", String(isOpen));

      Array.from(menu.children).forEach((item) => {
        const isSelected = item.dataset.value === select.value;
        item.classList.toggle("is-selected", isSelected);
        item.setAttribute("aria-selected", String(isSelected));
      });
    });
  }

  function bindEvents() {
    els.prevChapter.addEventListener("click", () => goToChapter(state.chapter - 1));
    els.nextChapter.addEventListener("click", () => {
      if (isContinuous() || state.chapter === book.chapters.length - 1) {
        window.location.href = "../../index.html";
        return;
      }

      goToChapter(state.chapter + 1);
    });

    els.fontFamilySelect.addEventListener("change", () => {
      state.fontFamily = els.fontFamilySelect.value;
      applyReaderSettings();
      saveState();
    });

    els.paddingDown.addEventListener("click", () => {
      state.paddingIndex = clamp(state.paddingIndex - 1, 0, paddingSizes.length - 1);
      applyReaderSettings();
      saveState();
    });

    els.paddingUp.addEventListener("click", () => {
      state.paddingIndex = clamp(state.paddingIndex + 1, 0, paddingSizes.length - 1);
      applyReaderSettings();
      saveState();
    });

    els.fontWeightDown.addEventListener("click", () => {
      state.fontWeightIndex = clamp(state.fontWeightIndex - 1, 0, fontWeights.length - 1);
      applyReaderSettings();
      saveState();
    });

    els.fontWeightUp.addEventListener("click", () => {
      state.fontWeightIndex = clamp(state.fontWeightIndex + 1, 0, fontWeights.length - 1);
      applyReaderSettings();
      saveState();
    });

    els.textAlphaDown.addEventListener("click", () => {
      state.textAlphaIndex = clamp(state.textAlphaIndex - 1, 0, textAlphas.length - 1);
      applyReaderSettings();
      saveState();
    });

    els.textAlphaUp.addEventListener("click", () => {
      state.textAlphaIndex = clamp(state.textAlphaIndex + 1, 0, textAlphas.length - 1);
      applyReaderSettings();
      saveState();
    });

    els.fontDown.addEventListener("click", () => {
      state.fontIndex = clamp(state.fontIndex - 1, 0, fontSizes.length - 1);
      applyReaderSettings();
      saveState();
    });

    els.fontUp.addEventListener("click", () => {
      state.fontIndex = clamp(state.fontIndex + 1, 0, fontSizes.length - 1);
      applyReaderSettings();
      saveState();
    });

    els.lineHeightDown.addEventListener("click", () => {
      state.lineHeightIndex = clamp(state.lineHeightIndex - 1, 0, lineHeights.length - 1);
      applyReaderSettings();
      saveState();
    });

    els.lineHeightUp.addEventListener("click", () => {
      state.lineHeightIndex = clamp(state.lineHeightIndex + 1, 0, lineHeights.length - 1);
      applyReaderSettings();
      saveState();
    });

    els.sliderToggle.addEventListener("click", () => {
      state.sliderVisible = !state.sliderVisible;
      applyReaderSettings();
      saveState();
    });

    els.themeSelect.addEventListener("change", () => {
      state.theme = els.themeSelect.value;
      applyReaderSettings();
      saveState();
    });

    els.readingModeSelect.addEventListener("change", () => {
      state.readingMode = els.readingModeSelect.value;
      renderReader(state.chapter, { restoreScroll: true });
    });

    els.bookSlider.addEventListener("pointerdown", beginSliderInteraction);
    els.bookSlider.addEventListener("pointermove", extendSliderInteraction);
    els.bookSlider.addEventListener("pointerup", finishSliderInteraction);
    els.bookSlider.addEventListener("pointercancel", finishSliderInteraction);
    els.bookSlider.addEventListener("touchstart", beginSliderInteraction, { passive: true });
    els.bookSlider.addEventListener("touchmove", extendSliderInteraction, { passive: true });
    els.bookSlider.addEventListener("touchend", finishSliderInteraction, { passive: true });
    els.bookSlider.addEventListener("touchcancel", finishSliderInteraction, { passive: true });
    els.bookSlider.addEventListener("keydown", extendSliderInteraction);
    els.bookSlider.addEventListener("keyup", finishSliderInteraction);
    els.bookSlider.addEventListener("focus", extendSliderInteraction);
    els.bookSlider.addEventListener("blur", finishSliderInteraction);
    els.bookSlider.addEventListener("input", handleBookSliderInput);
    els.bookSlider.addEventListener("change", () => {
      handleBookSliderInput();
      finishSliderInteraction();
    });

    function handleBookSliderInput() {
      extendSliderInteraction();
      const ratio = Number(els.bookSlider.value) / Number(els.bookSlider.max);

      if (
        !isSliderInteracting &&
        pendingSliderRatio === null &&
        lastCommittedSliderRatio !== null &&
        Math.abs(ratio - lastCommittedSliderRatio) < 1 / Number(els.bookSlider.max)
      ) {
        return;
      }

      pendingSliderRatio = clamp(ratio, 0, 1);
      if (sliderFrame) {
        cancelAnimationFrame(sliderFrame);
      }

      sliderFrame = requestAnimationFrame(() => {
        sliderFrame = 0;
        previewBookPosition(pendingSliderRatio);
      });
    }

    els.chapterSearch.addEventListener("input", () => {
      state.search = els.chapterSearch.value.trim();
      renderToc();
    });

    els.tocToggle.addEventListener("click", () => {
      showToolbar();
      const isOpen = els.body.classList.toggle("toc-open");
      els.tocToggle.setAttribute("aria-expanded", String(isOpen));
    });

    els.tocClose.addEventListener("click", closeToc);
    els.tocBackdrop.addEventListener("click", closeToc);

    els.readerShell.addEventListener("scroll", () => {
      if (scrollFrame) {
        return;
      }

      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        handleScroll();
      });
    }, { passive: true });

    window.addEventListener("keydown", (event) => {
      if (event.target.matches("input, select, button")) {
        return;
      }

      if (event.key === "ArrowLeft") {
        goToChapter(state.chapter - 1);
      }

      if (event.key === "ArrowRight") {
        goToChapter(state.chapter + 1);
      }
    });

    window.addEventListener("hashchange", () => {
      const hashIndex = getIndexFromHash();
      if (hashIndex >= 0 && hashIndex !== state.chapter) {
        renderReader(hashIndex);
      }
    });

    window.addEventListener("resize", () => {
      scheduleContinuousLayoutRefresh();
      updateTocEndSpace();
    }, { passive: true });

    document.addEventListener("touchmove", (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    }, { passive: false });

    ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
    });
  }

  function renderToc() {
    const query = state.search.toLowerCase();
    els.chapterSearch.value = state.search;
    els.toc.innerHTML = "";

    const matches = book.chapters
      .map((chapter, index) => ({ chapter, index }))
      .filter(({ chapter }) => {
        const haystack = `${chapter.number} ${chapter.title}`.toLowerCase();
        return !query || haystack.includes(query);
      });

    if (matches.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "沒有符合的章節";
      els.toc.append(empty);
      els.toc.style.setProperty("--toc-end-space", "0px");
      return;
    }

    matches.forEach(({ chapter, index }) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      const number = document.createElement("small");
      const title = document.createElement("span");

      number.textContent = `第 ${chapter.number} 章`;
      title.textContent = chapter.title;
      button.type = "button";
      button.dataset.chapterIndex = String(index);
      button.setAttribute("aria-current", String(index === state.chapter));
      button.append(number, title);
      button.addEventListener("click", () => goToChapter(index));
      li.append(button);
      els.toc.append(li);
    });

    updateTocEndSpace();
  }

  function updateTocEndSpace() {
    requestAnimationFrame(() => {
      const items = Array.from(els.toc.children);
      if (items.length < 3) {
        els.toc.style.setProperty("--toc-end-space", "0px");
        return;
      }

      const thirdLast = items[items.length - 3];
      const last = items[items.length - 1];
      const signatureHeight = els.tocSignature ? els.tocSignature.offsetHeight : 0;
      const endSpace = Math.max(last.offsetTop - thirdLast.offsetTop - signatureHeight, 0);
      els.toc.style.setProperty("--toc-end-space", `${Math.ceil(endSpace)}px`);
    });
  }

  function closeToc() {
    els.body.classList.remove("toc-open");
    els.tocToggle.setAttribute("aria-expanded", "false");
  }

  function renderReader(index, options = {}) {
    if (isContinuous()) {
      renderContinuous(index, options);
    } else {
      renderSingle(index, options);
    }
  }

  function renderSingle(index, options = {}) {
    cancelContinuousWindowShift();
    cancelContinuousLayoutRefresh();
    const safeIndex = clamp(index, 0, book.chapters.length - 1);
    const chapter = book.chapters[safeIndex];

    state.chapter = safeIndex;
    document.title = `《${book.title}》`;
    els.body.dataset.readingMode = "single";
    els.bookContent.classList.remove("continuous");
    els.bookContent.innerHTML = getChapterHtml(chapter);
    updateChapterStatus(safeIndex);

    history.replaceState(null, "", `#${chapter.id}`);
    saveState();

    requestAnimationFrame(() => {
      if (options.restoreScroll && state.scrollRatio > 0) {
        const maxScroll = getMaxScroll();
        scrollReaderTo(maxScroll * state.scrollRatio);
      } else {
        scrollReaderTo(0);
        state.scrollRatio = 0;
        saveState();
      }
      updateProgress();
    });
  }

  function renderContinuous(index, options = {}) {
    cancelContinuousWindowShift();
    const safeIndex = clamp(index, 0, book.chapters.length - 1);
    const chapter = book.chapters[safeIndex];

    state.chapter = safeIndex;
    document.title = `《${book.title}》`;
    els.body.dataset.readingMode = "continuous";
    els.bookContent.classList.add("continuous");
    prepareContinuousLayout();
    renderContinuousWindow(safeIndex);
    updateChapterStatus(safeIndex);
    history.replaceState(null, "", `#${chapter.id}`);
    saveState();

    requestAnimationFrame(() => {
      if (options.restoreScroll && state.chapterScrollRatio > 0) {
        scrollToChapterRatio(safeIndex, state.chapterScrollRatio);
      } else {
        scrollToChapter(safeIndex, false);
      }

      syncChapterFromScroll();
      updateProgress();
    });
  }

  function goToChapter(index) {
    if (isContinuous()) {
      const safeIndex = clamp(index, 0, book.chapters.length - 1);
      renderContinuousWindow(safeIndex);
      scrollToChapter(safeIndex);
      updateChapterStatus(safeIndex);
      history.replaceState(null, "", `#${book.chapters[safeIndex].id}`);
      saveState();
    } else {
      renderSingle(index);
    }

    els.body.classList.remove("toc-open");
    els.tocToggle.setAttribute("aria-expanded", "false");
  }

  function applyReaderSettings() {
    const layoutAnchor = captureContinuousLayoutAnchor();
    document.documentElement.style.setProperty("--reader-font-size", `${fontSizes[state.fontIndex]}px`);
    document.documentElement.style.setProperty("--reader-line-height", String(lineHeights[state.lineHeightIndex]));
    document.documentElement.style.setProperty("--reader-font-family", fontFamilies[state.fontFamily]);
    document.documentElement.style.setProperty("--reader-font-weight", String(fontWeights[state.fontWeightIndex]));
    document.documentElement.style.setProperty("--reader-text-alpha", String(textAlphas[state.textAlphaIndex]));
    document.documentElement.style.setProperty("--reader-padding", `${paddingSizes[state.paddingIndex]}px`);
    els.fontFamilySelect.value = state.fontFamily;
    els.themeSelect.value = state.theme;
    els.readingModeSelect.value = state.readingMode;
    els.body.dataset.theme = state.theme;
    els.body.classList.toggle("slider-hidden", !state.sliderVisible);
    els.sliderToggle.setAttribute("aria-pressed", String(state.sliderVisible));
    els.bookPosition.setAttribute("aria-hidden", String(!state.sliderVisible));
    els.bookSlider.tabIndex = state.sliderVisible ? 0 : -1;
    els.paddingDown.disabled = state.paddingIndex === 0;
    els.paddingUp.disabled = state.paddingIndex === paddingSizes.length - 1;
    els.fontDown.disabled = state.fontIndex === 0;
    els.fontUp.disabled = state.fontIndex === fontSizes.length - 1;
    els.fontWeightDown.disabled = state.fontWeightIndex === 0;
    els.fontWeightUp.disabled = state.fontWeightIndex === fontWeights.length - 1;
    els.textAlphaDown.disabled = state.textAlphaIndex === 0;
    els.textAlphaUp.disabled = state.textAlphaIndex === textAlphas.length - 1;
    els.lineHeightDown.disabled = state.lineHeightIndex === 0;
    els.lineHeightUp.disabled = state.lineHeightIndex === lineHeights.length - 1;
    syncCustomSelects();
    scheduleContinuousLayoutRefresh(layoutAnchor);
  }

  function updateProgress() {
    const ratio = getWholeBookProgressRatio();
    if (!els.body.classList.contains("slider-interacting")) {
      els.bookSlider.value = String(Math.round(ratio * Number(els.bookSlider.max)));
    }
    els.bookPercent.textContent = `${getDisplayedPercent(ratio)}%`;
  }

  function getScrollRatio() {
    const maxScroll = getMaxScroll();
    if (maxScroll <= 0) {
      return 1;
    }
    return clamp(getReaderScrollTop() / maxScroll, 0, 1);
  }

  function getMaxScroll() {
    return Math.max(els.readerShell.scrollHeight - els.readerShell.clientHeight, 0);
  }

  function getReaderScrollTop() {
    return Math.max(els.readerShell.scrollTop, 0);
  }

  function getElementScrollTop(element) {
    const shellTop = els.readerShell.getBoundingClientRect().top;
    return getReaderScrollTop() + element.getBoundingClientRect().top - shellTop;
  }

  function scrollReaderTo(top, behavior = "auto") {
    els.readerShell.scrollTo({
      top: Math.max(top, 0),
      left: 0,
      behavior,
    });
  }

  function getIndexFromHash() {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!id) {
      return -1;
    }
    return book && book.chapters ? book.chapters.findIndex((chapter) => chapter.id === id) : -1;
  }

  function handleScroll() {
    if (isContinuousLayoutRefreshing) {
      return;
    }

    updateToolbarVisibility();
    syncChapterFromScroll();
    updateProgress();
    if (isContinuous()) {
      state.chapterScrollRatio = getCurrentChapterRatio();
    } else {
      state.scrollRatio = getSingleChapterRatio();
    }
    scheduleSaveState();
  }

  function updateToolbarVisibility() {
    const currentY = getReaderScrollTop();
    const delta = currentY - toolbarScrollY;
    const threshold = 10;
    const hideAfter = Math.max(80, getReaderHeaderHeight() + 24);

    if (
      currentY <= 18 ||
      delta < -threshold ||
      els.body.classList.contains("toc-open") ||
      hasOpenCustomSelect() ||
      isSliderToolbarLocked()
    ) {
      showToolbar();
      toolbarScrollY = currentY;
    } else if (delta > threshold && currentY > hideAfter) {
      hideToolbar();
      toolbarScrollY = currentY;
    }
  }

  function hideToolbar() {
    if (els.body.classList.contains("toc-open") || hasOpenCustomSelect() || isSliderToolbarLocked()) {
      return;
    }

    closeCustomSelects();
    els.body.classList.add("toolbar-hidden");
  }

  function showToolbar() {
    els.body.classList.remove("toolbar-hidden");
  }

  function hasOpenCustomSelect() {
    return customSelectControls.some(({ root }) => root.classList.contains("is-open"));
  }

  function isSliderToolbarLocked() {
    return isSliderInteracting || Date.now() < sliderInteractionUntil;
  }

  function beginSliderInteraction() {
    isSliderInteracting = true;
    extendSliderInteraction();

    if (sliderCommitTimer) {
      clearTimeout(sliderCommitTimer);
      sliderCommitTimer = 0;
    }

    if (sliderInteractionTimer) {
      clearTimeout(sliderInteractionTimer);
      sliderInteractionTimer = 0;
    }
  }

  function extendSliderInteraction() {
    sliderInteractionUntil = Math.max(sliderInteractionUntil, Date.now() + sliderToolbarLockMs);
    els.body.classList.add("slider-interacting");
    showToolbar();
    toolbarScrollY = getReaderScrollTop();

    if (!isSliderInteracting) {
      scheduleSliderInteractionRelease(sliderToolbarLockMs);
    }
  }

  function endSliderInteractionSoon() {
    isSliderInteracting = false;
    extendSliderInteraction();
  }

  function finishSliderInteraction() {
    endSliderInteractionSoon();
    scheduleSliderCommit();
  }

  function previewBookPosition(ratio) {
    if (ratio === null) {
      return;
    }

    const target = clamp(ratio, 0, 1) * book.chapters.length;
    const index = clamp(Math.floor(target), 0, book.chapters.length - 1);
    const chapter = book.chapters[index];
    els.currentChapter.textContent = `${chapter.number}/${book.chapters.length}`;
    els.bookPercent.textContent = `${getDisplayedPercent(ratio)}%`;
    els.desktopBookTitle.textContent = chapter.title;
    els.topbarBookTitle.textContent = chapter.title;
  }

  function getDisplayedPercent(ratio) {
    const safeRatio = clamp(ratio, 0, 1);
    return safeRatio >= 1 ? 100 : Math.floor(safeRatio * 100);
  }

  function scheduleSliderCommit() {
    if (pendingSliderRatio === null) {
      return;
    }

    if (sliderCommitTimer) {
      clearTimeout(sliderCommitTimer);
    }

    sliderCommitTimer = setTimeout(() => {
      sliderCommitTimer = 0;
      commitSliderPosition();
    }, sliderCommitDelayMs);
  }

  function commitSliderPosition() {
    if (pendingSliderRatio === null) {
      return;
    }

    const ratio = pendingSliderRatio;
    pendingSliderRatio = null;
    lastCommittedSliderRatio = ratio;
    const loadingToken = ++readerLoadingToken;
    const loadingStartedAt = Date.now();

    if (readerLoadingTimer) {
      clearTimeout(readerLoadingTimer);
      readerLoadingTimer = 0;
    }

    els.body.classList.add("reader-loading-active");
    els.bookContent.classList.add("slider-loading");
    els.readerLoading.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      goToBookPosition(ratio);
      const remaining = Math.max(0, sliderLoadingMinMs - (Date.now() - loadingStartedAt));

      readerLoadingTimer = setTimeout(() => {
        if (loadingToken !== readerLoadingToken) {
          return;
        }

        readerLoadingTimer = 0;
        els.body.classList.remove("reader-loading-active");
        els.bookContent.classList.remove("slider-loading");
        els.readerLoading.setAttribute("aria-hidden", "true");
      }, remaining);
    });
  }

  function scheduleSliderInteractionRelease(delay) {
    if (sliderInteractionTimer) {
      clearTimeout(sliderInteractionTimer);
    }

    sliderInteractionTimer = setTimeout(() => {
      const remaining = sliderInteractionUntil - Date.now();
      if (remaining > 0) {
        scheduleSliderInteractionRelease(remaining);
        return;
      }

      sliderInteractionTimer = 0;
      els.body.classList.remove("slider-interacting");
      showToolbar();
      toolbarScrollY = getReaderScrollTop();
      updateProgress();
    }, delay);
  }

  function syncChapterFromScroll() {
    if (!isContinuous()) {
      return;
    }

    const currentIndex = getVisibleChapterIndex();
    if (currentIndex < 0) {
      return;
    }

    if (currentIndex !== state.chapter) {
      updateChapterStatus(currentIndex);
      history.replaceState(null, "", `#${book.chapters[currentIndex].id}`);
      scheduleSaveState();
    }

    if (shouldShiftContinuousWindow(currentIndex)) {
      scheduleContinuousWindowShift(currentIndex);
    } else {
      cancelContinuousWindowShift();
    }
  }

  function getVisibleChapterIndex() {
    const sections = Array.from(els.bookContent.querySelectorAll(".chapter-section"));
    if (sections.length === 0) {
      return -1;
    }

    const topOffset = els.readerShell.getBoundingClientRect().top + getStickyOffset();
    let currentIndex = Number(sections[0].dataset.index) || 0;

    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= topOffset + 1) {
        currentIndex = Number(section.dataset.index) || 0;
      }
    });

    return currentIndex;
  }

  function updateChapterStatus(index) {
    const safeIndex = clamp(index, 0, book.chapters.length - 1);
    const chapter = book.chapters[safeIndex];

    state.chapter = safeIndex;
    els.currentChapter.textContent = `${chapter.number}/${book.chapters.length}`;
    els.desktopBookTitle.textContent = `《${book.title}》`;
    els.topbarBookTitle.textContent = `《${book.title}》`;
    els.prevChapter.disabled = safeIndex === 0;
    const isBookEnd = isContinuous() || safeIndex === book.chapters.length - 1;
    els.nextChapter.textContent = isBookEnd ? "下一部" : "下一章";
    els.nextChapter.disabled = false;
    syncTocCurrent(safeIndex);
  }

  function syncTocCurrent(index) {
    els.toc.querySelectorAll("button[data-chapter-index]").forEach((button) => {
      button.setAttribute("aria-current", String(Number(button.dataset.chapterIndex) === index));
    });
  }

  function scrollToChapter(index, smooth = true) {
    const chapter = book.chapters[index];
    const section = document.getElementById(chapter.id);
    if (!section) {
      return;
    }

    const topbarOffset = getStickyOffset();
    const startClearance = isContinuous() && index === 0 ? 48 : 0;
    const targetY = getElementScrollTop(section) - topbarOffset - startClearance;
    toolbarScrollY = Math.max(targetY, 0);
    scrollReaderTo(targetY, smooth ? "smooth" : "auto");
  }

  function prepareContinuousLayout() {
    const sections = els.bookContent.querySelectorAll(".chapter-section");
    const signature = getContinuousLayoutSignature();

    if (sections.length === book.chapters.length && continuousLayoutSignature === signature) {
      return;
    }

    const measuredHeights = measureChapterHeights();
    chapterHeights.splice(0, chapterHeights.length, ...measuredHeights);
    continuousLayoutSignature = signature;
    buildContinuousShells();
  }

  function measureChapterHeights() {
    const measurer = els.bookContent.cloneNode(false);
    const contentWidth = els.bookContent.getBoundingClientRect().width;

    measurer.removeAttribute("id");
    measurer.classList.add("chapter-measurer");
    measurer.setAttribute("aria-hidden", "true");
    measurer.inert = true;
    measurer.style.width = `${contentWidth}px`;
    measurer.innerHTML = book.chapters
      .map((chapter) => `<section class="chapter-section">${getChapterHtml(chapter)}</section>`)
      .join("");
    document.body.append(measurer);

    const heights = Array.from(measurer.querySelectorAll(".chapter-section"), (section) =>
      Math.ceil(section.getBoundingClientRect().height)
    );
    measurer.remove();
    return heights;
  }

  function buildContinuousShells() {
    const fragment = document.createDocumentFragment();

    book.chapters.forEach((chapter, index) => {
      const section = document.createElement("section");
      section.className = "chapter-section";
      section.id = chapter.id;
      section.dataset.index = String(index);
      section.dataset.rendered = "false";
      section.setAttribute("aria-hidden", "true");
      section.style.height = `${chapterHeights[index]}px`;
      fragment.append(section);
    });

    els.bookContent.replaceChildren(fragment);
    continuousWindow.start = 0;
    continuousWindow.end = -1;
  }

  function renderContinuousWindow(centerIndex) {
    const safeIndex = clamp(centerIndex, 0, book.chapters.length - 1);
    const { start, end } = getContinuousRenderRange(safeIndex);

    if (start === continuousWindow.start && end === continuousWindow.end) {
      return;
    }

    const sections = els.bookContent.querySelectorAll(".chapter-section");
    sections.forEach((section, index) => {
      const shouldRender = index >= start && index <= end;
      const isRendered = section.dataset.rendered === "true";

      if (shouldRender && !isRendered) {
        section.innerHTML = getChapterHtml(book.chapters[index]);
        section.dataset.rendered = "true";
        section.removeAttribute("aria-hidden");
      } else if (!shouldRender && isRendered) {
        section.replaceChildren();
        section.dataset.rendered = "false";
        section.setAttribute("aria-hidden", "true");
      }
    });

    continuousWindow.start = start;
    continuousWindow.end = end;
  }

  function shouldShiftContinuousWindow(index) {
    const { start, end } = getContinuousRenderRange(index);
    return start !== continuousWindow.start || end !== continuousWindow.end;
  }

  function getContinuousRenderRange(centerIndex) {
    const maxStart = Math.max(0, book.chapters.length - continuousRenderCount);
    const start = clamp(centerIndex - 1, 0, maxStart);
    return {
      start,
      end: Math.min(book.chapters.length - 1, start + continuousRenderCount - 1),
    };
  }

  function scheduleContinuousWindowShift(centerIndex) {
    pendingWindowCenter = centerIndex;
    if (windowShiftTimer) {
      return;
    }

    windowShiftTimer = setTimeout(() => {
      windowShiftTimer = 0;
      const currentIndex = getVisibleChapterIndex();
      const nextCenter = currentIndex >= 0 ? currentIndex : pendingWindowCenter;
      pendingWindowCenter = null;

      if (!isContinuous() || !shouldShiftContinuousWindow(nextCenter)) {
        return;
      }

      renderContinuousWindow(nextCenter);
    }, 80);
  }

  function cancelContinuousWindowShift() {
    pendingWindowCenter = null;
    if (!windowShiftTimer) {
      return;
    }

    clearTimeout(windowShiftTimer);
    windowShiftTimer = 0;
  }

  function getContinuousLayoutSignature() {
    const contentWidth = Math.round(els.bookContent.getBoundingClientRect().width * 10) / 10;
    return [
      contentWidth,
      state.fontIndex,
      state.lineHeightIndex,
      state.fontFamily,
      state.fontWeightIndex,
      state.paddingIndex,
    ].join("|");
  }

  function captureContinuousLayoutAnchor() {
    if (!isContinuous() || els.bookContent.querySelectorAll(".chapter-section").length !== book.chapters.length) {
      return null;
    }

    const visibleIndex = getVisibleChapterIndex();
    const index = visibleIndex >= 0 ? visibleIndex : state.chapter;
    return { index, ratio: getChapterRatio(index) };
  }

  function scheduleContinuousLayoutRefresh(layoutAnchor = null) {
    if (!isContinuous() || els.bookContent.querySelectorAll(".chapter-section").length !== book.chapters.length) {
      return;
    }

    if (continuousLayoutSignature === getContinuousLayoutSignature()) {
      return;
    }

    if (layoutAnchor && !pendingContinuousLayoutAnchor) {
      pendingContinuousLayoutAnchor = layoutAnchor;
    }
    isContinuousLayoutRefreshing = true;
    if (continuousLayoutTimer) {
      clearTimeout(continuousLayoutTimer);
    }
    continuousLayoutTimer = setTimeout(refreshContinuousLayout, 100);
  }

  function cancelContinuousLayoutRefresh() {
    pendingContinuousLayoutAnchor = null;
    isContinuousLayoutRefreshing = false;
    if (!continuousLayoutTimer) {
      return;
    }

    clearTimeout(continuousLayoutTimer);
    continuousLayoutTimer = 0;
  }

  function refreshContinuousLayout() {
    continuousLayoutTimer = 0;
    if (!isContinuous()) {
      pendingContinuousLayoutAnchor = null;
      isContinuousLayoutRefreshing = false;
      return;
    }

    const savedAnchor = pendingContinuousLayoutAnchor;
    pendingContinuousLayoutAnchor = null;
    const anchorIndex = savedAnchor ? savedAnchor.index : getVisibleChapterIndex();
    const safeAnchor = anchorIndex >= 0 ? anchorIndex : state.chapter;
    const anchorRatio = savedAnchor
      ? savedAnchor.ratio
      : safeAnchor === state.chapter
        ? getCurrentChapterRatio()
        : 0;
    const measuredHeights = measureChapterHeights();

    chapterHeights.splice(0, chapterHeights.length, ...measuredHeights);
    continuousLayoutSignature = getContinuousLayoutSignature();
    els.bookContent.querySelectorAll(".chapter-section").forEach((section, index) => {
      section.style.height = `${chapterHeights[index]}px`;
    });
    renderContinuousWindow(safeAnchor);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToChapterRatio(safeAnchor, anchorRatio);
        isContinuousLayoutRefreshing = false;
        syncChapterFromScroll();
        updateProgress();
      });
    });
  }

  function scrollToChapterRatio(index, ratio) {
    const chapter = book.chapters[index];
    const section = document.getElementById(chapter.id);
    if (!section) {
      return;
    }

    const topbarOffset = getStickyOffset();
    const sectionTop = getElementScrollTop(section);
    const safeRatio = clamp(ratio, 0, 1);
    const startClearance = index === 0 && safeRatio === 0 ? 48 : 0;
    const chapterStartY = sectionTop - topbarOffset;
    const targetY = index === book.chapters.length - 1
      ? chapterStartY + (getMaxScroll() - chapterStartY) * safeRatio
      : sectionTop + section.offsetHeight * safeRatio - topbarOffset - startClearance;
    toolbarScrollY = Math.max(targetY, 0);
    scrollReaderTo(targetY);
  }

  function goToBookPosition(ratio) {
    const target = clamp(ratio, 0, 1) * book.chapters.length;
    const index = clamp(Math.floor(target), 0, book.chapters.length - 1);
    const chapterRatio = clamp(target - index, 0, 1);

    if (isContinuous()) {
      state.chapterScrollRatio = chapterRatio;
      renderContinuousWindow(index);
      updateChapterStatus(index);
      history.replaceState(null, "", `#${book.chapters[index].id}`);
      scrollToChapterRatio(index, chapterRatio);
      updateProgress();
    } else {
      state.scrollRatio = chapterRatio;
      renderSingle(index, { restoreScroll: true });
    }
  }

  function getWholeBookProgressRatio() {
    if (isContinuous()) {
      return clamp((state.chapter + getCurrentChapterRatio()) / book.chapters.length, 0, 1);
    }

    return clamp((state.chapter + getSingleChapterRatio()) / book.chapters.length, 0, 1);
  }

  function getSingleChapterRatio() {
    return getScrollRatio();
  }

  function getCurrentChapterRatio() {
    return getChapterRatio(state.chapter);
  }

  function getChapterRatio(index) {
    const safeIndex = clamp(index, 0, book.chapters.length - 1);
    const section = document.getElementById(book.chapters[safeIndex].id);
    if (!section) {
      return 0;
    }

    const isLastChapter = safeIndex === book.chapters.length - 1;
    const currentScrollTop = getReaderScrollTop();
    if (isLastChapter && currentScrollTop >= getMaxScroll()) {
      return 1;
    }

    const topbarOffset = getStickyOffset();
    const sectionTop = getElementScrollTop(section);
    if (isLastChapter) {
      const chapterStartY = sectionTop - topbarOffset;
      return clamp(
        (currentScrollTop - chapterStartY) / Math.max(getMaxScroll() - chapterStartY, 1),
        0,
        1
      );
    }

    const currentY = currentScrollTop + topbarOffset;
    return clamp((currentY - sectionTop) / Math.max(section.offsetHeight, 1), 0, 1);
  }

  function getStickyOffset() {
    const toolbarHeight = els.body.classList.contains("toolbar-hidden") ? 0 : getReaderHeaderHeight();
    return toolbarHeight + 26;
  }

  function getReaderHeaderHeight() {
    return els.readerHeader ? els.readerHeader.getBoundingClientRect().height : 0;
  }

  function isContinuous() {
    return state.readingMode === "continuous";
  }

  function getChapterHtml(chapter) {
    if (!chapterHtmlCache.has(chapter.id)) {
      chapterHtmlCache.set(chapter.id, markdownToHtml(chapter.content));
    }

    return chapterHtmlCache.get(chapter.id);
  }

  function markdownToHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").trim().split("\n");
    const html = [];
    let paragraph = [];
    let quote = [];

    lines.forEach((line) => {
      if (!line.trim()) {
        flushQuote();
        flushParagraph();
        return;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushQuote();
        flushParagraph();
        const level = heading[1].length === 1 ? 2 : Math.min(heading[1].length + 1, 6);
        html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        return;
      }

      if (line.startsWith(">")) {
        flushParagraph();
        quote.push(line.replace(/^>\s?/, ""));
        return;
      }

      paragraph.push(line);
    });

    flushQuote();
    flushParagraph();
    return html.join("");

    function flushParagraph() {
      if (paragraph.length === 0) {
        return;
      }
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }

    function flushQuote() {
      if (quote.length === 0) {
        return;
      }
      html.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      quote = [];
    }
  }

  function inline(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
  }
})();
