// Gönder Bekçisi: ekran ve düğmeler
import { SAMPLE, check, verdict, autoFix, segments } from './core.mjs';

const $ = id => document.getElementById(id);
const STORE = 'gonder-bekcisi-v1';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ETIKET = { hata: 'HATA', uyari: 'BAK', bilgi: 'NOT' };

let list = [];

function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ metin: $('tMsg').value, kime: $('iKime').value, ekVar: $('cEk').checked })); } catch { /* gizli sekme */ }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE));
    if (!d) return false;
    $('tMsg').value = d.metin || ''; $('iKime').value = d.kime || ''; $('cEk').checked = !!d.ekVar;
    return true;
  } catch { return false; }
}

function run() {
  const metin = $('tMsg').value;
  list = check(metin, { kime: $('iKime').value, ekVar: $('cEk').checked });
  const v = verdict(list);
  const box = $('verdict');
  if (!metin.trim()) {
    box.className = 'verdict'; box.innerHTML = 'Mesaj bekliyorum<small>Soldaki kutuya yapıştırıyorum.</small>';
  } else {
    box.className = `verdict ${v.durum}`;
    box.innerHTML = `${v.durum === 'hazir' ? '✓ ' : v.durum === 'dur' ? '✋ ' : '👀 '}${esc(v.metin)}<small>${v.hata} hata · ${v.uyari} uyarı</small>`;
  }
  $('issues').innerHTML = list.length
    ? list.map((x, i) => `<li data-i="${i}"><span class="tag ${x.seviye}">${ETIKET[x.seviye]}</span><span>${esc(x.mesaj)}</span></li>`).join('')
    : `<li class="none">${metin.trim() ? 'Bir şey bulamadım. Yine de bir kere okuyorum.' : '–'}</li>`;
  $('preview').innerHTML = segments(metin, list).map(s => s.seviye ? `<mark class="${s.seviye}">${esc(s.metin)}</mark>` : esc(s.metin)).join('') || '<span class="hint">Boş</span>';
  save();
}

$('tMsg').addEventListener('input', run);
$('iKime').addEventListener('input', run);
$('cEk').addEventListener('change', run);

// Bir soruna tıklayınca metinde o yeri seçer
$('issues').addEventListener('click', e => {
  const li = e.target.closest('li[data-i]'); if (!li) return;
  const x = list[+li.dataset.i];
  if (x.bas < 0) return;
  const ta = $('tMsg');
  ta.focus(); ta.setSelectionRange(x.bas, x.son);
});

$('bFix').onclick = () => {
  const once = $('tMsg').value, sonra = autoFix(once);
  if (once === sonra) { toast('Kendim düzeltebileceğim bir şey kalmadı'); return; }
  $('tMsg').value = sonra; run(); toast('Kolay olanları düzelttim');
};
$('bCopy').onclick = async () => {
  try { await navigator.clipboard.writeText($('tMsg').value); }
  catch { $('tMsg').select(); document.execCommand('copy'); }
  toast(verdict(list).durum === 'dur' ? 'Kopyaladım ama hâlâ hata var!' : 'Kopyaladım');
};
$('bSample').onclick = () => {
  $('tMsg').value = SAMPLE.metin; $('iKime').value = SAMPLE.kime; $('cEk').checked = SAMPLE.ekVar;
  run(); toast('Örnek kondu (uydurma bir mesaj)');
};
$('bClear').onclick = () => { $('tMsg').value = ''; $('iKime').value = ''; $('cEk').checked = false; run(); };

function toast(text) {
  const t = $('toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
}

if (!load()) { $('tMsg').value = SAMPLE.metin; $('iKime').value = SAMPLE.kime; }
run();
