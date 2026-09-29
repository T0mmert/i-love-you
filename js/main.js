(() => {
  const G = window.GIFT;
  const $ = (sel) => document.querySelector(sel);
  const body = document.body;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("dk:" + key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("dk:" + key, JSON.stringify(value)); } catch {}
    },
  };

  // ?reset wist de afgescheurde bonnen (handig om te testen)
  if (new URLSearchParams(location.search).has("reset")) {
    try { localStorage.removeItem("dk:tickets"); } catch {}
    history.replaceState(null, "", location.pathname);
  }

  document.querySelectorAll("[data-name]").forEach((el) => (el.textContent = G.name));

  /* ---------- Hearts ---------- */

  const hearts = $("#hearts");
  function burst(x, y, count = 14) {
    if (reduceMotion) return;
    for (let i = 0; i < count; i++) {
      const h = document.createElement("span");
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 140;
      h.className = "heart";
      h.textContent = "♥";
      h.style.left = x + "px";
      h.style.top = y + "px";
      h.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      h.style.setProperty("--dy", Math.sin(angle) * dist - 60 + "px");
      h.style.setProperty("--r", (Math.random() * 80 - 40) + "deg");
      h.style.setProperty("--s", 14 + Math.random() * 20 + "px");
      h.addEventListener("animationend", () => h.remove());
      hearts.appendChild(h);
    }
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  /* ---------- Lamp cord ---------- */

  const cord = $("#cord");
  const room = $("#room");

  function lampOn() {
    if (body.classList.contains("lamp-on")) return;
    body.classList.add("lamp-on");
    cord.setAttribute("aria-pressed", "true");
    room.inert = false;
  }

  let cordStart = null;
  cord.addEventListener("pointerdown", (e) => {
    cordStart = e.clientY;
    cord.setPointerCapture(e.pointerId);
    cord.style.transition = "none";
  });
  cord.addEventListener("pointermove", (e) => {
    if (cordStart === null) return;
    const dy = Math.max(0, Math.min(70, e.clientY - cordStart));
    cord.style.translate = `0 ${dy}px`;
  });
  function releaseCord(e) {
    if (cordStart === null) return;
    const dy = e.clientY - cordStart;
    cordStart = null;
    cord.style.transition = "";
    // een korte tik telt ook als trekken
    if (dy > 24 || Math.abs(dy) < 6) {
      cord.style.translate = "0 22px";
      setTimeout(() => (cord.style.translate = ""), 160);
      lampOn();
    } else {
      cord.style.translate = "";
    }
  }
  cord.addEventListener("pointerup", releaseCord);
  cord.addEventListener("pointercancel", () => { cordStart = null; cord.style.translate = ""; });
  cord.addEventListener("click", (e) => { if (e.detail === 0) lampOn(); }); // toetsenbord

  /* ---------- Washing lines ---------- */

  const linesEl = $("#lines");
  const counter = $("#counter");
  const total = G.photos.length;
  const perLine = total > 6 ? 4 : 3;
  const tracks = [];
  const prints = [];
  let developed = 0;

  for (let i = 0; i < total; i += perLine) {
    const line = document.createElement("div");
    line.className = "line";
    const track = document.createElement("div");
    track.className = "track";
    track.innerHTML =
      '<svg class="string" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 Q50 26 100 2"/></svg>';

    G.photos.slice(i, i + perLine).forEach((photo, j) => {
      const index = i + j;
      const print = document.createElement("div");
      print.className = "print";
      print.style.setProperty("--rot", ((index * 37) % 7) - 3 + "deg");
      print.innerHTML = `
        <span class="peg" aria-hidden="true"></span>
        <button class="paper" type="button" aria-label="Foto ${index + 1} ontwikkelen">
          <img src="${photo.src}" alt="" loading="lazy" decoding="async"${photo.pos ? ` style="object-position:${photo.pos}"` : ""}>
        </button>`;
      const paper = print.querySelector(".paper");
      paper.addEventListener("click", () => onPrint(index));
      track.appendChild(print);
      prints.push(print);
    });

    line.appendChild(track);
    linesEl.appendChild(line);
    tracks.push(track);
  }

  // Laat elke foto aan het doorhangende touw hangen
  function hang() {
    tracks.forEach((track) => {
      const w = track.offsetWidth;
      const svgH = track.querySelector(".string").getBoundingClientRect().height;
      track.querySelectorAll(".print").forEach((p) => {
        const t = (p.offsetLeft + p.offsetWidth / 2) / w;
        const y = 2 + 48 * t * (1 - t); // y(t) van de bezier-curve hierboven
        p.style.setProperty("--drop", (y / 20) * svgH + "px");
      });
    });
  }
  new ResizeObserver(hang).observe(linesEl);

  function updateCounter() {
    counter.textContent =
      developed === total
        ? `Alle ${total} ontwikkeld. Wat een mooi stel.`
        : `${developed} van ${total} ontwikkeld`;
  }
  updateCounter();

  function onPrint(index) {
    const print = prints[index];
    if (print.classList.contains("developed")) return openViewer(index);
    if (print.classList.contains("developing")) return;

    print.classList.add("developing");
    const paper = print.querySelector(".paper");
    const done = () => {
      print.classList.replace("developing", "developed");
      paper.setAttribute("aria-label", `Foto ${index + 1} groot bekijken`);
      developed++;
      updateCounter();
      if (developed === total) burst(...centerOf(counter), 40);
      else burst(...centerOf(paper), 6);
    };
    setTimeout(done, reduceMotion ? 800 : 2800);
  }

  /* ---------- Viewer ---------- */

  const viewer = $("#viewer");
  const vImg = $("#viewer-img");
  let current = 0;

  const developedIndexes = () => prints.flatMap((p, i) => (p.classList.contains("developed") ? [i] : []));

  function show(index) {
    current = index;
    const photo = G.photos[index];
    vImg.src = photo.src;
    vImg.alt = `Foto ${index + 1}`;
    const many = developedIndexes().length > 1;
    $("#v-prev").hidden = !many;
    $("#v-next").hidden = !many;
  }

  function step(dir) {
    const list = developedIndexes();
    const pos = list.indexOf(current);
    show(list[(pos + dir + list.length) % list.length]);
  }

  function openViewer(index) {
    show(index);
    viewer.showModal();
  }

  $("#v-prev").addEventListener("click", () => step(-1));
  $("#v-next").addEventListener("click", () => step(1));
  $("#v-close").addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", (e) => { if (e.target === viewer) viewer.close(); });
  viewer.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  viewer.addEventListener("close", () => prints[current].querySelector(".paper").focus());

  let swipeX = null;
  viewer.addEventListener("touchstart", (e) => (swipeX = e.touches[0].clientX), { passive: true });
  viewer.addEventListener("touchend", (e) => {
    if (swipeX === null) return;
    const dx = e.changedTouches[0].clientX - swipeX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    swipeX = null;
  });

  /* ---------- Darkroom timer ---------- */

  const [ty, tm, td] = G.together.split("-").map(Number);
  const start = new Date(ty, tm - 1, td);
  $("#since").textContent = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(start);

  const svgNS = "http://www.w3.org/2000/svg";
  const dial = $("#dial");
  const el = (name, attrs) => {
    const node = document.createElementNS(svgNS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return dial.appendChild(node);
  };
  el("circle", { class: "dial-face", cx: 100, cy: 100, r: 94 });
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const a = (i / 60) * Math.PI * 2;
    const r1 = major ? 76 : 83;
    el("line", {
      class: major ? "tick major" : "tick",
      x1: 100 + Math.sin(a) * r1, y1: 100 - Math.cos(a) * r1,
      x2: 100 + Math.sin(a) * 89, y2: 100 - Math.cos(a) * 89,
    });
    if (major) {
      const n = el("text", { class: "dial-num", x: 100 + Math.sin(a) * 64, y: 100 - Math.cos(a) * 64 + 4.5 });
      n.textContent = i;
    }
  }
  const minuteHand = el("line", { class: "hand minute", x1: 100, y1: 112, x2: 100, y2: 44 });
  const secondHand = el("line", { class: "hand second", x1: 100, y1: 118, x2: 100, y2: 22 });
  el("circle", { class: "hub", cx: 100, cy: 100, r: 5 });

  const elapsedEl = $("#elapsed");
  const unit = (n, one, many) => `${n.toLocaleString("nl-NL")} ${n === 1 ? one : many}`;
  let lastSecond = -1;

  function tick() {
    const now = new Date();
    const ms = now - start;
    const s = now.getSeconds() + (reduceMotion ? 0 : now.getMilliseconds() / 1000);
    secondHand.setAttribute("transform", `rotate(${s * 6} 100 100)`);
    minuteHand.setAttribute("transform", `rotate(${(now.getMinutes() + s / 60) * 6} 100 100)`);

    const totalSec = Math.floor(ms / 1000);
    if (totalSec !== lastSecond) {
      lastSecond = totalSec;
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor(totalSec / 3600) % 24;
      const mins = Math.floor(totalSec / 60) % 60;
      const secs = totalSec % 60;
      elapsedEl.textContent =
        `${unit(days, "dag", "dagen")}, ${unit(hours, "uur", "uur")}, ` +
        `${unit(mins, "minuut", "minuten")} en ${unit(secs, "seconde", "seconden")}.`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- Reasons deck ---------- */

  const deck = $("#deck");
  const deckCount = $("#deck-count");
  const cards = G.reasons.map((text, i) => {
    const card = document.createElement("div");
    card.className = "reason";
    card.style.setProperty("--r", ((i * 53) % 9) - 4 + "deg");
    card.innerHTML = `<p>${text}</p>`;
    deck.appendChild(card);
    return card;
  });
  let seen = 1;

  function layoutDeck() {
    cards.forEach((card, pos) => {
      card.style.setProperty("--i", Math.min(pos, 3));
      card.style.zIndex = cards.length - pos;
      card.setAttribute("aria-hidden", pos === 0 ? "false" : "true");
    });
    deckCount.textContent = `${seen} van ${cards.length}`;
  }

  let dealing = false;
  function nextReason() {
    if (dealing || cards.length < 2) return;
    dealing = true;
    const top = cards[0];
    top.classList.add("leaving");
    setTimeout(() => {
      top.classList.remove("leaving");
      cards.push(cards.shift());
      seen = (seen % cards.length) + 1;
      layoutDeck();
      dealing = false;
    }, reduceMotion ? 0 : 420);
  }

  layoutDeck();
  deck.addEventListener("click", nextReason);
  $("#deck-next").addEventListener("click", nextReason);

  /* ---------- Negatives ---------- */

  const film = $("#film");
  G.negatives.forEach((neg, i) => {
    const frame = document.createElement("button");
    frame.type = "button";
    frame.className = "frame";
    frame.setAttribute("aria-pressed", "false");
    frame.setAttribute("aria-label", `Negatief ${i + 1} tegen het licht houden`);
    frame.innerHTML = `
      <img src="${neg.src}" alt="" loading="lazy" decoding="async"${neg.pos ? ` style="object-position:${neg.pos}"` : ""}>
      <span class="edge" aria-hidden="true"><span>${i + 1}</span><span>${i + 1}A</span></span>`;
    frame.addEventListener("click", () => {
      const lit = frame.classList.toggle("lit");
      frame.setAttribute("aria-pressed", String(lit));
    });
    film.appendChild(frame);
  });

  /* ---------- Tickets ---------- */

  const ticketList = $("#tickets");
  const torn = store.get("tickets", {});
  const dateFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" });

  function statusHtml(i, when) {
    const t = G.tickets[i];
    const msg = `Hé ${G.from}, ik wissel bon nº ${i + 1} in: ${t.title} 💖`;
    return `Afgescheurd op ${dateFmt.format(new Date(when))}. ` +
      `<a href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Laat ${G.from} het weten</a>`;
  }

  G.tickets.forEach((t, i) => {
    const li = document.createElement("li");
    li.className = "ticket";
    li.innerHTML = `
      <div class="t-main">
        <span class="t-no">nº ${i + 1}</span>
        <h3>${t.title}</h3>
        <p class="t-status" hidden></p>
        <span class="stamp" aria-hidden="true">Ingewisseld</span>
      </div>
      <button class="t-stub" type="button" aria-label="Scheur bon ${i + 1} af: ${t.title}"><span>Scheur af</span></button>`;
    ticketList.appendChild(li);

    const stub = li.querySelector(".t-stub");
    const status = li.querySelector(".t-status");

    function markTorn(when, animate) {
      li.classList.add("torn");
      if (!animate) li.classList.add("gone");
      status.innerHTML = statusHtml(i, when);
      status.hidden = false;
    }

    function tear() {
      if (li.classList.contains("torn")) return;
      const when = Date.now();
      torn[i] = when;
      store.set("tickets", torn);
      stub.style.translate = "";
      stub.style.rotate = "";
      markTorn(when, true);
      burst(...centerOf(stub), 10);
      stub.addEventListener("animationend", () => li.classList.add("gone"), { once: true });
      status.querySelector("a").focus({ preventScroll: true });
    }

    if (torn[i]) markTorn(torn[i], false);

    // Sleep de strook naar rechts om hem af te scheuren, of tik erop
    let startX = null;
    stub.addEventListener("pointerdown", (e) => {
      startX = e.clientX;
      stub.setPointerCapture(e.pointerId);
      stub.classList.add("dragging");
    });
    stub.addEventListener("pointermove", (e) => {
      if (startX === null) return;
      const dx = Math.max(0, Math.min(120, e.clientX - startX));
      stub.style.translate = `${dx}px ${dx * 0.15}px`;
      stub.style.rotate = `${dx * 0.12}deg`;
    });
    stub.addEventListener("pointerup", (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      stub.classList.remove("dragging");
      if (dx > 60 || Math.abs(dx) < 6) tear();
      else { stub.style.translate = ""; stub.style.rotate = ""; }
    });
    stub.addEventListener("pointercancel", () => {
      startX = null;
      stub.classList.remove("dragging");
      stub.style.translate = "";
      stub.style.rotate = "";
    });
    stub.addEventListener("click", (e) => { if (e.detail === 0) tear(); }); // toetsenbord
  });

  /* ---------- Finale ---------- */

  const lights = $("#lights");
  const note = $("#note");
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  note.innerHTML =
    `<p>${esc(G.note.greeting)}</p>` +
    G.note.body.map((p) => `<p>${esc(p)}</p>`).join("") +
    `<p class="note-sign">${esc(G.note.sign)}</p>` +
    (G.note.ps ? `<p class="note-ps">${esc(G.note.ps)}</p>` : "");

  lights.addEventListener("click", () => {
    const on = body.classList.toggle("lights-on");
    lights.setAttribute("aria-pressed", String(on));
    lights.querySelector(".switch-label").textContent = on ? "Doe het grote licht weer uit" : "Doe het grote licht aan";
    if (on && note.hidden) {
      note.hidden = false;
      setTimeout(() => burst(...centerOf(note), 24), 500);
    }
  });
})();
