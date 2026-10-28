// Gönder Bekçisi: ekrana dokunmayan kontroller (test.mjs bunları sınar)
// Her kontrol { id, seviye: 'hata' | 'uyari' | 'bilgi', mesaj, bas, son } döner. bas/son metindeki yerdir.

const AYLAR = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
const GUNLER = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'];
const lower = s => s.toLocaleLowerCase('tr-TR');

// Başka bir yazı aracından kopyalanınca unutulan giriş / kapanış cümleleri
const KOPYA = [
  /^\s*(here['’]s|here is) (a|an|the|your) [^\n]{0,60}(version|rewrite|draft|reply|response)[^\n]*:\s*$/im,
  /^\s*(sure|certainly|of course|absolutely)[!,.][^\n]*$/im,
  /^\s*(let me know if you('d)? like|i hope this helps)[^\n]*$/im,
  /^\s*([iİ]şte|aşağıda)[^\n]{0,60}(hali|versiyonu|versiyon|sürümü|taslağı|metin|mesaj)[^\n]*:\s*$/imu,
  /^\s*(tabii|elbette|tabii ki)[!,.][^\n]{0,80}(yazdım|düzenledim|hazırladım)[^\n]*$/imu,
  /^\s*([iİ]stersen|dilersen)[^\n]{0,80}(yapabilirim|yazabilirim|düzenleyebilirim)[^\n]*$/imu
];

const YER_TUTUCU = /\[[^\]\n]{1,30}\]|\{\{?[^}\n]{1,30}\}?\}|<(isim|ad|name|tarih|date)>|\bX{3,}\b|_{3,}|\bTODO\b|\bBURAYA\b[^\n]{0,20}/giu;
const EK_SOZU = /\b(ekte|ekteki|ekten|ek olarak gönder|attached|attachment|enclosed)\b/iu;
const UNVAN = new Set(['hoca', 'hocam', 'bey', 'hanım', 'abi', 'abla', 'öğretmenim', 'dr', 'dr.', 'prof', 'prof.', 'mr', 'mr.', 'ms', 'ms.', 'mrs', 'mrs.', 'sir', 'madam']);
const HITAP = /^\s*(merhaba|selam|sayın|sevgili|değerli|hi|hello|dear)\s+([\p{L}][\p{L}'’.-]*(?:\s[\p{Lu}][\p{L}'’.-]*)?)/imu;

function pushAll(list, re, text, make) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    list.push(make(m));
    if (!re.global) break;
  }
}

function weekdayOf(y, m, d) {
  const t = new Date(Date.UTC(y, m, d));
  if (t.getUTCMonth() !== m || t.getUTCDate() !== d) return null;
  return t.getUTCDay();
}

