/*
  Photos: every photo slot names a file in images/ (data-photo="images/faa-2").
  If that file exists (.jpg, .jpeg, .png or .webp), it is shown. If not, the public site hides
  that slide, and the draft view (add #draft to the address) shows a labeled empty slot instead.
*/
(function () {
  var DRAFT = window.SITE_DRAFT === true || location.hash === "#draft";
  if (DRAFT) document.documentElement.classList.add("draft");
  var EXTS = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG"];
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function imgProbe(url) {
    return new Promise(function (res) {
      var i = new Image();
      i.onload = function () { res(true); };
      i.onerror = function () { res(false); };
      i.src = url;
    });
  }
  function probe(url) {
    if (!window.fetch) return imgProbe(url);
    return fetch(url, { method: "HEAD", cache: "no-cache" }).then(function (r) {
      if (r.ok) return true;
      if (r.status === 404) return false;
      return imgProbe(url);
    }, function () { return imgProbe(url); });
  }
  function findPhoto(base) {
    if (/\.[a-z0-9]{3,4}$/i.test(base)) return probe(base).then(function (ok) { return ok ? base : null; });
    var i = 0;
    function next() {
      if (i >= EXTS.length) return Promise.resolve(null);
      var url = base + "." + EXTS[i++];
      return probe(url).then(function (ok) { return ok ? url : next(); });
    }
    return next();
  }

  // Resolve one photo slot: show it, mark it missing, or remove it.
  function resolveSlot(slot) {
    var img = slot.querySelector("img");
    return findPhoto(slot.getAttribute("data-photo")).then(function (url) {
      if (url) {
        img.src = url;
        slot.classList.add("has-photo");
        if (slot.classList.contains("fig")) {
          // charts are dense: tapping one opens it full size
          var a = document.createElement("a");
          a.href = url; a.target = "_blank"; a.rel = "noopener";
          a.setAttribute("aria-label", "Open " + (img.alt || "figure") + " full size");
          img.parentNode.insertBefore(a, img); a.appendChild(img);
        }
        return true;
      }
      if (DRAFT) { slot.classList.add("missing"); img.remove(); return true; }
      return false;
    });
  }

  function setupCarousel(car) {
    var track = car.querySelector(".track");
    var slides = Array.prototype.slice.call(track.querySelectorAll(".slide"));
    return Promise.all(slides.map(function (s, i) {
      // the first photo of each carousel loads right away, the rest when needed
      if (i > 0) s.querySelector("img").setAttribute("loading", "lazy");
      return resolveSlot(s).then(function (keep) { if (!keep) s.remove(); });
    })).then(function () {
      slides = Array.prototype.slice.call(track.querySelectorAll(".slide"));
      if (!slides.length) { car.hidden = true; return; }
      if (slides.length === 1) car.classList.add("single");
      var prev = car.querySelector('[data-dir="prev"]');
      var next = car.querySelector('[data-dir="next"]');
      var count = car.querySelector(".count");
      var dots = car.querySelector(".dots");
      dots.innerHTML = "";
      slides.forEach(function (s, i) {
        s.querySelector(".num").textContent = (i + 1 < 10 ? "0" : "") + (i + 1);
        s.setAttribute("aria-label", (i + 1) + " of " + slides.length);
        var d = document.createElement("button");
        d.type = "button";
        d.setAttribute("aria-label", "Show photo " + (i + 1));
        d.addEventListener("click", function () { go(i); });
        dots.appendChild(d);
      });
      var current = -1, settle = null;
      function update() {
        render(Math.round(track.scrollLeft / Math.max(track.clientWidth, 1)));
      }
      function render(i) {
        i = Math.max(0, Math.min(slides.length - 1, i));
        if (i === current) return;
        current = i;
        count.textContent = (i + 1) + " / " + slides.length;
        prev.disabled = i === 0;
        next.disabled = i === slides.length - 1;
        Array.prototype.forEach.call(dots.children, function (d, k) { d.setAttribute("aria-current", k === i ? "true" : "false"); });
      }
      function go(i) {
        i = Math.max(0, Math.min(slides.length - 1, i));
        render(i);   // count and buttons follow the click right away, even mid-scroll
        clearTimeout(settle);
        settle = setTimeout(function () { settle = null; update(); }, 700);
        track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
      }
      prev.addEventListener("click", function () { go(current - 1); });
      next.addEventListener("click", function () { go(current + 1); });
      track.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
      });
      var ticking = false;
      track.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { ticking = false; if (!settle) update(); });
      }, { passive: true });
      window.addEventListener("resize", function () { go(current); });
      update();
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-carousel]"), setupCarousel);

    Array.prototype.forEach.call(document.querySelectorAll(".logo[data-photo]"), function (logo) {
      resolveSlot(logo).then(function (keep) { if (!keep) logo.remove(); });
    });

    var profile = document.querySelector(".profile[data-photo]");
    if (profile) resolveSlot(profile).then(function (keep) {
      if (!keep) { profile.remove(); document.querySelector(".about").classList.add("no-photo"); }
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (btn) {
      btn.addEventListener("click", function () {
        var target = document.getElementById(btn.getAttribute("data-copy-target") || "");
        function fallback() {
          if (target) {
            var r = document.createRange(); r.selectNodeContents(target);
            var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          }
          btn.textContent = "Selected";
        }
        try {
          navigator.clipboard.writeText(btn.getAttribute("data-copy")).then(function () { btn.textContent = "Copied"; }, fallback);
        } catch (e) { fallback(); }
        setTimeout(function () { btn.textContent = "Copy"; }, 2400);
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
