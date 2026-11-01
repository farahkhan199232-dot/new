/* Chai Pot: The Split - money math.
 * Amounts are integer fils (1 AED = 100 fils), never floats.
 * splitEqual and the greedy settle-up come from the SplitChai / Chai Pot
 * ledger code (lib/money.ts splitEqual, app/lib/balances.ts simplifyDebts). */
(function (root) {
  "use strict";

  /** Equal split; leftover fils go to the first members so shares always sum to the total. */
  function splitEqual(total, ids) {
    if (!ids.length) throw new Error("No one to split between");
    var n = ids.length, base = Math.floor(total / n), rem = total - base * n, out = {};
    ids.forEach(function (id) { out[id] = base + (rem > 0 ? 1 : 0); if (rem > 0) rem--; });
    return out;
  }

  /** Split `total` in proportion to `weights` (largest-remainder), shares sum exactly to total. */
  function splitProportional(total, weights) {
    var ids = Object.keys(weights), sum = 0;
    ids.forEach(function (id) { sum += weights[id]; });
    var out = {};
    if (sum === 0) return splitEqual(total, ids);
    var given = 0, rema = [];
    ids.forEach(function (id) {
      var exact = (total * weights[id]) / sum, fl = Math.floor(exact);
      out[id] = fl; given += fl; rema.push({ id: id, r: exact - fl });
    });
    rema.sort(function (a, b) { return b.r - a.r; });
    for (var i = 0; given < total; i++, given++) out[rema[i % rema.length].id]++;
    return out;
  }

  /**
   * Fair shares for a bill.
   * bill = { items:[{id, price, qty}], vatPct, serviceFee?, discountPct? }
   * assign = { itemId: [memberIds who shared it] }
   * opts.treat = memberId whose share the others cover (birthday rule)
   */
  function billShares(bill, assign, members, opts) {
    opts = opts || {};
    var sub = {};
    members.forEach(function (m) { sub[m] = 0; });
    var subtotal = 0;
    bill.items.forEach(function (it) {
      var line = it.price * (it.qty || 1);
      subtotal += line;
      var who = (assign[it.id] || []).filter(function (m) { return members.indexOf(m) >= 0; });
      if (!who.length) return;
      var s = splitEqual(line, who);
      Object.keys(s).forEach(function (m) { sub[m] += s[m]; });
    });
    var vat = Math.round(subtotal * (bill.vatPct || 0) / 100);
    var vatShare = splitProportional(vat, sub);
    var share = {};
    members.forEach(function (m) { share[m] = sub[m] + (vatShare[m] || 0); });
    if (opts.treat && share[opts.treat] !== undefined) {
      var others = members.filter(function (m) { return m !== opts.treat; });
      var cover = splitEqual(share[opts.treat], others);
      others.forEach(function (m) { share[m] += cover[m]; });
      share[opts.treat] = 0;
    }
    return { subtotal: subtotal, vat: vat, total: subtotal + vat, sub: sub, share: share };
  }

  /** Net balances: + means the group owes them, - means they owe the group. */
  function netBalances(members, paid, share) {
    var net = {};
    members.forEach(function (m) { net[m] = (paid[m] || 0) - (share[m] || 0); });
    return net;
  }

  /** Fewest transfers that settle everyone = (#people with a balance) - (max # of zero-sum groups). */
  function minTransfers(net) {
    var vals = Object.keys(net).map(function (k) { return net[k]; }).filter(function (v) { return v !== 0; });
    var n = vals.length;
    if (!n) return 0;
    var full = (1 << n) - 1, sums = new Array(full + 1).fill(0), dp = new Array(full + 1).fill(-1);
    for (var mask = 1; mask <= full; mask++) {
      var low = mask & -mask, i = 31 - Math.clz32(low);
      sums[mask] = sums[mask ^ low] + vals[i];
    }
    dp[0] = 0;
    for (mask = 1; mask <= full; mask++) {
      for (var b = 0; b < n; b++) if (mask & (1 << b)) {
        var prev = mask ^ (1 << b);
        if (dp[prev] >= 0) dp[mask] = Math.max(dp[mask], dp[prev] + (sums[mask] === 0 ? 1 : 0));
      }
    }
    return n - dp[full];
  }

  /** Greedy settle plan (SplitChai simplifyDebts): at most n-1 payments. */
  function simplifyDebts(net) {
    var cr = [], dr = [];
    Object.keys(net).forEach(function (k) {
      if (net[k] > 0) cr.push({ a: k, v: net[k] });
      if (net[k] < 0) dr.push({ a: k, v: -net[k] });
    });
    cr.sort(function (x, y) { return y.v - x.v; });
    dr.sort(function (x, y) { return y.v - x.v; });
    var out = [], i = 0, j = 0;
    while (i < dr.length && j < cr.length) {
      var pay = Math.min(dr[i].v, cr[j].v);
      if (pay > 0) out.push({ from: dr[i].a, to: cr[j].a, amount: pay });
      dr[i].v -= pay; cr[j].v -= pay;
      if (!dr[i].v) i++;
      if (!cr[j].v) j++;
    }
    return out;
  }

  function fmt(fils, lang) {
    var neg = fils < 0, v = Math.abs(fils), s = Math.floor(v / 100).toLocaleString("en-US") + "." + String(v % 100).padStart(2, "0");
    return (neg ? "-" : "") + (lang === "ar" ? s + " درهم" : "AED " + s);
  }

  var api = { splitEqual: splitEqual, splitProportional: splitProportional, billShares: billShares,
    netBalances: netBalances, minTransfers: minTransfers, simplifyDebts: simplifyDebts, fmt: fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Money = api;
})(this);
