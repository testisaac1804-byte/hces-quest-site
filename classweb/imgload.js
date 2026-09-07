(function () {
  var serviceWorkers = window.navigator && window.navigator.serviceWorker;
  var waitingForController = !!(serviceWorkers && !serviceWorkers.controller);
  var fallbackMode = !serviceWorkers;
  var fallbackStarted = false;
  var fallbackBlankDelay = 30 + Math.floor(Math.random() * 91);
  var deferredListMode = (" " + (document.documentElement.className || "") + " ").indexOf(" deferred-list ") !== -1;
  var classPageBackground = window.location.pathname.indexOf("/contact/") === -1;

  if (classPageBackground) {
    document.write('<style id="hces-class-background" type="text/css">html,body{background-color:#cceeff!important;}</style>');
  }

  if (fallbackMode || waitingForController) {
    document.write('<style id="hces-fallback-wait" type="text/css">body{visibility:hidden!important;}</style>');
  }

  if (deferredListMode) {
    if (window.history && "scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    document.documentElement.className = (document.documentElement.className ? document.documentElement.className + " " : "") + "hces-deferred-list-loading";
    document.write('<style id="hces-deferred-list-style" type="text/css">html.hces-deferred-list-loading table.news-table tr:nth-child(n+2),html.hces-deferred-list-loading p.mono{display:none!important;}</style>');
  }

  function getLoaderRoot() {
    var scripts = document.getElementsByTagName("script");
    var i;
    var src;

    for (i = scripts.length - 1; i >= 0; i--) {
      src = scripts[i].src || "";
      if (/\/imgload\.js(?:\?|$)/i.test(src)) {
        return src.replace(/imgload\.js(?:\?.*)?$/i, "");
      }
    }

    return "";
  }

  function reloadAfterRegistration() {
    function reload() {
      window.location.reload();
    }

    if (document.readyState === "complete") {
      reload();
    } else if (window.addEventListener) {
      window.addEventListener("load", reload, false);
    } else {
      window.attachEvent("onload", reload);
    }
  }

  function registerSlowStream() {
    var root = getLoaderRoot();
    var reloadKey = "hces-stream-6b-v1";
    var alreadyReloaded = false;

    if (!root || !navigator.serviceWorker) return;

    navigator.serviceWorker.register(root + "slow-stream-sw.js?v=2.1", { scope: root, updateViaCache: "none" }).then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      if (!waitingForController) return;

      try {
        alreadyReloaded = window.sessionStorage.getItem(reloadKey) === "1";
        if (!alreadyReloaded) window.sessionStorage.setItem(reloadKey, "1");
      } catch (ignore) {
        alreadyReloaded = true;
      }

      if (!alreadyReloaded) {
        reloadAfterRegistration();
      } else {
        fallbackMode = true;
        startFallbackPageLoad();
      }
    }).catch(function () {
      fallbackMode = true;
      startFallbackPageLoad();
    });
  }

  registerSlowStream();

  function ready(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(fn, 0);
    } else if (document.addEventListener) {
      document.addEventListener("DOMContentLoaded", fn, false);
    } else {
      window.attachEvent("onload", fn);
    }
  }

  function fallbackBlocks() {
    var nodes = document.querySelectorAll("tr,p,form,marquee,pre,.school-name,.school-en");
    var blocks = [];
    var i;

    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].style.display === "none") continue;
      nodes[i]._hcesDisplay = nodes[i].style.display || "";
      nodes[i].style.display = "none";
      blocks.push(nodes[i]);
    }

    return blocks;
  }

  function revealFallbackBlocks(blocks) {
    var groupSize = Math.max(1, Math.ceil(blocks.length / 36));
    var offset = 0;
    var index = 0;

    function revealGroup() {
      var end = Math.min(blocks.length, index + groupSize);
      var wait;

      while (index < end) {
        blocks[index].style.display = blocks[index]._hcesDisplay;
        index++;
      }

      if (index >= blocks.length) return;
      wait = Math.random() < 0.1 ? randomBetween(140, 320) : randomBetween(25, 95);
      setTimeout(revealGroup, wait);
    }

    offset = randomBetween(0, 80);
    setTimeout(revealGroup, offset);
  }

  function startFallbackPageLoad() {
    if (fallbackStarted) return;
    fallbackStarted = true;

    ready(function () {
      var blocks = fallbackBlocks();
      var waitingStyle = document.getElementById("hces-fallback-wait");

      setTimeout(function () {
        if (waitingStyle && waitingStyle.parentNode) {
          waitingStyle.parentNode.removeChild(waitingStyle);
        }
        revealFallbackBlocks(blocks);
      }, fallbackBlankDelay);
    });
  }

  function installFallbackNavigationDelay() {
    ready(function () {
      function handleClick(event) {
        var link = event.target;
        var href;

        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        while (link && String(link.tagName).toLowerCase() !== "a") {
          link = link.parentNode;
        }

        if (!link) return;
        href = link.getAttribute("href") || "";
        if (!href || /^#|^javascript:|^mailto:/i.test(href) || link.target || link.getAttribute("download") !== null) return;
        if (link.hostname && link.hostname !== window.location.hostname) return;

        event.preventDefault();
        setTimeout(function () {
          window.location.href = link.href;
        }, randomBetween(360, 650));
      }

      if (document.addEventListener) {
        document.addEventListener("click", handleClick, false);
      } else {
        document.attachEvent("onclick", handleClick);
      }
    });
  }

  function isSlowImage(url, img) {
    var cls = " " + (img.className || "") + " ";
    return cls.indexOf(" photo ") !== -1 || /(^|\/)album\//i.test(url) || /notice_920704|principal|school_/i.test(url);
  }

  function clip(img, percent) {
    var value = "inset(0 0 " + (100 - percent) + "% 0)";
    img.style.clipPath = value;
    img.style.webkitClipPath = value;
  }

  function removePhotoClass(img) {
    img.className = (img.className || "")
      .replace(/(^|\s)photo(?=\s|$)/g, " ")
      .replace(/^\s+|\s+$/g, "")
      .replace(/\s+/g, " ");
  }

  function keepFrameVisible(img) {
    var cls = " " + (img.className || "") + " ";
    var frame;

    if (cls.indexOf(" photo ") === -1 || !img.parentNode) return;

    frame = document.createElement("span");
    frame.className = "photo";
    frame.style.display = "inline-block";
    frame.style.lineHeight = "0";
    frame.style.verticalAlign = "middle";
    frame.style.overflow = "hidden";

    img.parentNode.insertBefore(frame, img);
    frame.appendChild(img);
    removePhotoClass(img);
    img.style.border = "0";
    img.style.background = "transparent";
    img.style.padding = "0";
    img.style.margin = "0";
    img.style.display = "block";
  }

  function randomBetween(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function getDownloadedBytes(img, url, slow) {
    var entries;
    var entry;
    var bytes = 0;

    if (window.performance && window.performance.getEntriesByName) {
      entries = window.performance.getEntriesByName(img.src);
      if (entries && entries.length) {
        entry = entries[entries.length - 1];
        bytes = entry.encodedBodySize || entry.decodedBodySize || entry.transferSize || 0;
      }
    }

    if (bytes > 0) return bytes;
    if (/new|broken|mail/i.test(url)) return 1000;
    if (/\.gif(?:\?|$)/i.test(url)) return 4000;
    return slow ? 14000 : 7000;
  }

  function makeProgress(bytes) {
    var progress;

    if (bytes <= 1600) {
      return [randomBetween(55, 82), 100];
    }

    if (bytes <= 5000) {
      return [randomBetween(25, 45), randomBetween(70, 89), 100];
    }

    progress = [randomBetween(7, 17)];

    if (bytes > 12000 && Math.random() < 0.65) {
      progress[progress.length] = randomBetween(24, 38);
    }

    progress[progress.length] = randomBetween(48, 68);

    if (bytes > 8500 || Math.random() < 0.45) {
      progress[progress.length] = randomBetween(76, 91);
    }

    progress[progress.length] = 100;
    return progress;
  }

  function revealInJumps(img, url, slow) {
    var bytes = getDownloadedBytes(img, url, slow);
    var progress = makeProgress(bytes);
    var baseDelay = Math.max(18, Math.min(450, Math.round(bytes / 48)));
    var speed = 0.65 + Math.random() * 0.9;
    var index = 0;

    function next() {
      clip(img, progress[index]);
      index++;
      if (index < progress.length) {
        setTimeout(next, Math.floor(baseDelay * randomBetween(65, 140) / 100 * speed));
      }
    }

    setTimeout(next, randomBetween(0, Math.max(12, Math.round(baseDelay * 0.55))));
  }

  function prepareImage(img) {
    var url;
    var slow;

    if (!img || img._hcesPrepared || !img.getAttribute("data-img-src")) return;

    img._hcesPrepared = true;
    url = img.getAttribute("data-img-src");
    slow = isSlowImage(url, img);

    keepFrameVisible(img);
    img.style.transition = "none";
    img.style.webkitTransition = "none";
    clip(img, 0);

    img.onload = function () {
      revealInJumps(img, url, slow);
    };
    img.onerror = function () {
      clip(img, 100);
    };

    setTimeout(function () {
      img.setAttribute("src", url);
    }, fallbackMode ? fallbackBlankDelay + randomBetween(0, 220) : randomBetween(0, 25));
  }

  function scanImages(root) {
    var imgs;
    var i;

    if (!root) return;
    if (root.tagName && String(root.tagName).toLowerCase() === "img") {
      prepareImage(root);
      return;
    }

    if (!root.querySelectorAll) return;
    imgs = root.querySelectorAll("img[data-img-src]");
    for (i = 0; i < imgs.length; i++) {
      prepareImage(imgs[i]);
    }
  }

  function watchImages() {
    var observer;

    scanImages(document);

    if (window.MutationObserver && document.documentElement) {
      observer = new MutationObserver(function (changes) {
        var i;
        var j;
        for (i = 0; i < changes.length; i++) {
          for (j = 0; j < changes[i].addedNodes.length; j++) {
            scanImages(changes[i].addedNodes[j]);
          }
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    ready(function () {
      scanImages(document);
    });
  }

  function addFictionNotice() {
    ready(function () {
      var page = document.querySelector("table.page");
      var notice;

      if (!page || document.getElementById("fiction-notice")) return;

      notice = document.createElement("div");
      notice.id = "fiction-notice";
      notice.appendChild(document.createTextNode("本網站內容為虛構創作，非真實事件紀錄。"));
      notice.style.width = (page.offsetWidth || 800) + "px";
      notice.style.margin = "480px auto 12px auto";
      notice.style.textAlign = "center";
      notice.style.color = "#b2b2b2";
      notice.style.fontSize = "7pt";
      notice.style.lineHeight = "1.4";
      page.parentNode.insertBefore(notice, page.nextSibling);
    });
  }

  function listEntryTime(row) {
    var text;
    var match;

    if (!row || !row.cells || !row.cells.length) return null;
    text = row.cells[0].textContent || row.cells[0].innerText || "";
    match = /(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/.exec(text);
    if (!match) return null;

    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  }

  function listEntryDelay(rows, index) {
    var current = listEntryTime(rows[index]);
    var next = listEntryTime(rows[index + 1]);
    var gap = current !== null && next !== null ? Math.max(0, Math.round((next - current) / 60000)) : 1;
    var accelerated = current !== null && current >= Date.UTC(2003, 6, 5, 0, 0);
    var delay;
    var chance;

    if (gap <= 1) {
      delay = randomBetween(45, 75);
    } else if (gap <= 5) {
      delay = randomBetween(60, 95);
    } else if (gap <= 15) {
      delay = randomBetween(75, 120);
    } else if (gap <= 60) {
      delay = randomBetween(95, 160);
    } else {
      delay = randomBetween(260, 480);
    }

    delay = Math.round(delay * randomBetween(45, 165) / 100);
    chance = Math.random();

    if (chance < 0.1) {
      delay = randomBetween(18, 45);
    } else if (chance < 0.16) {
      delay += randomBetween(180, 600);
    }

    if (accelerated) delay = Math.round(delay / 3);
    return Math.max(accelerated ? 6 : 18, Math.min(1000, delay));
  }

  function startDeferredListReveal() {
    ready(function () {
      var table = document.querySelector("table.news-table");
      var rows = [];
      var finalLog = document.querySelector("p.mono");
      var style = document.getElementById("hces-deferred-list-style");
      var index = 0;
      var i;

      if (!table || !table.rows || table.rows.length < 2) return;

      window.scrollTo(0, 0);

      for (i = 1; i < table.rows.length; i++) {
        table.rows[i].style.display = "none";
        rows.push(table.rows[i]);
      }
      if (finalLog) finalLog.style.display = "none";

      document.documentElement.className = document.documentElement.className.replace(/\bhces-deferred-list-loading\b/g, "");
      if (style && style.parentNode) style.parentNode.removeChild(style);

      function showNext() {
        rows[index].style.display = "";
        index++;

        if (index < rows.length) {
          setTimeout(showNext, listEntryDelay(rows, index - 1));
        } else if (finalLog) {
          setTimeout(function () {
            finalLog.style.display = "";
          }, randomBetween(600, 900));
        }
      }

      setTimeout(showNext, randomBetween(550, 850));
    });
  }

  watchImages();
  addFictionNotice();
  if (deferredListMode) startDeferredListReveal();
  if (fallbackMode) {
    startFallbackPageLoad();
    installFallbackNavigationDelay();
  }
})();
