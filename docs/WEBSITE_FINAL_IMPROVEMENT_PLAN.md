# Celebration — Website Final Improvement Plan

**वेबसाइट:** https://shopcelebration.in  
**स्टैक:** Next.js  
**बिज़नेस:** आर्टिफिशियल ज्वेलरी + कस्टम गिफ्ट हैम्पर्स  
**लक्ष्य:** AI-जेनरेटेड टेम्प्लेट जैसी फील हटाकर वेबसाइट को प्रोफेशनल, ह्यूमन और प्रीमियम बनाना।

**स्टेटस:** `[ ] Pending` = पूरा/वेरिफ़ाई नहीं हुआ; `[x] Done` = काम और उसकी जाँच पूरी।

**Scope rule:** जब मालिक कहे “जो प्लान में लिखा है उसी को फॉलो कर”, तो सिर्फ इसी फ़ाइल के पॉइंट्स पर काम करना है। बिना निर्देश नया काम/फ़ीचर नहीं जोड़ना है। एक-एक सेक्शन पूरा करें और फिर उसका स्टेटस अपडेट करें।

---

## 1. प्रोडक्ट इमेजेस को अपने सर्वर पर लाओ (Highest Priority)

- [x] Done — मौजूदा Meesho इमेज डोमेन (upload.meeshosupplyassets.com) पर निर्भरता जाँचो।
- [x] Done — सभी Meesho वाली प्रोडक्ट इमेज URLs स्कैन और सूचीबद्ध करो।
- [x] Done — उन इमेजेस को डाउनलोड करो।
- [x] Done — 67 Meesho images Cloudflare R2 में सेव और सभी 201 variants verify हुए; 22 original Celebration images पहले से अपनी domain पर हैं।
- [x] Done — PostgreSQL catalog और bootstrap JSON के 67 products को Celebration R2 URLs पर बदला; original **उसी SKU की** Meesho image backup के रूप में रखी।
- [ ] Pending — Product card/gallery में branded fallback लागू; production पर image-failure simulation और mobile visual QA अब भी बाकी।
- [ ] Pending — 67 migrated images के WebP thumbnail/main/zoom सभी verify; पहले से first-party 22 PNG images की WebP optimization अभी बाकी।

**Section 1 image-priority rule (owner confirmation):** Celebration की same-product image हमेशा पहले; वही image fail होने पर सिर्फ उसी original photo की Meesho URL fallback; अन्य SKU की photo कभी replace/borrow नहीं करनी। अंतिम fallback Celebration का branded placeholder।

**Four verification gates (2026-10-10):** 89 unique SKUs, 67 original URL-SHA matched to correct SKUs, hero/gallery identity checked, 201 R2 WebP variants verified; 22 first-party URLs reachable। मगर दो SKU (`celebration-necklace-030` और `-031`) की image bytes identical मिली हैं। इनके actual physical reference photos से human visual review **Pending** है; automatically image/title change नहीं करना। विवरण: `docs/CATALOG_IMAGE_OWNERSHIP_AUDIT.md`।

---

## 2. 25% OFF बैज की एकरूपता पूरी तरह हटाओ

- [x] Done — customer-facing card और product gallery में एक जैसा “25% OFF” badge हटाया; price/MRP के सही savings अलग दिखते हैं।
- [ ] Pending — dynamic badge logic और admin choices तैयार: Bestseller / New केवल वास्तविक वेरिफ़ाइड स्थिति में, Limited केवल live stock 1–3 पर, अलग % OFF सिर्फ वास्तविक MRP और selling price से, तथा कई products बिना badge। Live पर Bestseller/New किसी प्रोडक्ट के लिए बिना साक्ष्य घोषित नहीं किया गया है।
- [x] Done — badge kinds के अनुसार अलग premium color, spacing और आकार; mobile पर भी responsive।

**Section 2 सत्यापन:** इस सेक्शन में मौजूदा 89 प्रोडक्ट्स के original prices/MRP नहीं बदले। पुरानी 65 `25% OFF` labels को customer badges के रूप में render नहीं किया जाता; दूसरे वास्तविक price discounts अलग-अलग दिखेंगे। `Bestseller` और `New` को बिना सत्यापित बिक्री/नए आगमन के अपने-आप assign नहीं किया गया। Admin में सत्यापित products को ये badges दिया जा सकता है; `Limited` के लिए live inventory भी आवश्यक है।

---

## 3. रिव्यू सिस्टम (फेक नहीं डालना)

- [x] Done — real customer reviews: verified, paid, delivered individual order वाले ग्राहक ही account name, order city, rating 1–5, text और optional EXIF-removed photo जमा कर सकते हैं; admin moderation के बाद ही public दिखेगा।
- [x] Done — live database migration में कोई fake/sample review seed नहीं; सिर्फ verified delivered purchases के genuine submissions और admin-approved reviews public।
- [x] Done — बिना approved customer reviews के product page पर “Be the first to review this product” दिखता है, नकली नाम/rating नहीं।

