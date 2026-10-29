
const { supabaseUrl, supabaseAnonKey } = MOMENTARA_CONFIG;
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
const $ = (id) => document.getElementById(id);
function show(id){ document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden')); $(id).classList.remove('hidden'); }
function msg(t){ $('msg').textContent = t; }
async function refreshAuth(){
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data: { user } } = await supabase.auth.getUser(); if(!user) return;
  const { data, error } = await supabase.from('events').select('*').eq('owner_id', user.id).order('created_at', {ascending:false});
  if(error){ msg('Gagal memuat dashboard: ' + error.message); return; }
  $('eventList').innerHTML = data.length ? data.map(e=>`<div class="card"><strong>${e.name}</strong><br>${e.type} · ${e.event_date} ${e.event_time}<br>Status: ${e.status} · Paket: ${e.plan_id}<br><button onclick="openGuest('${e.id}')">Lihat sebagai tamu (butuh kode)</button></div>`).join('') : '<p>Belum ada acara. Buat acara pertama dari formulir di bawah.</p>';
  const { data: plans } = await supabase.from('plans').select('*').eq('is_active', true);
  if(plans) $('planList').innerHTML = plans.map(p=>`<div class="card"><strong>${p.name}</strong> — Rp${p.price_idr.toLocaleString('id-ID')}<br>${p.photo_quota} foto · maks ${p.max_events} acara · ${p.active_days} hari</div>`).join('');
}
async function openGuest(id){ msg('Untuk membuka sebagai tamu, minta kode acara dari pemilik, lalu pakai formulir Tamu di bawah.'); show('view-guest'); }
window.openGuest = openGuest;
$('formAuth').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = $('authEmail').value, password = $('authPassword').value, mode = $('authMode').value;
  let res;
  if(mode === 'signup'){
    res = await supabase.auth.signUp({ email, password });
    if(res.data.user){
      await supabase.from('profiles').upsert({ id: res.data.user.id, email, name: email.split('@')[0], role: 'owner' });
    }
  } else {
    res = await supabase.auth.signInWithPassword({ email, password });
  }
  if(res.error) msg('Auth gagal: ' + res.error.message); else { msg('Berhasil.'); await refreshAuth(); }
});
$('btnLogout').addEventListener('click', async ()=>{ await supabase.auth.signOut(); await refreshAuth(); });
$('formEvent').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const { data: { user } } = await supabase.auth.getUser(); if(!user){ msg('Masuk dulu sebelum membuat acara.'); return; }
  const code = Math.random().toString(36).slice(2,8).toUpperCase();
  const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const ev = {
    owner_id: user.id, name: $('evName').value, type: $('evType').value, event_date: $('evDate').value,
    event_time: $('evTime').value, timezone: 'Asia/Jakarta', description: $('evDesc').value,
    cover_style: 'classic', theme: 'ivory', accent: '#D8BE96', font_style: 'serif',
    plan_id: $('evPlan').value, moderation: true, visibility: 'open', allow_download: true, allow_messages: true,
    status: 'active', upload_start: $('evDate').value + 'T00:00:00+07:00', upload_end: $('evDate').value + 'T23:59:00+07:00'
  };
  const { data, error } = await supabase.from('events').insert(ev).select().single();
  if(error){ msg('Gagal membuat acara: ' + error.message); return; }
  const { error: terr } = await supabase.from('event_access_tokens').insert({ event_id: data.id, code, token });
  if(terr){ msg('Acara dibuat, tetapi token gagal: ' + terr.message); return; }
  msg('Acara dibuat. Kode tamu: ' + code + ' — bagikan kode ini ke tamu.');
  await loadDashboard();
});
$('formGuest').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const code = $('guestCode').value.trim().toUpperCase();
  const { data, error } = await supabase.rpc('get_guest_event', { p_code: code });
  if(error || !data || !data.event){ msg('Kode acara tidak valid atau sudah dicabut.'); return; }
  $('guestResult').innerHTML = `<div class="card"><strong>${data.event.name}</strong><br>${data.event.type} · ${data.event.event_date}<br>${data.event.description}<br>Upload terbuka: ${data.uploads_open ? 'Ya' : 'Tidak'}</div>`;
  const g = await supabase.rpc('get_guest_gallery', { p_code: code });
  if(g.data && g.data.photos) $('guestResult').innerHTML += `<p>Foto yang sudah disetujui: ${g.data.photos.length}</p>`;
});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click', ()=>show(b.dataset.view)));
refreshAuth();
