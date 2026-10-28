import assert from 'node:assert/strict';
import { SAMPLE, check, verdict, autoFix, segments } from './core.mjs';

let checks = 0;
const ok = fn => { fn(); checks++; };
const ids = (t, o = {}) => check(t, { yil: 2026, ...o }).map(x => x.id);

// 1. Örnek mesajda her şey bulunuyor
const r = check(SAMPLE.metin, { kime: SAMPLE.kime, yil: 2026 });
const has = id => r.some(x => x.id === id);
for (const id of ['kopya', 'hitap', 'ek', 'bicim', 'tarih', 'yer', 'tekrar', 'parantez', 'bosluk']) ok(() => assert.ok(has(id), id));
ok(() => assert.equal(verdict(r).durum, 'dur'));
ok(() => assert.equal(verdict(r).hata, 4));

// 2. Kopya giriş cümleleri (İngilizce ve Türkçe)
ok(() => assert.ok(ids("Here's a more polished and professional version with a warm, empathetic tone:\nMerhaba").includes('kopya')));
ok(() => assert.ok(ids('İşte mesajın daha kibar hali:\nMerhaba').includes('kopya')));
ok(() => assert.ok(ids('Merhaba,\nİstersen daha kısa bir versiyonunu da yazabilirim.').includes('kopya')));
ok(() => assert.ok(!ids('İşte bu yüzden geç kaldım, kusura bakmayın.').includes('kopya')));

// 3. Yer tutucular
ok(() => assert.ok(ids('Sayın [Ad Soyad],').includes('yer')));
ok(() => assert.ok(ids('Merhaba {isim}').includes('yer')));
ok(() => assert.ok(ids('Toplantı XXX günü').includes('yer')));

// 4. Ek
ok(() => assert.ok(ids('Dosyayı ekte gönderiyorum.').includes('ek')));
ok(() => assert.ok(!ids('Dosyayı ekte gönderiyorum.', { ekVar: true }).includes('ek')));

// 5. Hitap ve unvanlar
ok(() => assert.ok(ids('Merhaba Zeynep Hoca,', { kime: 'Ayşe Hoca' }).includes('hitap')));
ok(() => assert.ok(!ids('Merhaba Ayşe Hanım,', { kime: 'Ayşe Yılmaz' }).includes('hitap')));
ok(() => assert.ok(!ids('Dear Mr. Smith,', { kime: 'John Smith' }).includes('hitap')));
ok(() => assert.ok(!ids("Merhaba Ayşe'ciğim,", { kime: 'Ayşe' }).includes('hitap')));
ok(() => assert.ok(!ids('Merhaba Zeynep,').includes('hitap')));       // alıcı yazılmadıysa sormaz

// 6. Tarih ve gün
ok(() => assert.ok(ids('26 Ekim Pazartesi görüşelim').length === 0));
ok(() => assert.match(check('27 Ekim 2026 Pazartesi', { yil: 2026 })[0].mesaj, /salı/));
ok(() => assert.match(check('30 Şubat Cuma', { yil: 2026 })[0].mesaj, /diye bir gün yok/));
ok(() => assert.ok(ids('1 Ocak 2027, Cuma').length === 0));

// 7. Biçim, tekrar, parantez, tırnak, boşluk
ok(() => assert.ok(ids('**Önemli** not').includes('bicim')));
ok(() => assert.ok(ids('## Başlık\nmetin').includes('bicim')));
ok(() => assert.ok(ids('Bu cümle iki kere var. Bu cümle iki kere var.').includes('tekrar')));
ok(() => assert.ok(ids('(açık parantez').includes('parantez')));
ok(() => assert.ok(ids('"tek tırnak').includes('tirnak')));
ok(() => assert.ok(ids('iki  boşluk').includes('bosluk')));

// 8. Temiz mesaj
const temiz = check('Merhaba Ayşe Hoca,\n\nÖdevimi teslim ettim. İyi günler.\n\nEfe', { kime: 'Ayşe Hoca', yil: 2026 });
ok(() => assert.equal(temiz.length, 0));
ok(() => assert.equal(verdict(temiz).durum, 'hazir'));
ok(() => assert.equal(check('   ').length, 0));

// 9. Otomatik düzeltme
const f = autoFix(SAMPLE.metin);
ok(() => assert.ok(!f.startsWith("Here's")));
ok(() => assert.ok(!f.includes('**')));
ok(() => assert.ok(!/ {2}/.test(f)));
ok(() => assert.ok(f.startsWith('Merhaba Zeynep Hoca,')));
ok(() => assert.ok(f.includes('[konu başlığı]')));                 // anlamı bilmediği şeye dokunmaz

// 10. İşaretleme parçaları metni bozmuyor
const seg = segments(SAMPLE.metin, r);
ok(() => assert.equal(seg.map(s => s.metin).join(''), SAMPLE.metin));
ok(() => assert.ok(seg.some(s => s.seviye === 'hata')));
ok(() => assert.ok(seg.some(s => s.id === 'tarih')));             // biçim işaretinin altında kalmıyor

console.log(`${checks} kontrol geçti.`);