**Section 3 verification:** Database migration 036 केवल empty review table बनाती है। Submitted reviews default `pending` हैं। Review eligibility के लिए actual paid/verified **delivered** order, logged-in phone-verified customer और उसी product SKU का match अनिवार्य है। फोटो private Cloudflare R2 में रहती है; approval के बाद ही public हो सकती है। Review names और cities account/order से आते हैं—कभी fabricated नहीं। First genuine customer submission पर end-to-end manual smoke test अब भी उपयोगी रहेगा; इसलिए किसी fake live review से test नहीं किया गया।

---

## 4. About Us / Our Story पेज — दिए गए कंटेंट के साथ

- [x] Done — `/about` पर नया Our Story पेज बनाया; मौजूदा header/footer से जुड़ा, sitemap में शामिल।
- [x] Done — पेज का title **Our Story** और canonical `/about` है।
- [x] Done — Celebration की Sikar, Rajasthan वाली कहानी का अर्थ और तथ्य सुरक्षित; मालिक के 2026-10-10 निर्देश पर `/about` की customer-facing कॉपी अंग्रेज़ी में बदली, जबकि नीचे मूल हिंदी को reference के लिए रखा।

### हीरो सेक्शन (स्वीकृत कॉपी)

**Celebration**  
**Mharo Surprise, Thari Smile**

### मुख्य कहानी (स्वीकृत कॉपी)

हमने Celebration की शुरुआत एक साधारण विचार से की थी —  
कि उपहार सिर्फ एक चीज़ नहीं होता। वो एक भावना होती है।  
एक छोटी सी सरप्राइज, जो किसी के चेहरे पर मुस्कान ला दे।

Celebration Sikar, Rajasthan से शुरू हुआ।  
हमने देखा कि लोग अच्छे उपहार देना चाहते हैं, लेकिन या तो बहुत महँगे विकल्प मिलते हैं, या फिर सस्ते लेकिन बेजान से लगने वाले।  
हमने बीच का रास्ता चुना — सुंदर, किफायती, और दिल से बनाया हुआ।

हम एंटी-टार्निश ज्वेलरी देते हैं क्योंकि हम चाहते हैं कि वो उपहार लंबे समय तक वैसा ही सुंदर रहे।  
हम कस्टम गिफ्ट हैम्पर्स बनाते हैं क्योंकि हर रिश्ता अलग होता है, और हर बजट अलग होता है।

हमारा वादा सिर्फ प्रोडक्ट बेचने का नहीं है।  
हमारा वादा है — थोड़ी सी सोच, बहुत सारा प्यार।

- [x] Done — तीन छोटे premium editorial value cards: **Thoughtful over expensive**, **Made to feel personal**, **Clear & honest process**।
- [x] Done — founder नाम invent नहीं किया; स्वीकृत **— Team Celebration** नोट हूबहू शामिल है।

> “हर ऑर्डर के पीछे एक असली व्यक्ति होता है जिसे हम खुश करना चाहते हैं। यही हमारी असली प्रेरणा है।”  
> — Team Celebration

- [x] Done — **Explore our collection** (`/jewelry`) और **Build a hamper** (`/#budgets`) सही destinations पर जोड़े।

**Section 4 verification:** `scripts/test-our-story.mjs` में English page copy, original Hindi reference, 3 cards, Team Celebration note, CTA routes, SEO metadata, language और responsive styles के regression checks शामिल हैं। Site पर कोई काल्पनिक founder नाम, customer testimonial या तस्वीर नहीं जोड़ी गई।

---

## 5. How to Style / How to Wear सेक्शन (प्रोडक्ट पेज पर)

- [x] Done — product details पर **How to Style** जोड़ा; categories के अनुसार अलग tips और non-jewelry gifts के लिए appropriate fallback।
- [x] Done — customer-facing English guidance सरल और वास्तविक रखी; कोई मनगढ़ंत material या product feature नहीं।
- [x] Done — neckline, ring, wristwear, earrings और matching necklace + earrings sets के लिए अलग style और care tips।

### How to Style — उदाहरण कॉपी

इस नेकलेस को आप कई तरीकों से पहन सकते हैं:

- रोजाना के आउटफिट के साथ हल्के में।
- साड़ी या सूट के साथ थोड़ा और नज़र आने वाले लुक के लिए।
- पार्टी या कैज़ुअल गैदरिंग में लेयर करके।

**छोटी टिप्स:**

- परफ्यूम और सैनिटाइज़र लगाने के बाद ही ज्वेलरी पहनें।
- सोते समय और नहाते समय उतारकर रखें।
- लंबे समय तक चमक बनाए रखने के लिए सूखी जगह पर रखें।

- [x] Done — necklace + earrings sets पर साथ पहनने और अलग-अलग पहनने की guidance English में शामिल है।