export function check(text, { kime = '', ekVar = false, yil = new Date().getFullYear() } = {}) {
  const t = String(text || '');
  const out = [];
  if (!t.trim()) return out;

  // 1. Kopya kalıntısı
  for (const re of KOPYA) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    pushAll(out, g, t, m => ({ id: 'kopya', seviye: 'hata', mesaj: 'Bu cümle başka bir yerden kopyalanmış gibi duruyor. Alıcı bunu görmemeli.', bas: m.index, son: m.index + m[0].length }));
  }

  // 2. Doldurulmamış yer tutucu
  pushAll(out, new RegExp(YER_TUTUCU.source, 'giu'), t, m => ({ id: 'yer', seviye: 'hata', mesaj: `"${m[0].trim()}" doldurulmamış.`, bas: m.index, son: m.index + m[0].length }));

  // 3. Ek sözü
  const ek = EK_SOZU.exec(t);
  if (ek && !ekVar) out.push({ id: 'ek', seviye: 'uyari', mesaj: `"${ek[0]}" yazıyorum. Eki gerçekten ekledim mi?`, bas: ek.index, son: ek.index + ek[0].length });

  // 4. Hitaptaki isim alıcıyla uyuşuyor mu?
  const h = HITAP.exec(t);
  if (h && kime.trim()) {
    const isimler = s => lower(s).replace(/['’][^\s]*/g, '').split(/\s+/).filter(w => w && !UNVAN.has(w));
    const ad = isimler(h[2]), alici = isimler(kime);
    if (ad.length && alici.length && !alici.some(a => ad.includes(a))) {
      const bas = h.index + h[0].indexOf(h[2]);
      out.push({ id: 'hitap', seviye: 'hata', mesaj: `Mesaj "${h[2]}" diye başlıyor ama alıcı "${kime.trim()}".`, bas, son: bas + h[2].length });
    }
  }

  // 5. Tarih ile gün adı uyuşuyor mu? (ör. "27 Ekim Pazartesi")
  const tarihRe = new RegExp(`\\b(\\d{1,2})\\s+(${AYLAR.join('|')})(?:\\s+(\\d{4}))?[,\\s]+(${GUNLER.join('|')})\\b`, 'giu');
  pushAll(out, tarihRe, lower(t), m => {
    const gun = +m[1], ay = AYLAR.indexOf(m[2]), y = m[3] ? +m[3] : yil;
    const dogru = weekdayOf(y, ay, gun);
    if (dogru === null) return { id: 'tarih', seviye: 'hata', mesaj: `${gun} ${m[2]} ${y} diye bir gün yok.`, bas: m.index, son: m.index + m[0].length };
    if (GUNLER[dogru] !== m[4]) return { id: 'tarih', seviye: 'hata', mesaj: `${gun} ${m[2]} ${y} bir ${GUNLER[dogru]}, ${m[4]} değil.`, bas: m.index, son: m.index + m[0].length };
    return null;
  });

  // 6. Biçim kalıntısı (e-postada yıldızlar ve # işaretleri görünür)
  pushAll(out, /\*\*[^*\n]+\*\*|^#{1,6}\s|```/gm, t, m => ({ id: 'bicim', seviye: 'uyari', mesaj: 'Biçim işareti kalmış; alıcı yıldızları ya da # işaretini olduğu gibi görür.', bas: m.index, son: m.index + m[0].length }));

  // 7. Aynı cümle iki kere
  const seen = new Map();
  const cumleRe = /[^.!?\n]{12,}[.!?]/g;
  pushAll(out, cumleRe, t, m => {
    const k = lower(m[0].trim()).replace(/\s+/g, ' ');
    if (seen.has(k)) return { id: 'tekrar', seviye: 'uyari', mesaj: 'Bu cümleyi iki kere yazmışım.', bas: m.index, son: m.index + m[0].length };
    seen.set(k, m.index);
    return null;
  });

  // 8. Kapanmamış parantez / tırnak
  const acik = (t.match(/\(/g) || []).length - (t.match(/\)/g) || []).length;
  if (acik !== 0) out.push({ id: 'parantez', seviye: 'uyari', mesaj: acik > 0 ? 'Bir parantezi kapatmamışım.' : 'Fazladan kapanan parantez var.', bas: -1, son: -1 });
  if ((t.match(/"/g) || []).length % 2) out.push({ id: 'tirnak', seviye: 'uyari', mesaj: 'Bir tırnak işareti eşsiz kalmış.', bas: -1, son: -1 });

  // 9. Çift boşluk ve satır sonu boşlukları
  const bosluk = (t.match(/[^\S\n]{2,}|[^\S\n]+$/gm) || []).length;
  if (bosluk) out.push({ id: 'bosluk', seviye: 'bilgi', mesaj: `${bosluk} yerde fazladan boşluk var.`, bas: -1, son: -1 });

  return out.filter(Boolean).sort((a, b) => (a.bas - b.bas) || a.id.localeCompare(b.id));
}

export function verdict(list) {
  const hata = list.filter(x => x.seviye === 'hata').length;
  const uyari = list.filter(x => x.seviye === 'uyari').length;
  if (hata) return { durum: 'dur', metin: `Göndermeden önce ${hata} hatayı düzeltmeliyim.`, hata, uyari };
  if (uyari) return { durum: 'bak', metin: `${uyari} şeye bir daha bakmalıyım.`, hata, uyari };
  return { durum: 'hazir', metin: 'Gönderilmeye hazır görünüyor.', hata, uyari };
}

// Kolay olanları kendisi düzeltir: kopya satırları, çift boşluk, satır sonu boşluğu, biçim yıldızları
export function autoFix(text) {
  let t = String(text || '');
  for (const re of KOPYA) t = t.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), '');
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '');
  t = t.replace(/[^\S\n]{2,}/g, ' ').replace(/[^\S\n]+$/gm, '');
  t = t.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n');
  return t;
}

// Ekranda işaretlemek için metni parçalara böler
export function segments(text, list) {
  const t = String(text || '');
  // Üst üste binen işaretlerde önce hataları seçiyorum, sonra uyarıları, en son notları
  const SIRA = { hata: 0, uyari: 1, bilgi: 2 };
  const secilen = [];
  for (const m of list.filter(x => x.bas >= 0).sort((a, b) => SIRA[a.seviye] - SIRA[b.seviye] || a.bas - b.bas)) {
    if (!secilen.some(s => m.bas < s.son && s.bas < m.son)) secilen.push(m);
  }
  const marks = secilen.sort((a, b) => a.bas - b.bas);
  const out = [];
  let i = 0;
  for (const m of marks) {
    if (m.bas > i) out.push({ metin: t.slice(i, m.bas) });
    out.push({ metin: t.slice(m.bas, m.son), seviye: m.seviye, id: m.id });
    i = m.son;
  }
  if (i < t.length) out.push({ metin: t.slice(i) });
  return out;
}

export const SAMPLE = {
  kime: 'Ayşe Hoca',
  ekVar: false,
  metin: `Here's a more polished and professional version with a warm, empathetic tone:

Merhaba Zeynep Hoca,

Proje ödevimi ekte gönderiyorum.  Teslim tarihini **27 Ekim 2026 Pazartesi** olarak not almıştım (yanlış hatırlıyorsam lütfen düzeltin.
Ödevde [konu başlığı] bölümünü biraz kısa tuttum.
Proje ödevimi ekte gönderiyorum.

Teşekkürler,
Efe`
};
