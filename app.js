
window.addEventListener('error', function(e){ var m=document.getElementById('msg'); if(m) m.textContent='Kesalahan skrip: '+(e.message||'tidak diketahui'); });

const { supabaseUrl, supabaseAnonKey } = MOMENTARA_CONFIG;
let sb = null;
try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (e) { sb = null; }
// Navigasi selalu dipasang dulu, terlepas dari status Supabase, agar tombol tidak macet.
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click', ()=>show(b.dataset.view)));
const $ = (id) => document.getElementById(id);
function show(id){ document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden')); $(id).classList.remove('hidden'); }
function msg(t){ $('msg').textContent = t; }
const FILTERS = { 'Natural': 'none', 'Warm Film': 'sepia(0.35) saturate(1.2) brightness(1.05)', 'Vintage': 'sepia(0.6) contrast(0.9) brightness(0.95)', 'Soft Portrait': 'saturate(0.9) brightness(1.08)', 'Black and White': 'grayscale(1) contrast(1.1)', 'Cool Night': 'brightness(0.9) saturate(0.7) contrast(1.1)', 'Disposable Camera': 'contrast(1.2) saturate(1.3) sepia(0.2)' };
let guestCode = '', slidePhotos = [], slideIdx = 0, slideTimer = null;
function renderSlide(){
  if(!slidePhotos.length){ $('slideEmpty').classList.remove('hidden'); $('slideImg').classList.add('hidden'); $('slideCap').textContent=''; return; }
  $('slideEmpty').classList.add('hidden'); const ph = slidePhotos[slideIdx];
  $('slideImg').src = ph.storage_path; $('slideImg').classList.remove('hidden');
  $('slideCap').textContent = (ph.guest_name||'Tamu') + ' · ' + (ph.filter_name||'') + ' (' + (slideIdx+1) + '/' + slidePhotos.length + ')';
}
function stopSlide(){ if(slideTimer){ clearInterval(slideTimer); slideTimer=null; } $('slidePlay').textContent='Putar Otomatis'; }
$('slidePrev').addEventListener('click', ()=>{ stopSlide(); if(slidePhotos.length){ slideIdx=(slideIdx-1+slidePhotos.length)%slidePhotos.length; renderSlide(); } });
$('slideNext').addEventListener('click', ()=>{ stopSlide(); if(slidePhotos.length){ slideIdx=(slideIdx+1)%slidePhotos.length; renderSlide(); } });
$('slidePlay').addEventListener('click', ()=>{
  if(slideTimer){ stopSlide(); return; }
  if(!slidePhotos.length) return;
  $('slidePlay').textContent='Jeda'; slideTimer=setInterval(()=>{ slideIdx=(slideIdx+1)%slidePhotos.length; renderSlide(); }, 4000);
});
async function loadGuestGallery(){
  const g = await sb.rpc('get_guest_gallery', { p_code: guestCode });
  slidePhotos = (g.data && g.data.photos) ? g.data.photos : [];
  slideIdx = 0; stopSlide(); renderSlide();
  $('guestGallery').innerHTML = slidePhotos.length ? slidePhotos.map(ph=>`<div class="card"><img src="${ph.storage_path}" style="width:100%;border-radius:12px"><br>${ph.guest_name||'Tamu'} · ${ph.filter_name||''}</div>`).join('') : '<p>Belum ada foto yang disetujui.</p>';
}
async function refreshAuth(){
  if(!sb){ $('authStatus').textContent = 'Layanan login belum termuat. Coba muat ulang halaman.'; show('view-home'); return; }
  let user = null;
  try {
    const res = await Promise.race([
      sb.auth.getUser(),
      new Promise((_, rej)=>setTimeout(()=>rej(new Error('timeout')), 8000))
    ]);
    user = res.data.user;
  } catch (e) {
    $('authStatus').textContent = 'Tidak dapat memeriksa sesi (' + e.message + '). Formulir tetap bisa dibuka.';
    show('view-home'); return;
  }
  if(user){
    $('authStatus').textContent = 'Masuk sebagai ' + user.email;
    $('btnLogout').classList.remove('hidden');
    show('view-dashboard'); await loadDashboard();
  } else {
    $('authStatus').textContent = 'Belum masuk.';
    $('btnLogout').classList.add('hidden');
    show('view-home');
  }
}
async function loadDashboard(){
  const { data: { user } } = await sb.auth.getUser(); if(!user) return;
  const { data, error } = await sb.from('events').select('*').eq('owner_id', user.id).order('created_at', {ascending:false});
  if(error){ msg('Gagal memuat dashboard: ' + error.message); return; }
  const { data: toks } = await sb.from('event_access_tokens').select('event_id,code');
  const codeMap = {}; (toks||[]).forEach(x=>{ codeMap[x.event_id]=x.code; });
  $('eventList').innerHTML = data.length ? data.map(e=>{ const gc = codeMap[e.id]||''; const gl = gc ? guestLink(gc) : ''; return `<div class="card"><strong>${e.name}</strong><br>${e.type} · ${e.event_date} ${e.event_time}<br>Status: ${e.status} · Paket: ${e.plan_id}<br>Kode tamu: <strong>${gc||'-'}</strong>${gl ? `<br>Link tamu: <a href="${gl}">${gl}</a><br><button onclick="copyGuestLink('${gc}')">Salin Link</button> <button onclick="shareGuestWA('${gc}','${e.name.replace(/'/g,'')}')">Bagikan via WhatsApp</button> <button onclick="showQR('${gc}','qr-${e.id}')">Tampilkan QR</button><div id="qr-${e.id}"></div>` : ''}<br><button onclick="loadModeration('${e.id}','${e.name.replace(/'/g,'')}')">Moderasi</button> <button onclick="openGuest('${e.id}')">Buka sebagai tamu</button></div>`; }).join('') : '<p>Belum ada acara. Buat acara pertama dari formulir di bawah.</p>';
  const { data: plans } = await sb.from('plans').select('*').eq('is_active', true);
  if(plans) $('planList').innerHTML = plans.map(p=>`<div class="card"><strong>${p.name}</strong> — Rp${p.price_idr.toLocaleString('id-ID')}<br>${p.photo_quota} foto · maks ${p.max_events} acara · ${p.active_days} hari</div>`).join('');
}
function guestLink(code){ return window.location.origin + '/?code=' + code; }
function copyGuestLink(code){
  const link = guestLink(code);
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(link).then(()=>msg('Link tamu disalin: ' + link)).catch(()=>msg('Link tamu: ' + link)); }
  else { msg('Link tamu: ' + link); }
}
window.copyGuestLink = copyGuestLink;
function shareGuestWA(code, name){
  const link = guestLink(code);
  const text = encodeURIComponent('Undangan ' + name + ': buka link ini untuk mengunggah dan melihat foto acara: ' + link);
  window.open('https://wa.me/?text=' + text, '_blank');
}
window.shareGuestWA = shareGuestWA;
async function showQR(code, boxId){
  const box = $(boxId); if(!box) return;
  const link = guestLink(code);
  box.innerHTML = '<p class="small">Membuat QR…</p>';
  try {
    if(window.QRCode && window.QRCode.toDataURL){
      const url = await window.QRCode.toDataURL(link, { width: 220, margin: 1 });
      box.innerHTML = `<img src="${url}" style="width:220px;height:220px;border-radius:12px"><br><a href="${url}" download="qr-tamu-${code}.png"><button type="button">Unduh QR</button></a><p class="small">Pindai QR ini untuk membuka acara tanpa mengetik kode.</p>`;
    } else {
      const url = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(link);
      box.innerHTML = `<img src="${url}" style="width:220px;height:220px;border-radius:12px"><p class="small">Pindai QR ini untuk membuka acara tanpa mengetik kode.</p>`;
    }
  } catch(err){ box.innerHTML = '<p>QR gagal dibuat: ' + err.message + '</p>'; }
}
window.showQR = showQR;
async function loadModeration(eventId, eventName){
  const { data, error } = await sb.from('media_assets').select('*').eq('event_id', eventId).eq('status','pending').order('created_at', {ascending:false});
  if(error){ $('moderationArea').innerHTML = '<p>Gagal memuat moderasi: ' + error.message + '</p>'; return; }
  $('moderationArea').innerHTML = '<h4>' + eventName + ' — menunggu: ' + data.length + '</h4>' + (data.length ? data.map(m=>`<div class="card"><img src="${m.storage_path}" style="width:100%;border-radius:12px"><br>${m.guest_name} · ${m.filter_name}<br><button onclick="moderatePhoto('${m.id}','${eventId}','approved')">Setujui</button> <button onclick="moderatePhoto('${m.id}','${eventId}','rejected')">Tolak</button></div>`).join('') : '<p>Tidak ada foto menunggu.</p>');
  show('view-dashboard');
}
window.loadModeration = loadModeration;
async function moderatePhoto(photoId, eventId, status){
  const { data: { user } } = await sb.auth.getUser(); if(!user) return;
  const { error } = await sb.from('media_assets').update({ status }).eq('id', photoId);
  if(error){ msg('Moderasi gagal: ' + error.message); return; }
  await sb.from('moderation_actions').insert({ event_id: eventId, target_type: 'photo', target_id: photoId, action: status, actor_id: user.id });
  msg(status === 'approved' ? 'Foto disetujui dan kini tampil di galeri tamu.' : 'Foto ditolak.');
  const evName = $('moderationArea').querySelector('h4') ? $('moderationArea').querySelector('h4').textContent.split(' — ')[0] : '';
  await loadModeration(eventId, evName);
}
window.moderatePhoto = moderatePhoto;
async function openGuest(id){ msg('Untuk membuka sebagai tamu, minta kode acara dari pemilik, lalu pakai formulir Tamu di bawah.'); show('view-guest'); }
window.openGuest = openGuest;
$('formAuth').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = $('authEmail').value, password = $('authPassword').value, mode = $('authMode').value;
  let res;
  if(mode === 'signup'){
    res = await sb.auth.signUp({ email, password });
    if(res.data.user){
      await sb.from('profiles').upsert({ id: res.data.user.id, email, name: email.split('@')[0], role: 'owner' });
    }
  } else {
    res = await sb.auth.signInWithPassword({ email, password });
  }
  if(res.error) msg('Auth gagal: ' + res.error.message); else { if(res.data.user) { await sb.from('profiles').upsert({ id: res.data.user.id, email, name: email.split('@')[0], role: 'owner' }); } msg('Berhasil.'); await setTimeout(()=>{
  try {
    const params = new URLSearchParams(window.location.search);
    const autoCode = (params.get('code') || params.get('guest') || '').trim().toUpperCase();
    if(autoCode){ show('view-guest'); $('guestCode').value = autoCode; $('formGuest').dispatchEvent(new Event('submit')); }
  } catch(err) {}
}, 800);
$('formUpload').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const file = $('upFile').files[0]; if(!file){ $('upMsg').textContent='Pilih foto dulu.'; return; }
  const filterName = $('upFilter').value;
  $('upMsg').textContent='Memproses foto dengan filter ' + filterName + '…';
  try {
    const dataUrl = await new Promise((res, rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
    const img = await new Promise((res, rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=dataUrl; });
    const maxSide = 1200; const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.width*scale); cv.height = Math.round(img.height*scale);
    const ctx = cv.getContext('2d'); try { ctx.filter = FILTERS[filterName] || 'none'; } catch(err) {}
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const filtered = cv.toDataURL('image/jpeg', 0.82);
    $('upPreview').src = filtered; $('upPreview').classList.remove('hidden');
    const { data, error } = await sb.rpc('upload_guest_photo', { p_code: guestCode, p_guest_name: $('upName').value.trim(), p_filter_name: filterName, p_photo_data: filtered });
    if(error){ $('upMsg').textContent='Upload gagal: ' + error.message; return; }
    $('upMsg').textContent='Foto terkirim dan menunggu moderasi owner. Foto belum tampil di galeri sampai disetujui.';
    $('upFile').value='';
  } catch(err){ $('upMsg').textContent='Upload gagal: ' + err.message; }
});
refreshAuth(); }
});
$('btnLogout').addEventListener('click', async ()=>{ await sb.auth.signOut(); await refreshAuth(); });
$('formEvent').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const { data: { user } } = await sb.auth.getUser(); if(!user){ msg('Masuk dulu sebelum membuat acara.'); return; }
  const code = Math.random().toString(36).slice(2,8).toUpperCase();
  const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const ev = {
    owner_id: user.id, name: $('evName').value, type: $('evType').value, event_date: $('evDate').value,
    event_time: $('evTime').value, timezone: 'Asia/Jakarta', description: $('evDesc').value,
    cover_style: 'classic', theme: 'ivory', accent: '#D8BE96', font_style: 'serif',
    plan_id: $('evPlan').value, moderation: true, visibility: 'open', allow_download: true, allow_messages: true,
    status: 'active', upload_start: $('evDate').value + 'T00:00:00+07:00', upload_end: $('evDate').value + 'T23:59:00+07:00'
  };
  await sb.from('profiles').upsert({ id: user.id, email: user.email, name: user.email.split('@')[0], role: 'owner' });
  const { data, error } = await sb.from('events').insert(ev).select().single();
  if(error){ msg('Gagal membuat acara: ' + error.message); return; }
  const { error: terr } = await sb.from('event_access_tokens').insert({ event_id: data.id, code, token });
  if(terr){ msg('Acara dibuat, tetapi token gagal: ' + terr.message); return; }
  msg('Acara dibuat. Kode tamu: ' + code + ' — bagikan kode ini ke tamu.');
  await loadDashboard();
});
$('formGuest').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const code = $('guestCode').value.trim().toUpperCase();
  const { data, error } = await sb.rpc('get_guest_event', { p_code: code });
  if(error || !data || !data.event){ msg('Kode acara tidak valid atau sudah dicabut.'); return; }
  guestCode = code;
  $('guestResult').innerHTML = `<div class="card"><strong>${data.event.name}</strong><br>${data.event.type} · ${data.event.event_date}<br>${data.event.description}<br>Upload terbuka: ${data.uploads_open ? 'Ya' : 'Tidak — hanya pada hari acara'}</div>`;
  $('guestUpload').classList.toggle('hidden', !data.uploads_open);
  $('guestShowcase').classList.remove('hidden');
  await loadGuestGallery();
});
refreshAuth();