**Section 5 verification:** All default catalog items receive category-aware styling advice, care tips and a responsive single-column mobile layout. `scripts/test-product-styling.mjs` is part of the CI audit. Product catalog, media, pricing, reviews, checkout, stock and shipping remain unchanged.

---

## 6. मोबाइल अनुभव को पूरी तरह ठीक करो

- [x] Done (code + automated verification) — मोबाइल navigation, search, cart icon, product-card CSS audit और fixes लागू; असली phone browser का visual/manual QA अलग pending है।
- [x] Done — मोबाइल header, filters, product cards और fixed buy bar की spacing सुधारी।
- [x] Done — search text (iOS zoom avoidance), filter labels, long product names, card prices और buy buttons mobile-readable किए।
- [x] Done — mobile product names/category/price को hard line clipping से निकाला; 360px और नीचे product grid single-column; narrow-screen buy bar में controls अलग row में रखे।
- [x] Done (covered controls) — mobile header icons/nav/search, catalog add/quantity, filter reset/close, gallery arrows, cart quantity/remove के touch targets minimum 44px रखे।

**Section 6 verification:** `styles/mobile-storefront-section6.css` global stylesheet के आखिर में loaded है ताकि पुरानी compact-card media rules को सही precedence मिले। `scripts/test-mobile-storefront.mjs` CSS import, key layout/touch assertions और markup structure की regression checks करता है। CI audit/typecheck के बाद भी physical Android/iOS browser का visual QA (320, 360, 375, 390, 430px; keyboard/search, sticky cart और filter overlay) **Pending** है, इसलिए production visual-perfect claim नहीं है। कोई product identity, images, prices, payment, order या shipping flow नहीं बदला।

---

## 7. AI फील हटाने के लिए डिज़ाइन और टाइपोग्राफी सुधार

### फॉन्ट

- [ ] Pending — हेडिंग्स के लिए कैरेक्टर वाला एलिगेंट सेरिफ़ फॉन्ट / मौजूदा Bodoni जैसी फ़ील का बेहतर उपयोग।
- [ ] Pending — बॉडी टेक्स्ट के लिए साफ और आराम से पढ़ा जाने वाला सैंस-सेरिफ़।
- [ ] Pending — हर जगह एक जैसी line-height/letter-spacing के बजाय प्राकृतिक वैरायटी।

### स्पेसिंग और लेआउट

- [ ] Pending — सेक्शन की दूरी थोड़ा अनइवन और ह्यूमन बनाओ।
- [ ] Pending — बहुत परफ़ेक्ट ग्रिड और एक जैसे कार्ड्स से बचो।
- [ ] Pending — कुछ सेक्शन में अधिक white space, कुछ में थोड़ा टाइट लेआउट।

### कलर और विज़ुअल

- [ ] Pending — बहुत ज्यादा समान opacity और shadows कम करो।
- [ ] Pending — उचित इमेज ग्रेडिएंट/शैडो से हल्का रियल फ़ील दो।
- [ ] Pending — बटन और बैज स्टाइल में उचित वैरायटी रखो।

### कॉपीराइटिंग

- [ ] Pending — “perfect”, “beautiful”, “thoughtful” जैसे शब्दों का दोहराव कम करो।
- [ ] Pending — वाक्य छोटे और स्वाभाविक रखो।
- [ ] Pending — AI-जैसी फ्लोरी भाषा कम करो।

---

## 8. बाकी जरूरी सुधार

- [ ] Pending — लागू होने पर प्रोडक्ट पेज पर साइज गाइड / मेजरमेंट जोड़ो।
- [ ] Pending — FAQ पेज को शिपिंग, गारंटी, रिटर्न, पैकिंग वीडियो और एंटी-टार्निश सवालों के साथ मजबूत करो।
- [ ] Pending — फुटर को अधिक उपयोगी बनाओ।
- [ ] Pending — होमपेज पर हल्का सोशल प्रूफ़ जोड़ो, केवल जब असली डेटा उपलब्ध हो।
- [ ] Pending — पूरे साइट पर इमेज lazy loading, WebP और बेसिक परफ़ॉर्मेंस चेक करो।
- [ ] Pending — “Powered by AI” या जेनरिक प्लेसहोल्डर टेक्स्ट कहीं न बचे।

---

## काम करने का तरीका

- [x] Done — सबसे पहले docs/WEBSITE_FINAL_IMPROVEMENT_PLAN.md बनाकर पूरा प्लान लिखना।
- [ ] Pending — फिर एक-एक सेक्शन करके काम शुरू करना।
- [ ] Pending — हर बड़े बदलाव के बाद संक्षेप में बताना कि क्या किया।
- [ ] Pending — फेक डेटा लाइव पर कभी पब्लिश न करना।
- [ ] Pending — कोड साफ और प्रोडक्शन-रेडी रखना।

**आगे का अनुक्रम:** सेक्शन 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8। आगे का काम केवल इस फ़ाइल के दायरे में होगा।
