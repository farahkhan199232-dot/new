/* Chai Pot: The Split - story content, English + Arabic.
 * All money in fils (100 fils = AED 1). UAE VAT is 5%. */
(function (root) {
  "use strict";
  var ALL = ["you", "aisha", "rohan", "maria"];

  var MEMBERS = {
    you:   { name: { en: "You",   ar: "أنت" },   initial: { en: "Y", ar: "أ" }, color: "#E69F00", ring: "solid",  job: { en: "keeps the Chai Pot", ar: "أمين صندوق الشاي" } },
    aisha: { name: { en: "Aisha", ar: "عائشة" }, initial: { en: "A", ar: "ع" }, color: "#56B4E9", ring: "dashed", job: { en: "nurse", ar: "ممرّضة" } },
    rohan: { name: { en: "Rohan", ar: "روهان" }, initial: { en: "R", ar: "ر" }, color: "#009E73", ring: "double", job: { en: "engineer", ar: "مهندس" } },
    maria: { name: { en: "Maria", ar: "ماريا" }, initial: { en: "M", ar: "م" }, color: "#CC79A7", ring: "dotted", job: { en: "junior designer", ar: "مصمّمة مبتدئة" } }
  };

  var MONTHS = [
    {
      title: { en: "Month 1 · Karak Night", ar: "الشهر الأول · ليلة الكرك" },
      intro: {
        en: "Four flatmates in Dubai, one shared Chai Pot. You keep the pot. Tonight: karak and grills at the corner cafeteria. Aisha paid the whole bill on her card.",
        ar: "أربعة أصدقاء يسكنون معًا في دبي، وصندوق شاي واحد مشترك. أنت أمين الصندوق. الليلة: كرك ومشاوي في الكافتيريا القريبة. دفعت عائشة الفاتورة كاملة ببطاقتها."
      },
      bill: {
        place: { en: "Al Noor Cafeteria", ar: "كافتيريا النور" },
        payer: "aisha",
        vatPct: 5,
        items: [
          { id: "k", name: { en: "Karak chai", ar: "شاي كرك" }, price: 200, qty: 4, truth: ALL },
          { id: "s", name: { en: "Chicken shawarma", ar: "شاورما دجاج" }, price: 900, qty: 1, truth: ["rohan"] },
          { id: "f", name: { en: "Falafel wrap", ar: "لفافة فلافل" }, price: 700, qty: 1, truth: ["maria"] },
          { id: "g", name: { en: "Mixed grill platter", ar: "طبق مشاوي مشكّلة" }, price: 4800, qty: 1, truth: ["you", "aisha", "rohan"] },
          { id: "j", name: { en: "Fresh mango juice", ar: "عصير مانجو طازج" }, price: 1200, qty: 1, truth: ["aisha"] }
        ],
        clues: [
          { who: "maria", en: "Just my falafel wrap and one karak for me.", ar: "لفافة الفلافل وكوب كرك واحد فقط." },
          { who: "rohan", en: "Shawarma, a karak, and I shared the grill.", ar: "شاورما وكرك، وتشاركت طبق المشاوي." },
          { who: "aisha", en: "Mango juice, karak, and some of the grill.", ar: "عصير مانجو وكرك وشيء من المشاوي." },
          { who: "you", en: "I had a karak and the grill with Aisha and Rohan.", ar: "شربت كركًا وأكلت المشاوي مع عائشة وروهان." }
        ],
        nudge: { who: "rohan", en: "Easy: split it four ways?", ar: "سهلة: نقسمها على أربعة؟" }
      },
      extras: [ { by: "rohan", amount: 2400, label: { en: "Taxi home", ar: "تاكسي العودة" } } ],
      save: {
        q: { en: "Payday! The flat wants a Hatta weekend together. Goal: AED 1,800 in the trip jar. Salaries: Rohan 12,000 · Aisha 9,000 · You 8,000 · Maria 5,000. How do you save?", ar: "يوم الراتب! يريد الأصدقاء عطلة نهاية أسبوع في حتّا. الهدف: 1,800 درهم في حصّالة الرحلة. الرواتب: روهان 12,000 · عائشة 9,000 · أنت 8,000 · ماريا 5,000. كيف ستدّخرون؟" },
        options: [
          { id: "equal", en: "Everyone puts in AED 150 each payday", ar: "كل واحد يضع 150 درهمًا يوم الراتب",
            fx: { plan: 60000, harmony: -6 },
            why: { en: "Steady and automatic, good. But AED 150 is 3% of Maria's pay and only 1.25% of Rohan's. Equal is not always fair.", ar: "ادّخار منتظم وتلقائي، وهذا جيد. لكن 150 درهمًا تعني 3% من راتب ماريا و1.25% فقط من راتب روهان. المساواة ليست دائمًا عدلًا." } },
          { id: "pct", en: "Everyone saves 2% of salary, the day it lands", ar: "كل واحد يدّخر 2% من راتبه يوم نزوله",
            fx: { plan: 68000, harmony: 8 },
            why: { en: "Pay yourself first, in proportion to income: AED 680 a month and nobody is stretched. Saving on payday beats saving 'what's left'.", ar: "ادفع لنفسك أولًا، وبحسب الدخل: 680 درهمًا شهريًا دون إرهاق أحد. الادّخار يوم الراتب أفضل من ادّخار ما يتبقّى." } },
          { id: "left", en: "Whoever has money left at month end puts some in", ar: "من يتبقّى معه مال آخر الشهر يضع منه",
            fx: { plan: 15000, harmony: 0 },
            why: { en: "Month-end leftovers rarely exist: only AED 150 arrived. Save first, then spend what is left.", ar: "نادرًا ما يتبقّى شيء آخر الشهر: وصل 150 درهمًا فقط. ادّخر أولًا ثم أنفق ما يتبقّى." } }
        ]
      },
      scams: [
        { from: { en: "Aisha (flat group)", ar: "عائشة (مجموعة الشقة)" }, text: { en: "Paid tonight's cafeteria bill, receipt is in the Chai Pot. Settle when you can.", ar: "دفعت فاتورة الكافتيريا الليلة، الإيصال في صندوق الشاي. سدّدوا متى استطعتم." }, scam: false,
          why: { en: "Legit: a known friend, a real shared expense, a receipt, and no rush.", ar: "رسالة سليمة: صديقة معروفة، ومصروف مشترك حقيقي، وإيصال، ولا استعجال." } },
        { from: { en: "+971 52 ••• 4410", ar: "‎+971 52 ••• 4410" }, text: { en: "BANK ALERT: your card is BLOCKED. Reply with the 6-digit OTP we just sent to unblock within 10 minutes.", ar: "تنبيه من البنك: بطاقتك موقوفة. أرسل رمز التحقق المكوّن من 6 أرقام خلال 10 دقائق لإعادة تفعيلها." }, scam: true,
          flags: { en: ["Asks for your OTP", "Fake deadline", "Unknown number"], ar: ["يطلب رمز التحقق", "مهلة مصطنعة", "رقم مجهول"] },
          why: { en: "Scam: your bank will never ask for an OTP. The code is the key to your account.", ar: "احتيال: البنك لا يطلب رمز التحقق أبدًا. هذا الرمز هو مفتاح حسابك." } },
        { from: { en: "Lucky Draw UAE", ar: "سحب الحظ الإمارات" }, text: { en: "Congratulations! You WON AED 10,000! Pay a AED 99 processing fee to claim: luckydraw-uae.win/claim", ar: "مبروك! ربحت 10,000 درهم! ادفع 99 درهمًا رسوم معالجة لاستلام الجائزة: luckydraw-uae.win/claim" }, scam: true,
          flags: { en: ["A prize you never entered", "Pay to receive", "Strange link"], ar: ["جائزة لم تشارك فيها", "ادفع لتستلم", "رابط غريب"] },
          why: { en: "Scam: real prizes never cost a fee, and you can't win a draw you never entered.", ar: "احتيال: الجوائز الحقيقية لا تتطلّب رسومًا، ولا يمكن أن تربح سحبًا لم تشارك فيه." } }
      ]
    },
    {
      title: { en: "Month 2 · Aisha's Birthday", ar: "الشهر الثاني · عيد ميلاد عائشة" },
      intro: {
        en: "It's Aisha's birthday dinner. Flat rule: the birthday person never pays. You paid the restaurant bill; Maria paid the taxi.",
        ar: "عشاء عيد ميلاد عائشة. قاعدة الشقة: صاحب عيد الميلاد لا يدفع أبدًا. أنت دفعت فاتورة المطعم، وماريا دفعت التاكسي."
      },
      bill: {
        place: { en: "Bait Al Mandi Restaurant", ar: "مطعم بيت المندي" },
        payer: "you",
        vatPct: 5,
        treat: "aisha",
        items: [
          { id: "b", name: { en: "Lamb mandi family pot", ar: "قدر مندي لحم عائلي" }, price: 6000, qty: 1, truth: ALL },
          { id: "m", name: { en: "Mezze platter", ar: "طبق مقبّلات" }, price: 3600, qty: 1, truth: ["you", "aisha", "maria"] },
          { id: "h", name: { en: "Grilled hammour", ar: "هامور مشوي" }, price: 5500, qty: 1, truth: ["aisha"] },
          { id: "p", name: { en: "Paneer tikka", ar: "بانير تكا" }, price: 3200, qty: 1, truth: ["rohan"] },
          { id: "u", name: { en: "Kunafa (birthday)", ar: "كنافة (عيد الميلاد)" }, price: 2800, qty: 1, truth: ALL },
          { id: "l", name: { en: "Mint lemonade", ar: "ليمون بالنعناع" }, price: 1000, qty: 3, truth: ["you", "rohan", "maria"] }
        ],
        clues: [
          { who: "rohan", en: "I skipped the mezze (sesame allergy). Paneer tikka, mandi, kunafa, lemonade.", ar: "لم آكل المقبّلات (حساسية سمسم). بانير تكا ومندي وكنافة وليمون." },
          { who: "aisha", en: "Hammour for me, plus mandi, mezze and kunafa. Water only, thanks!", ar: "هامور لي، ومندي ومقبّلات وكنافة. ماء فقط، شكرًا!" },
          { who: "maria", en: "Mandi, mezze, kunafa and a lemonade.", ar: "مندي ومقبّلات وكنافة وليمون." },
          { who: "you", en: "Same as Maria. And remember the birthday rule!", ar: "مثل ماريا تمامًا. ولا تنسَ قاعدة عيد الميلاد!" }
        ],
        nudge: { who: "maria", en: "Can we not split the hammour four ways? I didn't touch it.", ar: "لا تقسموا الهامور على أربعة، لم ألمسه." }
      },
      extras: [ { by: "maria", amount: 3600, label: { en: "Taxi to the restaurant", ar: "تاكسي إلى المطعم" } } ],
      save: {
        q: { en: "Rohan's phone screen cracked. Repair: AED 350. He asks to borrow it from the Hatta trip jar.", ar: "انكسرت شاشة هاتف روهان. الإصلاح: 350 درهمًا. يطلب أن يقترضها من حصّالة رحلة حتّا." },
        options: [
          { id: "plan", en: "Lend from the jar with a written plan: AED 175 back each month", ar: "أقرضه من الحصّالة بخطة مكتوبة: يعيد 175 درهمًا كل شهر",
            fx: { jar: -35000, repay: 17500, harmony: 4 },
            why: { en: "Clear terms keep friendships and money safe. The jar dips now and refills on schedule.", ar: "الشروط الواضحة تحفظ الصداقة والمال. تنقص الحصّالة الآن ثم تمتلئ حسب الخطة." } },
          { id: "loose", en: "Lend from the jar, no plan. He's a friend!", ar: "أقرضه من الحصّالة دون خطة، إنه صديق!",
            fx: { jar: -35000, loose: true, harmony: 6 },
            why: { en: "Feels kind today. Without a plan, money lent to friends often comes back late, or never.", ar: "يبدو لطيفًا اليوم. لكن دون خطة، كثيرًا ما يعود المال المُقرَض للأصدقاء متأخرًا أو لا يعود." } },
          { id: "buffer", en: "Start an emergency buffer: AED 100 each. Rohan borrows from it and repays it", ar: "أنشئوا صندوق طوارئ: 100 درهم من كل واحد. يقترض روهان منه ثم يعيده",
            fx: { buffer: 40000, bufferLoan: 35000, harmony: 8 },
            why: { en: "Emergencies come from an emergency fund, not your goal savings. The trip stays on track.", ar: "الطوارئ تُموَّل من صندوق الطوارئ لا من مدّخرات الأهداف. تبقى الرحلة في موعدها." } }
        ]
      },
      scams: [
        { from: { en: "+971 55 ••• 0917", ar: "‎+971 55 ••• 0917" }, text: { en: "Hi it's Rohan, new number!! Phone broke. Send AED 500 to this IBAN now please, can't talk, will explain later.", ar: "مرحبًا أنا روهان، هذا رقمي الجديد!! هاتفي تعطّل. أرسل 500 درهم إلى هذا الآيبان الآن من فضلك، لا أستطيع الكلام، سأشرح لاحقًا." }, scam: true,
          flags: { en: ["'New number' + money", "Rush", "Avoids a call"], ar: ["رقم جديد + طلب مال", "استعجال", "يتهرّب من المكالمة"] },
          why: { en: "Scam: call the friend on the number you already have before sending anything.", ar: "احتيال: اتصل بصديقك على رقمه المعروف قبل أن ترسل أي شيء." } },
        { from: { en: "Chai Pot app", ar: "تطبيق صندوق الشاي" }, text: { en: "Maria requested AED 36.00 for 'Taxi to the restaurant'.", ar: "طلبت ماريا 36.00 درهمًا مقابل «تاكسي إلى المطعم»." }, scam: false,
          why: { en: "Legit: it matches a real ride you took together, inside the app you use.", ar: "رسالة سليمة: تطابق مشوارًا حقيقيًا قمتم به معًا، وداخل التطبيق الذي تستخدمونه." } },
        { from: { en: "Buyer for your old bike", ar: "مشترٍ لدرّاجتك القديمة" }, text: { en: "Oops, I sent AED 1,500 instead of 500! Screenshot attached. Please send back AED 1,000 today.", ar: "عذرًا، أرسلت 1,500 درهم بدلًا من 500! أرفقت صورة الشاشة. أعد لي 1,000 درهم اليوم من فضلك." }, scam: true,
          flags: { en: ["Overpayment trick", "Screenshot, not your balance", "Rush"], ar: ["خدعة الدفع الزائد", "صورة شاشة لا رصيدك", "استعجال"] },
          why: { en: "Scam: check your real bank balance. Screenshots are easy to fake.", ar: "احتيال: تحقّق من رصيدك الفعلي في البنك. صور الشاشة سهلة التزوير." } }
      ]
    },
    {
      title: { en: "Month 3 · Bills Day", ar: "الشهر الثالث · يوم الفواتير" },
      intro: {
        en: "Month end. Rohan did the big grocery run, Aisha paid the DEWA electricity and water bill, Maria paid the home internet. Time to untangle it all.",
        ar: "نهاية الشهر. روهان اشترى مشتريات البقالة الكبيرة، وعائشة دفعت فاتورة الكهرباء والماء، وماريا دفعت إنترنت المنزل. حان وقت فكّ التشابك."
      },
      bill: {
        place: { en: "Neighbourhood supermarket", ar: "سوبرماركت الحي" },
        payer: "rohan",
        vatPct: 5,
        items: [
          { id: "r", name: { en: "Basmati rice 5 kg", ar: "أرز بسمتي 5 كغ" }, price: 2800, qty: 1, truth: ALL },
          { id: "mi", name: { en: "Milk, eggs, bread", ar: "حليب وبيض وخبز" }, price: 2200, qty: 1, truth: ALL },
          { id: "v", name: { en: "Vegetables & fruit", ar: "خضار وفواكه" }, price: 3400, qty: 1, truth: ALL },
          { id: "pp", name: { en: "Protein powder", ar: "مسحوق بروتين" }, price: 9500, qty: 1, truth: ["rohan"] },
          { id: "hc", name: { en: "Hair care set", ar: "مجموعة عناية بالشعر" }, price: 4200, qty: 1, truth: ["maria"] },
          { id: "d", name: { en: "Dates gift box", ar: "علبة تمر هدية" }, price: 6000, qty: 1, truth: ["you"] },
          { id: "c", name: { en: "Cleaning supplies", ar: "مواد تنظيف" }, price: 2400, qty: 1, truth: ALL },
          { id: "sn", name: { en: "Movie-night snacks", ar: "وجبات خفيفة لليلة الأفلام" }, price: 1800, qty: 1, truth: ["you", "aisha"] }
        ],
        clues: [
          { who: "rohan", en: "Rice, milk, veg and cleaning stuff are for the whole flat. The protein is mine.", ar: "الأرز والحليب والخضار ومواد التنظيف للشقة كلها. البروتين لي." },
          { who: "maria", en: "The hair care set is mine, I'll pay for it.", ar: "مجموعة العناية بالشعر لي، سأدفع ثمنها." },
          { who: "you", en: "The dates box is my gift for my family back home.", ar: "علبة التمر هديتي لعائلتي في بلدي." },
          { who: "aisha", en: "Snacks were for our movie night, just you and me.", ar: "الوجبات الخفيفة كانت لليلة الأفلام، أنا وأنت فقط." }
        ],
        nudge: { who: "rohan", en: "Personal items stay personal, shared items get shared.", ar: "الأغراض الشخصية لأصحابها، والمشتركة تُقسَم." }
      },
      extras: [
        { by: "aisha", amount: 66620, label: { en: "DEWA electricity & water", ar: "فاتورة الكهرباء والماء" } },
        { by: "maria", amount: 38900, label: { en: "Home internet", ar: "إنترنت المنزل" } }
      ],
      save: {
        q: { en: "A colleague invites the flat to a trading group: 'We double your money in 30 days, guaranteed!' The trip is close. What do you do with the jar?", ar: "زميل يدعو الشقة إلى مجموعة تداول: «نضاعف أموالكم خلال 30 يومًا، مضمون!» الرحلة قريبة. ماذا تفعل بالحصّالة؟" },
        options: [
          { id: "all", en: "Put the whole jar in. Double the trip!", ar: "ضع الحصّالة كلها. رحلة مضاعفة!",
            fx: { jarLoseAll: true, harmony: -20 },
            why: { en: "The 'group' vanished with the money. Guaranteed, fast, huge returns are the classic sign of a scam.", ar: "اختفت «المجموعة» ومعها المال. العوائد المضمونة والسريعة والضخمة علامة الاحتيال المعروفة." } },
          { id: "test", en: "Try AED 100 first, just to test it", ar: "جرّب 100 درهم أولًا للاختبار",
            fx: { jar: -10000, harmony: -4 },
            why: { en: "Scammers often let a small 'test' win to hook you. The AED 100 is gone.", ar: "كثيرًا ما يترك المحتالون «اختبارًا» صغيرًا يربح ليوقعوا بك. ضاعت المئة درهم." } },
          { id: "keep", en: "Say no. Keep saving steadily until the trip", ar: "ارفض. واصلوا الادّخار بانتظام حتى الرحلة",
            fx: { harmony: 6 },
            why: { en: "Right call. Real growth is slow and never guaranteed; your goal is weeks away, so keep it safe.", ar: "قرار صحيح. النمو الحقيقي بطيء وغير مضمون أبدًا، وهدفكم بعد أسابيع، فحافظوا عليه آمنًا." } }
        ]
      },
      scams: [
        { from: { en: "DEWA-Billing", ar: "DEWA-Billing" }, text: { en: "FINAL NOTICE: your power will be cut TODAY. Pay now at dewa-bill-pay.top", ar: "إنذار أخير: ستُقطع الكهرباء اليوم. ادفع الآن عبر dewa-bill-pay.top" }, scam: true,
          flags: { en: ["Lookalike website", "Threat + today", "Bill already paid"], ar: ["موقع مقلّد", "تهديد + اليوم", "الفاتورة مدفوعة أصلًا"] },
          why: { en: "Scam: Aisha already paid. Pay bills only in the official app or website you type yourself.", ar: "احتيال: عائشة دفعت الفاتورة أصلًا. ادفع الفواتير فقط عبر التطبيق الرسمي أو الموقع الذي تكتبه بنفسك." } },
        { from: { en: "Your bank", ar: "بنكك" }, text: { en: "Salary credited to your account. Available balance updated. No action needed.", ar: "تم إيداع الراتب في حسابك. تم تحديث الرصيد المتاح. لا حاجة لأي إجراء." }, scam: false,
          why: { en: "Legit: no link, no request, nothing to pay. You can confirm in your banking app.", ar: "رسالة سليمة: لا رابط ولا طلب ولا دفع. يمكنك التأكّد من تطبيق البنك." } },
        { from: { en: "Crypto Kings VIP", ar: "كريبتو كينغز VIP" }, text: { en: "Last 3 seats! 30% profit EVERY MONTH, zero risk. 2,000 members already rich. Join now.", ar: "آخر 3 مقاعد! ربح 30% كل شهر، دون أي مخاطرة. 2,000 عضو أصبحوا أغنياء. انضم الآن." }, scam: true,
          flags: { en: ["'Zero risk'", "Huge monthly profit", "Fake scarcity"], ar: ["«دون مخاطرة»", "ربح شهري ضخم", "ندرة مصطنعة"] },
          why: { en: "Scam: every real investment carries risk, and nobody can promise 30% a month.", ar: "احتيال: كل استثمار حقيقي فيه مخاطرة، ولا أحد يستطيع أن يعد بـ30% شهريًا." } }
      ]
    }
  ];

  var api = { ALL: ALL, MEMBERS: MEMBERS, MONTHS: MONTHS, GOAL: 180000 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Content = api;
})(this);
