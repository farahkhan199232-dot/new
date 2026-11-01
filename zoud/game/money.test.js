const assert=require('assert'),M=require('./money.js'),C=require('./content.js');
const s=M.splitEqual(1000,['a','b','c']);assert.deepStrictEqual(s,{a:334,b:333,c:333});
const p=M.splitProportional(420,{a:1890-90,b:3000,c:2700,d:900});assert.strictEqual(Object.values(p).reduce((x,y)=>x+y),420);
assert.strictEqual(M.minTransfers({a:-5,b:5,c:-7,d:7}),2);assert.strictEqual(M.minTransfers({a:-10,b:4,c:6}),2);
for(const mo of C.MONTHS){const a={};mo.bill.items.forEach(i=>a[i.id]=i.truth);const b=M.billShares(mo.bill,a,C.ALL,{treat:mo.bill.treat});
 assert.strictEqual(Object.values(b.share).reduce((x,y)=>x+y),b.total,'shares sum to total');
 const paid={},share={...b.share};C.ALL.forEach(m=>paid[m]=0);paid[mo.bill.payer]+=b.total;
 for(const e of mo.extras){paid[e.by]+=e.amount;const q=M.splitEqual(e.amount,C.ALL);for(const k in q)share[k]+=q[k];}
 const net=M.netBalances(C.ALL,paid,share);assert.strictEqual(Object.values(net).reduce((x,y)=>x+y),0);
 assert.ok(M.simplifyDebts(net).length>=M.minTransfers(net));}
console.log('money tests ok');
