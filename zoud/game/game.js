/* Chai Pot: The Split - a financial-literacy game. MIT (c) 2026 Farah Khan. */
(function () {
  "use strict";
  var C = window.Content, M = window.Money, ALL = C.ALL;

  /* ---------- UI strings ---------- */
  var T = {
    en: {
      game: "Chai Pot: The Split", short: "Chai Pot", sub: "Make FinLit Fun",
      tagline: "Four flatmates. One shared pot. Three months of bills, birthdays and bad links.",
      pitch: "Split bills fairly, settle debts in the fewest payments, save together for a trip, and spot the scams hiding in your group chat.",
      play: "Play", settings: "Settings", howtitle: "Each month you…",
      h1: "Split the bill", h1d: "Read the chat, assign who had what. VAT shared fairly.",
      h2: "Settle up", h2d: "Clear every balance in as few transfers as possible.",
      h3: "Save together", h3d: "Make the call on the trip jar and emergencies.",
      h4: "Spot the scam", h4d: "Legit or scam? Learn the red flags.",
      month: "Month", of: "of", harmony: "Harmony", jar: "Trip jar", buffer: "Buffer", shield: "Scams caught",
      st_bill: "Split", st_settle: "Settle", st_save: "Save", st_scam: "Scams",
      start: "Let's go",
      billT: "Split the bill", billHelp: "For every line, tap the people who shared it. Use the group chat as your clues.",
      chat: "Flat group chat", receipt: "Receipt", subtotal: "Subtotal", vat: "VAT 5%", total: "Total", paidBy: "Paid by",
      check: "Check my split", equal: "Just split equally", treat: "Birthday rule: the others cover Aisha's share",
      needAll: "Every line needs at least one person.",
      wrongN: "Not quite. {n} line(s) don't match what people said. Re-read the chat.",
      wrongTreat: "Lines are right, but what did the chat say about birthdays?",
      equalWarn: "If you split {total} equally, everyone pays {eq}. But {name} only had {fair} worth. That's {diff} extra for food they never ate. Harmony drops.",
      fairT: "Fair split vs. equal split", fair: "Fair share", eqs: "Equal split", over: "would overpay {x}", under: "would underpay {x}",
      fairMsg: "Splitting by what each person had, with VAT shared in proportion, keeps everyone whole.",
      next: "Continue",
      settleT: "Settle up", settleHelp: "Tap someone who owes, then someone who is owed. Each transfer moves as much as it can. Clear every balance in as few transfers as possible.",
      ledger: "Who paid what", paid: "Paid", share: "Share", net: "Balance", owes: "owes", owed: "is owed", even: "settled",
      pickPayer: "Pick someone who owes money.", pickPayee: "Now pick who {name} pays.",
      transfers: "Transfers", undo: "Undo", reset: "Start over",
      doneSettle: "All settled in {n} transfer(s). Fewest possible: {min}.",
      tipSettle: "Tip: look for two balances that cancel exactly. Pair them first.",
      saveT: "Save together", payday: "Payday: {x} went into the trip jar automatically ({plan}).",
      repayIn: "Rohan paid back {x}, right on plan.", repayBuf: "Rohan paid {x} back into the emergency buffer.",
      looseBad: "Rohan still hasn't paid back the AED 350. Nobody wants to bring it up. Things feel awkward.",
      goal: "Goal",
      scamT: "Spot the scam", scamHelp: "New messages. Legit or scam?", legit: "Looks legit", scam: "Scam!",
      right: "Correct!", wrongS: "Careful!", nextMsg: "Next message",
      recapT: "Month recap", lessons: "What you practised",
      final: "Your Chai Pot report", again: "Play again",
      r_split: "Fair splits", r_settle: "Settle efficiency", r_jar: "Trip jar", r_buf: "Emergency buffer", r_harm: "Flat harmony", r_scam: "Scams caught",
      goalHit: "Hatta trip funded!", goalMiss: "Short of the AED 1,800 goal.",
      titles: ["Chai Pot Champion", "Smart Splitter", "Learning the Ropes"],
      takeaways: [
        "Split by what each person had; share tax in proportion. Equal isn't always fair.",
        "Settle in as few payments as possible: net everyone first, pair exact matches.",
        "Pay yourself first: save on payday, in proportion to income.",
        "Emergencies need an emergency fund, and loans to friends need clear terms.",
        "Banks never ask for your OTP. Guaranteed high returns, 'new number' money requests and overpayment refunds are scams."
      ],
      lang: "Language", size: "Text size", contrast: "High contrast", motion: "Reduce motion", sound: "Sound effects", close: "Close", on: "On", off: "Off",
      credit: "Made by Farah Khan for Zoud GameLab 2026 · All amounts in AED · UAE VAT 5% · Fictional characters"
    },
    ar: {
      game: "صندوق الشاي: القسمة", short: "صندوق الشاي", sub: "اجعل الثقافة المالية ممتعة",
      tagline: "أربعة أصدقاء في شقة واحدة. صندوق مشترك واحد. ثلاثة أشهر من الفواتير وأعياد الميلاد والروابط المشبوهة.",
      pitch: "قسّم الفواتير بعدل، وسدّد الديون بأقل عدد من التحويلات، وادّخروا معًا لرحلة، واكتشف رسائل الاحتيال في مجموعة الدردشة.",
      play: "ابدأ اللعب", settings: "الإعدادات", howtitle: "في كل شهر…",
      h1: "قسّم الفاتورة", h1d: "اقرأ الدردشة وحدّد من أكل ماذا. الضريبة تُقسَم بعدل.",
      h2: "سدّد الحسابات", h2d: "صفِّ كل الأرصدة بأقل عدد من التحويلات.",
      h3: "ادّخروا معًا", h3d: "قرّر بشأن حصّالة الرحلة والطوارئ.",
      h4: "اكشف الاحتيال", h4d: "رسالة سليمة أم احتيال؟ تعلّم العلامات التحذيرية.",
      month: "الشهر", of: "من", harmony: "الانسجام", jar: "حصّالة الرحلة", buffer: "الطوارئ", shield: "احتيال مكشوف",
      st_bill: "القسمة", st_settle: "التسديد", st_save: "الادّخار", st_scam: "الاحتيال",
      start: "هيا بنا",
      billT: "قسّم الفاتورة", billHelp: "لكل بند، اضغط على الأشخاص الذين تشاركوه. استعن بمجموعة الدردشة.",
      chat: "مجموعة الشقة", receipt: "الإيصال", subtotal: "المجموع الفرعي", vat: "ضريبة 5%", total: "الإجمالي", paidBy: "دفع",
      check: "تحقّق من القسمة", equal: "قسّمها بالتساوي فقط", treat: "قاعدة عيد الميلاد: الآخرون يدفعون حصّة عائشة",
      needAll: "كل بند يحتاج إلى شخص واحد على الأقل.",
      wrongN: "ليس تمامًا. {n} بند/بنود لا تطابق ما قيل. أعد قراءة الدردشة.",
      wrongTreat: "البنود صحيحة، لكن ماذا قالت الدردشة عن عيد الميلاد؟",
      equalWarn: "إذا قسّمت {total} بالتساوي، يدفع كل واحد {eq}. لكن {name} أكل/أكلت بقيمة {fair} فقط. أي {diff} زيادة على طعام لم يأكله. ينخفض الانسجام.",
      fairT: "القسمة العادلة مقابل القسمة المتساوية", fair: "الحصّة العادلة", eqs: "القسمة المتساوية", over: "سيدفع {x} زيادة", under: "سيدفع {x} أقل",
      fairMsg: "القسمة بحسب ما أخذه كل شخص، مع توزيع الضريبة بالنسبة، تحفظ حق الجميع.",
      next: "متابعة",
      settleT: "سدّد الحسابات", settleHelp: "اضغط على شخص عليه دين، ثم على شخص له مال. كل تحويل ينقل أكبر مبلغ ممكن. صفِّ كل الأرصدة بأقل عدد من التحويلات.",
      ledger: "من دفع ماذا", paid: "دفع", share: "الحصّة", net: "الرصيد", owes: "عليه", owed: "له", even: "مُسدَّد",
      pickPayer: "اختر شخصًا عليه مال.", pickPayee: "الآن اختر لمن يدفع {name}.",
      transfers: "التحويلات", undo: "تراجع", reset: "من جديد",
      doneSettle: "تمّت التسوية بـ{n} تحويل. الحد الأدنى الممكن: {min}.",
      tipSettle: "تلميح: ابحث عن رصيدين يلغي أحدهما الآخر تمامًا، وابدأ بهما.",
      saveT: "ادّخروا معًا", payday: "يوم الراتب: دخل {x} إلى حصّالة الرحلة تلقائيًا ({plan}).",
      repayIn: "أعاد روهان {x} في موعده حسب الخطة.", repayBuf: "أعاد روهان {x} إلى صندوق الطوارئ.",
      looseBad: "لم يُعِد روهان الـ350 درهمًا بعد. لا أحد يريد فتح الموضوع. الجو متوتّر.",
      goal: "الهدف",
      scamT: "اكشف الاحتيال", scamHelp: "رسائل جديدة. سليمة أم احتيال؟", legit: "تبدو سليمة", scam: "احتيال!",
      right: "صحيح!", wrongS: "انتبه!", nextMsg: "الرسالة التالية",
      recapT: "ملخّص الشهر", lessons: "ما تدرّبت عليه",
      final: "تقرير صندوق الشاي", again: "العب مجددًا",
      r_split: "قسمة عادلة", r_settle: "كفاءة التسديد", r_jar: "حصّالة الرحلة", r_buf: "صندوق الطوارئ", r_harm: "انسجام الشقة", r_scam: "احتيال مكشوف",
      goalHit: "رحلة حتّا مموّلة!", goalMiss: "أقل من هدف 1,800 درهم.",
      titles: ["بطل صندوق الشاي", "مقسِّم ذكي", "في بداية الطريق"],
      takeaways: [
        "قسّم بحسب ما أخذه كل شخص، ووزّع الضريبة بالنسبة. المساواة ليست دائمًا عدلًا.",
        "سدّد بأقل عدد من الدفعات: احسب صافي كل شخص أولًا، وابدأ بالأرصدة المتطابقة.",
        "ادفع لنفسك أولًا: ادّخر يوم الراتب، وبحسب الدخل.",
        "الطوارئ تحتاج صندوق طوارئ، والقروض بين الأصدقاء تحتاج شروطًا واضحة.",
        "البنك لا يطلب رمز التحقق أبدًا. العوائد العالية المضمونة وطلبات المال من «رقم جديد» واسترداد الدفع الزائد كلها احتيال."
      ],
      lang: "اللغة", size: "حجم النص", contrast: "تباين عالٍ", motion: "تقليل الحركة", sound: "المؤثرات الصوتية", close: "إغلاق", on: "تشغيل", off: "إيقاف",
      credit: "من تطوير فرح خان لـ Zoud GameLab 2026 · جميع المبالغ بالدرهم · ضريبة القيمة المضافة 5% · الشخصيات خيالية"
    }
  };

  var ICON = {
    jar: '<path d="M7 3h10v3l2 3v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9l2-3z" fill="#ffd36b" stroke="#9a6b00" stroke-width="1.6"/><path d="M7 6h10" stroke="#9a6b00" stroke-width="1.6"/>',
    buf: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#cfe9de" stroke="#0b7a55" stroke-width="1.6"/><path d="M12 7v8M8 11h8" stroke="#0b7a55" stroke-width="2.2"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#dbe8ff" stroke="#1f4fa8" stroke-width="1.6"/><path d="M8 12l3 3 5-6" fill="none" stroke="#1f4fa8" stroke-width="2.2"/>',
    chat: '<path d="M4 4h16v12H9l-5 4z" fill="#fff3e2" stroke="#7a3f12" stroke-width="1.6"/><path d="M8 9h8M8 12h5" stroke="#7a3f12" stroke-width="1.6"/>',
    book: '<path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z" fill="#fff3e2" stroke="#7a3f12" stroke-width="1.6"/><path d="M9 8h6M9 12h6" stroke="#7a3f12" stroke-width="1.6"/>',
    cake: '<path d="M4 12h16v8H4z" fill="#ffd1dc" stroke="#a3365a" stroke-width="1.6"/><path d="M4 15c2 2 4 2 5.3 0s3.4-2 5.3 0 3.4 2 5.4 0" fill="none" stroke="#a3365a" stroke-width="1.4"/><path d="M12 12V7" stroke="#a3365a" stroke-width="1.6"/><circle cx="12" cy="5" r="1.6" fill="#e69f00"/>',
    trophy: '<path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="#ffd36b" stroke="#9a6b00" stroke-width="1.6"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4M12 13v4M8 21h8l-1-4H9z" fill="none" stroke="#9a6b00" stroke-width="1.6"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="#fde7e5" stroke="#b3261e" stroke-width="1.8"/>',
    gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="1.8"/>'
  };
  function ic(n, sz) { return '<svg class="ic" width="' + (sz || 18) + '" height="' + (sz || 18) + '" viewBox="0 0 24 24" aria-hidden="true">' + ICON[n] + "</svg>"; }

  /* ---------- state ---------- */
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem("cp-split-settings") || "{}"); } catch (e) {}
  var S = {
    lang: saved.lang || (/^ar/i.test(navigator.language || "") ? "ar" : "en"),
    fs: saved.fs || 1, hc: !!saved.hc,
    rm: saved.rm != null ? saved.rm : !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches),
    snd: saved.snd != null ? saved.snd : true
  };
  var G;
  function newGame() {
    G = { m: 0, stage: "title", jar: 0, buffer: 0, harmony: 70, plan: null, planAmt: 0, repay: 0, loose: false, bufLoan: 0,
      splitOk: 0, splitN: 0, settleStars: 0, settleN: 0, scamOk: 0, scamN: 0, tried: {} };
  }
  newGame();

  function t(k, vars) {
    var s = (T[S.lang] && T[S.lang][k]) || T.en[k] || k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split("{" + v + "}").join(vars[v]); });
    return s;
  }
  function L(o) { return o == null ? "" : typeof o === "string" ? o : (o[S.lang] != null ? o[S.lang] : o.en); }
  function AR() { return S.lang === "ar" ? "←" : "→"; }
  function money(f) { return M.fmt(f, S.lang); }
  function nm(id) { return L(C.MEMBERS[id].name); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function av(id, cls) {
    var m = C.MEMBERS[id];
    return '<span class="av ' + (cls || "") + '" style="--c:' + m.color + ';--ring:' + m.ring + '" aria-hidden="true">' + L(m.initial) + "</span>";
  }
  function saveSettings() { try { localStorage.setItem("cp-split-settings", JSON.stringify({ lang: S.lang, fs: S.fs, hc: S.hc, rm: S.rm, snd: S.snd })); } catch (e) {} }
  function applySettings() {
    document.documentElement.lang = S.lang;
    document.documentElement.dir = S.lang === "ar" ? "rtl" : "ltr";
    document.documentElement.style.setProperty("--fs", S.fs);
    document.body.classList.toggle("hc", S.hc);
    document.body.classList.toggle("rm", S.rm);
    document.title = t("game");
  }

  /* ---------- sound (always paired with a visible message) ---------- */
  var actx;
  function beep(kind) {
    if (!S.snd) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var notes = { good: [523, 659, 784], bad: [220, 185], coin: [988, 1319], tap: [660] }[kind] || [440];
      notes.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * 0.09;
        o.type = kind === "bad" ? "sawtooth" : "triangle"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + 0.2);
      });
    } catch (e) {}
  }
  var toastTimer;
  function toast(msg, kind) {
    var el = document.getElementById("toast");
    el.textContent = msg; el.className = "on " + (kind || "");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.className = ""; }, 2600);
    document.getElementById("live").textContent = msg;
  }
  function coinFly(fromEl, toEl) {
    if (S.rm || !fromEl || !toEl) return;
    var a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    var c = document.createElement("div"); c.className = "fly";
    c.style.left = a.left + a.width / 2 - 13 + "px"; c.style.top = a.top + a.height / 2 - 13 + "px";
    document.body.appendChild(c);
    requestAnimationFrame(function () { c.style.transform = "translate(" + (b.left - a.left + (b.width - a.width) / 2) + "px," + (b.top - a.top + (b.height - a.height) / 2) + "px) scale(.8)"; });
    setTimeout(function () { c.style.opacity = 0; }, 650); setTimeout(function () { c.remove(); }, 1400);
  }
  function harmony(d) { G.harmony = Math.max(0, Math.min(100, G.harmony + d)); }

  /* ---------- shell ---------- */
  var app = document.getElementById("app");
  function hud() {
    if (G.stage === "title") return "";
    var mo = G.stage === "final" ? "" : '<span class="month">' + t("month") + " " + (G.m + 1) + " " + t("of") + " 3</span>";
    var jarPct = Math.min(100, Math.round(G.jar / C.GOAL * 100));
    return '<header class="hud" role="banner"><span class="brand">☕ ' + t("short") + "</span>" + mo +
      '<div class="meters" aria-label="status">' +
      '<span class="meter" id="m-h" title="' + t("harmony") + '">♥ <span class="lbl">' + t("harmony") + '</span> <span class="bar"><i style="width:' + G.harmony + '%"></i></span> ' + G.harmony + "%</span>" +
      '<span class="meter" id="m-j">' + ic("jar") + ' <span class="lbl">' + t("jar") + '</span> <span class="bar"><i style="width:' + jarPct + '%;background:#d99a00"></i></span> ' + money(G.jar) + "</span>" +
      '<span class="meter" id="m-b">' + ic("buf") + ' <span class="lbl">' + t("buffer") + "</span> " + money(G.buffer) + "</span>" +
      '<span class="meter" id="m-s">' + ic("shield") + ' <span class="lbl">' + t("shield") + "</span> " + G.scamOk + "/" + G.scamN + "</span>" +
      '</div><button class="iconbtn" id="btn-set" aria-label="' + t("settings") + '">' + ic("gear") + "</button></header>";
  }
  function road(cur) {
    var st = ["bill", "settle", "save", "scam"], idx = cur === "done" ? 4 : st.indexOf(cur);
    return '<div class="road" aria-label="progress">' + st.map(function (s, i) {
      return '<span class="' + (i < idx ? "done" : i === idx ? "on" : "") + '">' + (i < idx ? "✓ " : "") + t("st_" + s) + "</span>";
    }).join("") + "</div>";
  }
  function render(html) {
    app.innerHTML = hud() + '<main id="main" tabindex="-1"><div class="wrap">' + html + '<div class="foot">' + t("credit") + "</div></div></main>";
    var sb = document.getElementById("btn-set"); if (sb) sb.onclick = openSettings;
    var mn = document.getElementById("main"); if (mn) mn.scrollTop = 0;
  }
  function go(stage) { G.stage = stage; draw(); var mn = document.getElementById("main"); if (mn) mn.focus({ preventScroll: true }); }
  function draw() {
    applySettings();
    ({ title: drawTitle, intro: drawIntro, bill: drawBill, settle: drawSettle, save: drawSave, scam: drawScam, recap: drawRecap, final: drawFinal })[G.stage]();
  }

  /* ---------- title ---------- */
  function drawTitle() {
    render('<section class="title"><div><span class="tag">Zoud GameLab · ' + t("sub") + "</span><h1>" + t("game") + '</h1><p style="font-size:1.15em">' + t("tagline") + '</p><p class="muted">' + t("pitch") + "</p>" +
      '<h3 style="margin-top:14px">' + t("howtitle") + '</h3><div class="how">' +
      ["1", "2", "3", "4"].map(function (n) { return "<div><b>" + n + ". " + t("h" + n) + "</b>" + t("h" + n + "d") + "</div>"; }).join("") + "</div>" +
      '<div class="row"><button class="btn" id="play" style="font-size:1.15em;padding:12px 28px">▶ ' + t("play") + '</button>' +
      '<div class="seg" role="group" aria-label="' + t("lang") + '"><button data-l="en" aria-pressed="' + (S.lang === "en") + '">English</button><button data-l="ar" aria-pressed="' + (S.lang === "ar") + '">العربية</button></div>' +
      '<button class="btn alt" id="set2">' + ic("gear") + " " + t("settings") + "</button></div></div>" +
      '<div class="card" style="text-align:center"><div class="cup"><span class="steam" style="left:70px"></span><span class="steam" style="left:100px;animation-delay:.8s"></span><span class="steam" style="left:130px;animation-delay:1.6s"></span><div class="glass"></div><div class="handle"></div>' +
      '<span class="coin" style="left:0;top:110px">AED</span><span class="coin" style="left:190px;top:20px;animation-delay:1s">5%</span></div>' +
      '<div class="row" style="justify-content:center">' + ALL.map(function (id) { return '<div style="text-align:center">' + av(id, "lg") + '<div style="font-weight:700">' + nm(id) + '</div><div class="muted" style="font-size:.8em">' + L(C.MEMBERS[id].job) + "</div></div>"; }).join("") + "</div></div></section>");
    document.getElementById("play").onclick = function () { beep("tap"); newGame(); go("intro"); };
    document.getElementById("set2").onclick = openSettings;
    [].forEach.call(document.querySelectorAll("[data-l]"), function (b) { b.onclick = function () { S.lang = b.dataset.l; saveSettings(); draw(); }; });
  }

  /* ---------- intro ---------- */
  function drawIntro() {
    var mo = C.MONTHS[G.m];
    render('<div class="card" style="max-width:760px;margin:6vh auto 0"><span class="tag">' + t("month") + " " + (G.m + 1) + " " + t("of") + " 3</span><h2>" + L(mo.title) + "</h2>" + road("") +
      '<p style="font-size:1.1em">' + L(mo.intro) + '</p><div class="row" style="margin:12px 0">' + ALL.map(function (id) { return av(id, "lg"); }).join("") + "</div>" +
      '<button class="btn" id="go">' + t("start") + " " + AR() + "</button></div>");
    document.getElementById("go").onclick = function () { beep("tap"); G.assign = {}; G.treat = false; G.billFirst = true; G.equalShown = false; go("bill"); };
  }

  /* ---------- bill ---------- */
  function truthAssign(bill) { var a = {}; bill.items.forEach(function (i) { a[i.id] = i.truth.slice(); }); return a; }
  function drawBill() {
    var mo = C.MONTHS[G.m], bill = mo.bill;
    var tr = M.billShares(bill, truthAssign(bill), ALL, { treat: bill.treat });
    var lines = bill.items.map(function (it) {
      var sel = G.assign[it.id] || [];
      return '<div class="line" id="ln-' + it.id + '"><span>' + (it.qty > 1 ? it.qty + " × " : "") + L(it.name) + "</span><span>" + money(it.price * it.qty).replace("AED ", "") + "</span>" +
        '<div class="who" role="group" aria-label="' + esc(L(it.name)) + '">' + ALL.map(function (id) {
          return '<button class="chip" data-it="' + it.id + '" data-m="' + id + '" aria-pressed="' + (sel.indexOf(id) >= 0) + '">' + av(id, "sm") + nm(id) + "</button>";
        }).join("") + "</div></div>";
    }).join("");
    var chat = bill.clues.map(function (c) { return '<div class="msg">' + av(c.who, "sm") + '<div class="bubble"><b>' + nm(c.who) + "</b>" + L(c) + "</div></div>"; }).join("") +
      '<div class="msg">' + av(bill.nudge.who, "sm") + '<div class="bubble nudge"><b>' + nm(bill.nudge.who) + "</b>" + L(bill.nudge) + "</div></div>";
    render('<h2>' + L(mo.title) + "</h2>" + road("bill") + '<p class="muted">' + t("billHelp") + '</p><div class="grid2"><div class="card"><div class="receipt"><div class="hd">' + esc(L(bill.place)).toUpperCase() + "</div>" + lines +
      '<div class="tot"><span>' + t("subtotal") + "</span><span>" + money(tr.subtotal) + '</span></div><div class="tot"><span>' + t("vat") + "</span><span>" + money(tr.vat) + '</span></div><div class="tot big"><span>' + t("total") + "</span><span>" + money(tr.total) + "</span></div>" +
      '<div class="muted" style="text-align:center;margin-top:6px">' + t("paidBy") + " " + nm(bill.payer) + "</div></div></div>" +
      '<div class="card"><h3>' + ic("chat", 22) + " " + t("chat") + '</h3><div class="chat">' + chat + "</div>" +
      (bill.treat ? '<label class="switch" style="margin-top:12px"><input type="checkbox" id="treat"' + (G.treat ? " checked" : "") + "> " + ic("cake", 22) + " " + t("treat") + "</label>" : "") +
      '<div class="row" style="margin-top:14px"><button class="btn teal" id="chk">✓ ' + t("check") + '</button><button class="btn alt" id="eq">÷ ' + t("equal") + "</button></div><div id='fb'></div></div></div>");
    [].forEach.call(document.querySelectorAll(".chip"), function (b) {
      b.onclick = function () {
        var a = G.assign[b.dataset.it] = G.assign[b.dataset.it] || [], i = a.indexOf(b.dataset.m);
        if (i >= 0) a.splice(i, 1); else a.push(b.dataset.m);
        b.setAttribute("aria-pressed", i < 0); beep("tap");
        document.getElementById("ln-" + b.dataset.it).classList.remove("wrong", "right");
      };
    });
    var tg = document.getElementById("treat"); if (tg) tg.onchange = function () { G.treat = tg.checked; beep("tap"); };
    document.getElementById("eq").onclick = function () {
      var eq = M.splitEqual(tr.total, ALL), worst = ALL.filter(function (id) { return id !== bill.treat; }).sort(function (a, b) { return (eq[b] - tr.share[b]) - (eq[a] - tr.share[a]); })[0];
      if (!G.equalShown) { harmony(-4); G.equalShown = true; }
      beep("bad");
      document.getElementById("fb").innerHTML = '<div class="note warn">' + t("equalWarn", { total: money(tr.total), eq: money(eq[worst]), name: nm(worst), fair: money(tr.share[worst]), diff: money(eq[worst] - tr.share[worst]) }) + "</div>";
      refreshHud();
    };
    document.getElementById("chk").onclick = function () { checkBill(bill, tr); };
  }
  function sameSet(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) >= 0; }); }
  function checkBill(bill, tr) {
    var empty = bill.items.some(function (it) { return !(G.assign[it.id] || []).length; });
    if (empty) { toast(t("needAll"), "bad"); beep("bad"); return; }
    var wrong = 0;
    bill.items.forEach(function (it) {
      var ok = sameSet(G.assign[it.id], it.truth), el = document.getElementById("ln-" + it.id);
      el.classList.remove("wrong", "right"); void el.offsetWidth; el.classList.add(ok ? "right" : "wrong");
      if (!ok) wrong++;
    });
    var fb = document.getElementById("fb");
    if (wrong) { G.billFirst = false; beep("bad"); fb.innerHTML = '<div class="note bad">' + t("wrongN", { n: wrong }) + "</div>"; toast(t("wrongS"), "bad"); return; }
    if (!!bill.treat !== !!G.treat) { G.billFirst = false; beep("bad"); fb.innerHTML = '<div class="note bad">' + t("wrongTreat") + "</div>"; return; }
    beep("good"); toast(t("right"), "good");
    G.splitN++; if (G.billFirst) G.splitOk++;
    harmony(G.billFirst ? 6 : 3);
    showCompare(bill, tr);
  }
  function showCompare(bill, tr) {
    var eq = M.splitEqual(tr.total, ALL), max = Math.max.apply(null, ALL.map(function (id) { return Math.max(eq[id], tr.share[id]); }));
    var rows = ALL.map(function (id) {
      var d = eq[id] - tr.share[id];
      return '<div class="r"><div class="row" style="gap:6px">' + av(id, "sm") + "<b>" + nm(id) + '</b></div><div class="bars"><div class="fair" style="width:' + Math.max(12, tr.share[id] / max * 100) + '%">' + money(tr.share[id]) + '</div><div class="eq" style="width:' + Math.max(12, eq[id] / max * 100) + '%">' + money(eq[id]) +
        "</div>" + (d ? '<span class="delta ' + (d > 0 ? "up" : "dn") + '">' + t("eqs") + ": " + t(d > 0 ? "over" : "under", { x: money(Math.abs(d)) }) + "</span>" : "") + "</div></div>";
    }).join("");
    var main = document.querySelector(".grid2");
    main.outerHTML = '<div class="card"><h3>' + t("fairT") + '</h3><div class="legend"><span><i style="background:var(--teal)"></i>' + t("fair") + '</span><span><i style="background:#a7a7a7"></i>' + t("eqs") + '</span></div><div class="cmp">' + rows + '</div><div class="note">' + t("fairMsg") + '</div><button class="btn" id="nx">' + t("next") + " " + AR() + "</button></div>";
    refreshHud();
    document.getElementById("nx").onclick = function () { beep("tap"); G.tx = []; G.sel = null; G.settleScored = false; go("settle"); };
  }

  /* ---------- settle ---------- */
  function monthNet() {
    var mo = C.MONTHS[G.m], bill = mo.bill, tr = M.billShares(bill, truthAssign(bill), ALL, { treat: bill.treat });
    var paid = {}, share = {}, rows = [];
    ALL.forEach(function (m) { paid[m] = 0; share[m] = tr.share[m]; });
    paid[bill.payer] += tr.total; rows.push({ by: bill.payer, label: L(bill.place), amount: tr.total });
    mo.extras.forEach(function (e) {
      paid[e.by] += e.amount; var s = M.splitEqual(e.amount, ALL);
      ALL.forEach(function (m) { share[m] += s[m]; }); rows.push({ by: e.by, label: L(e.label), amount: e.amount });
    });
    return { paid: paid, share: share, net: M.netBalances(ALL, paid, share), rows: rows };
  }
  function drawSettle() {
    var mn = monthNet(), net = Object.assign({}, mn.net);
    G.tx.forEach(function (x) { net[x.from] += x.amount; net[x.to] -= x.amount; });
    var min = M.minTransfers(mn.net), done = ALL.every(function (m) { return net[m] === 0; });
    var people = ALL.map(function (id) {
      var v = net[id], cls = v < 0 ? "owes" : v > 0 ? "owed" : "even";
      var can = !done && (G.sel ? (v > 0) : (v < 0));
      return '<button class="person ' + cls + (G.sel === id ? " sel" : "") + (G.sel && v > 0 ? " target" : "") + '" data-p="' + id + '"' + (can || G.sel === id ? "" : " disabled") + ">" + av(id, "lg") + "<b>" + nm(id) + '</b><span class="bal">' + money(Math.abs(v)) + '</span><span class="tagline">' + (v < 0 ? "▼ " + t("owes") : v > 0 ? "▲ " + t("owed") : "● " + t("even")) + "</span></button>";
    }).join("");
    var ledger = '<table class="ledger"><thead><tr><th></th><th>' + t("paid") + "</th><th>" + t("share") + "</th><th>" + t("net") + "</th></tr></thead><tbody>" + ALL.map(function (id) {
      return "<tr><td>" + av(id, "sm") + " " + nm(id) + '</td><td class="n">' + money(mn.paid[id]) + '</td><td class="n">' + money(mn.share[id]) + '</td><td class="n" style="color:' + (mn.net[id] < 0 ? "var(--bad)" : "var(--good)") + '">' + (mn.net[id] > 0 ? "+" : "") + money(mn.net[id]) + "</td></tr>";
    }).join("") + "</tbody></table><ul class='muted' style='font-size:.85em;padding-inline-start:18px'>" + mn.rows.map(function (r) { return "<li>" + nm(r.by) + " " + AR() + " " + esc(r.label) + ": " + money(r.amount) + "</li>"; }).join("") + "</ul>";
    var txs = G.tx.map(function (x, i) { return '<div class="tx">' + (i + 1) + ". " + av(x.from, "sm") + nm(x.from) + " " + AR() + " " + av(x.to, "sm") + nm(x.to) + '<span style="margin-inline-start:auto">' + money(x.amount) + "</span></div>"; }).join("");
    var status = done ? "" : '<p id="hint" style="font-weight:700;color:var(--teal-d)">' + (G.sel ? t("pickPayee", { name: nm(G.sel) }) : t("pickPayer")) + "</p>";
    var result = "";
    if (done) {
      var stars = G.tx.length <= min ? 3 : G.tx.length === min + 1 ? 2 : 1;
      if (!G.settleScored) { G.settleScored = true; G.settleStars += stars; G.settleN++; harmony(stars === 3 ? 5 : 2); beep("good"); }
      result = '<div class="note"><div class="stars">' + "★★★".slice(0, stars) + '<span class="off">' + "★★★".slice(stars) + "</span></div>" + t("doneSettle", { n: G.tx.length, min: min }) + (G.tx.length > min ? "<br>" + t("tipSettle") : "") + '</div><button class="btn" id="nx">' + t("next") + " " + AR() + "</button>";
    }
    render('<h2>' + t("settleT") + "</h2>" + road("settle") + '<p class="muted">' + t("settleHelp") + '</p><div class="grid2"><div class="card"><div class="people">' + people + "</div>" + status +
      '<h3 style="margin-top:12px">' + t("transfers") + '</h3><div class="transfers">' + (txs || '<span class="muted">-</span>') + "</div>" +
      (!done ? '<div class="row" style="margin-top:10px"><button class="btn alt" id="undo"' + (G.tx.length ? "" : " disabled") + ">↶ " + t("undo") + '</button><button class="btn alt" id="rst"' + (G.tx.length ? "" : " disabled") + ">⟲ " + t("reset") + "</button></div>" : "") + result +
      '</div><div class="card"><h3>' + ic("book", 22) + " " + t("ledger") + "</h3>" + ledger + "</div></div>");
    [].forEach.call(document.querySelectorAll(".person"), function (b) {
      b.onclick = function () {
        var id = b.dataset.p;
        if (!G.sel) { if (net[id] < 0) { G.sel = id; beep("tap"); drawSettle(); } return; }
        if (G.sel === id) { G.sel = null; drawSettle(); return; }
        if (net[id] > 0) {
          var amt = Math.min(-net[G.sel], net[id]), fromEl = document.querySelector('[data-p="' + G.sel + '"]');
          G.tx.push({ from: G.sel, to: id, amount: amt }); G.sel = null; beep("coin"); coinFly(fromEl, b);
          setTimeout(drawSettle, S.rm ? 0 : 450);
        }
      };
    });
    var u = document.getElementById("undo"); if (u) u.onclick = function () { G.tx.pop(); G.sel = null; drawSettle(); };
    var r = document.getElementById("rst"); if (r) r.onclick = function () { G.tx = []; G.sel = null; drawSettle(); };
    var n = document.getElementById("nx"); if (n) n.onclick = function () { beep("tap"); G.saveDone = false; G.savePre = null; go("save"); };
  }

  /* ---------- save ---------- */
  function drawSave() {
    var mo = C.MONTHS[G.m];
    if (!G.savePre) {
      G.savePre = [];
      if (G.m > 0 && G.planAmt) { G.jar += G.planAmt; G.savePre.push({ k: "", s: t("payday", { x: money(G.planAmt), plan: L(planLabel()) }) }); }
      if (G.m === 2 && G.repay) { G.jar += G.repay; G.savePre.push({ k: "", s: t("repayIn", { x: money(G.repay) }) }); }
      if (G.m === 2 && G.bufLoan) { G.buffer += 17500; G.savePre.push({ k: "", s: t("repayBuf", { x: money(17500) }) }); }
      if (G.m === 2 && G.loose) { harmony(-12); G.savePre.push({ k: "bad", s: t("looseBad") }); }
    }
    var pct = Math.min(100, G.jar / C.GOAL * 100);
    var opts = mo.save.options.map(function (o) { return '<button class="opt' + (G.savePick === o.id && G.saveDone ? " pick" : "") + '" data-o="' + o.id + '"' + (G.saveDone ? " disabled" : "") + ">" + L(o) + "</button>"; }).join("");
    var after = "";
    if (G.saveDone) { var o = mo.save.options.filter(function (x) { return x.id === G.savePick; })[0]; after = '<div class="note ' + (o.id === "all" || o.id === "test" || o.id === "left" ? "warn" : "") + '">' + L(o.why) + '</div><button class="btn" id="nx">' + t("next") + " " + AR() + "</button>"; }
    render('<h2>' + t("saveT") + "</h2>" + road("save") + '<div class="grid2"><div class="card">' + G.savePre.map(function (p) { return '<div class="note ' + p.k + '">' + p.s + "</div>"; }).join("") +
      '<p style="font-size:1.08em;font-weight:600">' + L(mo.save.q) + '</p><div class="opts">' + opts + "</div>" + after + "</div>" +
      '<div class="card" style="text-align:center"><h3>' + ic("jar", 22) + " " + t("jar") + '</h3><div class="jar" id="jar"><div class="fill" style="height:' + pct + '%"></div><div class="goal" style="bottom:100%"></div><div class="lbl">' + money(G.jar) + "</div></div><p>" + t("goal") + ": <b>" + money(C.GOAL) + "</b> · Hatta</p><p>" + ic("buf") + " " + t("buffer") + ": <b>" + money(G.buffer) + "</b></p></div></div>");
    [].forEach.call(document.querySelectorAll(".opt"), function (b) { b.onclick = function () { pickSave(b.dataset.o); }; });
    var n = document.getElementById("nx"); if (n) n.onclick = function () { beep("tap"); G.si = 0; G.sAns = null; go("scam"); };
  }
  function planLabel() { var o = C.MONTHS[0].save.options.filter(function (x) { return x.id === G.plan; })[0]; return o ? { en: o.en, ar: o.ar } : ""; }
  function pickSave(id) {
    var mo = C.MONTHS[G.m], o = mo.save.options.filter(function (x) { return x.id === id; })[0], fx = o.fx;
    G.savePick = id; G.saveDone = true;
    if (G.m === 0) { G.plan = id; G.planAmt = fx.plan; G.jar += fx.plan; }
    if (fx.jar) G.jar = Math.max(0, G.jar + fx.jar);
    if (fx.repay) G.repay = fx.repay;
    if (fx.loose) G.loose = true;
    if (fx.buffer) { G.buffer += fx.buffer - (fx.bufferLoan || 0); G.bufLoan = fx.bufferLoan || 0; }
    if (fx.jarLoseAll) G.jar = 0;
    harmony(fx.harmony || 0);
    beep(fx.harmony > 0 ? "good" : "bad");
    drawSave();
    var j = document.getElementById("jar"); if (j) j.scrollIntoView({ block: "nearest" });
  }

  /* ---------- scam ---------- */
  function drawScam() {
    var mo = C.MONTHS[G.m], msgs = mo.scams, m = msgs[G.si], ans = G.sAns;
    var fb = "";
    if (ans != null) {
      var ok = ans === m.scam;
      fb = '<div class="note ' + (ok ? "" : "bad") + '"><b>' + (ok ? "✓ " + t("right") : "✗ " + t("wrongS")) + "</b> " + L(m.why) + (m.scam ? '<div class="flags">' + L(m.flags).map(function (f) { return "<span>" + ic("flag", 14) + " " + f + "</span>"; }).join("") + "</div>" : "") + "</div>" +
        '<button class="btn" id="nx">' + (G.si < msgs.length - 1 ? t("nextMsg") : t("next")) + " " + AR() + "</button>";
    }
    render('<h2>' + t("scamT") + "</h2>" + road("scam") + '<div class="grid2"><div class="phone"><div class="screen"><div class="muted" style="text-align:center;font-size:.8em">' + t("scamHelp") + " · " + (G.si + 1) + "/" + msgs.length + "</div>" +
      '<div class="sms"><div class="from">' + esc(L(m.from)) + "</div>" + esc(L(m.text)) + "</div>" +
      (ans == null ? '<div class="verdict"><button class="btn legit" id="lg">✓ ' + t("legit") + '</button><button class="btn scam" id="sc">' + ic("flag") + " " + t("scam") + "</button></div>" : "") +
      '</div></div><div class="card">' + (fb || '<p class="muted">' + t("scamHelp") + "</p>") + "</div></div>");
    function answer(v) {
      G.sAns = v; G.scamN++; var ok = v === m.scam;
      if (ok) { G.scamOk++; harmony(1); beep("good"); toast(t("right"), "good"); } else { harmony(-3); beep("bad"); toast(t("wrongS"), "bad"); }
      drawScam();
    }
    var a = document.getElementById("lg"); if (a) a.onclick = function () { answer(false); };
    var b = document.getElementById("sc"); if (b) b.onclick = function () { answer(true); };
    var n = document.getElementById("nx"); if (n) n.onclick = function () {
      beep("tap");
      if (G.si < msgs.length - 1) { G.si++; G.sAns = null; drawScam(); } else go("recap");
    };
  }

  /* ---------- recap / final ---------- */
  function drawRecap() {
    var lessons = T[S.lang].takeaways;
    var pick = [[0, 4], [0, 3, 4], [1, 2, 4]][G.m];
    render('<div class="card" style="max-width:760px;margin:4vh auto 0"><span class="tag">' + L(C.MONTHS[G.m].title) + "</span><h2>" + t("recapT") + "</h2>" + road("done") +
      '<div class="report">' + stat(t("harmony"), G.harmony + "%") + stat(t("jar"), money(G.jar)) + stat(t("shield"), G.scamOk + "/" + G.scamN) + "</div>" +
      "<h3 style='margin-top:14px'>" + t("lessons") + '</h3><ul class="lessons">' + pick.map(function (i) { return "<li>" + lessons[i] + "</li>"; }).join("") + "</ul>" +
      '<button class="btn" id="nx">' + t("next") + " " + AR() + "</button></div>");
    document.getElementById("nx").onclick = function () { beep("tap"); if (G.m < 2) { G.m++; go("intro"); } else go("final"); };
  }
  function stat(k, v, sub) { return '<div class="stat">' + k + "<b>" + v + "</b>" + (sub ? '<span class="muted" style="font-size:.85em">' + sub + "</span>" : "") + "</div>"; }
  function drawFinal() {
    var hit = G.jar >= C.GOAL;
    var score = (G.splitOk / 3) * 25 + (G.settleStars / 9) * 20 + Math.min(1, G.jar / C.GOAL) * 20 + (G.harmony / 100) * 15 + (G.scamOk / Math.max(1, G.scamN)) * 20;
    var title = T[S.lang].titles[score >= 85 ? 0 : score >= 60 ? 1 : 2];
    render('<div class="card" style="max-width:900px;margin:2vh auto 0"><span class="tag">' + t("final") + '</span><h1 style="font-size:2em">' + ic("trophy", 40) + " " + title + '</h1><p class="muted">' + Math.round(score) + " / 100 · " + (hit ? t("goalHit") : t("goalMiss")) + "</p>" +
      '<div class="report">' + stat(t("r_split"), G.splitOk + "/3") + stat(t("r_settle"), "★ " + G.settleStars + "/9") + stat(t("r_jar"), money(G.jar), t("goal") + " " + money(C.GOAL)) + stat(t("r_buf"), money(G.buffer)) + stat(t("r_harm"), G.harmony + "%") + stat(t("r_scam"), G.scamOk + "/" + G.scamN) + "</div>" +
      "<h3 style='margin-top:16px'>" + t("lessons") + '</h3><ol class="lessons">' + T[S.lang].takeaways.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ol>" +
      '<div class="row"><button class="btn" id="again">↻ ' + t("again") + "</button></div></div>");
    beep("good");
    document.getElementById("again").onclick = function () { newGame(); go("title"); };
  }
  function refreshHud() { var h = document.querySelector(".hud"); if (h) { h.outerHTML = hud(); var sb = document.getElementById("btn-set"); if (sb) sb.onclick = openSettings; } }

  /* ---------- settings ---------- */
  function openSettings() {
    var d = document.createElement("div"); d.className = "modal"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    function seg(key, opts) { return '<div class="seg">' + opts.map(function (o) { return '<button data-k="' + key + '" data-v="' + o[0] + '" aria-pressed="' + (String(S[key]) === String(o[0])) + '">' + o[1] + "</button>"; }).join("") + "</div>"; }
    d.innerHTML = '<div class="card"><h2>' + ic("gear", 24) + " " + t("settings") + "</h2>" +
      '<div class="set"><span>' + t("lang") + "</span>" + seg("lang", [["en", "English"], ["ar", "العربية"]]) + "</div>" +
      '<div class="set"><span>' + t("size") + "</span>" + seg("fs", [[1, "A"], [1.15, "A+"], [1.3, "A++"]]) + "</div>" +
      '<div class="set"><span>' + t("contrast") + "</span>" + seg("hc", [[false, t("off")], [true, t("on")]]) + "</div>" +
      '<div class="set"><span>' + t("motion") + "</span>" + seg("rm", [[false, t("off")], [true, t("on")]]) + "</div>" +
      '<div class="set"><span>' + t("sound") + "</span>" + seg("snd", [[true, t("on")], [false, t("off")]]) + "</div>" +
      '<button class="btn" id="cls">' + t("close") + "</button></div>";
    document.body.appendChild(d);
    [].forEach.call(d.querySelectorAll("[data-k]"), function (b) {
      b.onclick = function () {
        var k = b.dataset.k, v = b.dataset.v; S[k] = k === "lang" ? v : k === "fs" ? Number(v) : v === "true";
        saveSettings(); d.remove(); draw(); openSettings();
      };
    });
    d.querySelector("#cls").onclick = function () { d.remove(); };
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    d.querySelector("button").focus();
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { var m = document.querySelector(".modal"); if (m) m.remove(); } });

  window.__game = { G: function () { return G; }, go: go };
  draw();
})();
