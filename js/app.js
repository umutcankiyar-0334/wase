/* ====================================================
   APP.JS — SPA + Persistent Player + Track Detail Modal
   ==================================================== */

// ---- GLOBALS ----
const pages = ['home', 'music', 'gallery', 'notes', 'about'];
let currentPage = 'home';
let loadedPages = {};
let trackCache = {};       // id -> track data
let currentAudio = null;
let currentTrackEl = null;
let currentTrackId = null;
let isModalOpen = false;
const nowPlayingBar = document.getElementById('now-playing');

// ---- SPA ROUTING ----
function navigateTo(page) {
    if (!pages.includes(page)) page = 'home';
    window.location.hash = page;
}

function handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'home';
    const page = pages.includes(hash) ? hash : 'home';

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.toggle('active', a.dataset.page === page);
    });

    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    if (hamburger) hamburger.classList.remove('active');
    if (navLinks) navLinks.classList.remove('open');

    window.scrollTo(0, 0);
    currentPage = page;
    loadPageData(page);
}

async function loadPageData(page) {
    try {
        if (page === 'home' && !loadedPages.home) { await loadHomeData(); loadedPages.home = true; }
        else if (page === 'music' && !loadedPages.music) { await loadMusicPage(); loadedPages.music = true; }
        else if (page === 'gallery' && !loadedPages.gallery) { await loadGalleryPage(); loadedPages.gallery = true; }
        else if (page === 'notes' && !loadedPages.notes) { await loadNotesPage(); loadedPages.notes = true; }
        else if (page === 'about' && !loadedPages.about) { await loadAboutPage(); loadedPages.about = true; }
    } catch (err) { console.error('Load page error:', err); }
}

// ---- CACHE TRACKS ----
function cacheTracks(tracks) {
    tracks.forEach(t => { trackCache[t.id] = t; });
}

// ---- DATA LOADERS ----
async function loadHomeData() {
    const { data: md } = await supabase.from('musics').select('*').order('created_at', { ascending: false }).limit(3);
    const mc = document.getElementById('latest-music');
    if (md && md.length > 0) { cacheTracks(md); mc.innerHTML = md.map(t => trackHTML(t)).join(''); }
    else { showEmpty(mc, 'Henüz müzik eklenmemiş'); }

    const { data: id } = await supabase.from('images').select('*').order('created_at', { ascending: false }).limit(4);
    const ic = document.getElementById('latest-images');
    if (id && id.length > 0) { ic.innerHTML = id.map(i => galleryHTML(i)).join(''); }
    else { showEmpty(ic, 'Henüz görsel eklenmemiş'); }

    const { data: nd } = await supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(3);
    const nc = document.getElementById('latest-notes');
    if (nd && nd.length > 0) { nc.innerHTML = nd.map(n => noteHTML(n)).join(''); }
    else { showEmpty(nc, 'Henüz not eklenmemiş'); }
}

async function loadMusicPage() {
    const c = document.getElementById('all-tracks');
    const { data, error } = await supabase.from('musics').select('*').order('created_at', { ascending: false });
    if (error || !data || data.length === 0) { showEmpty(c, data ? 'Henüz müzik eklenmemiş' : 'Yüklenirken hata'); return; }
    cacheTracks(data);
    c.innerHTML = data.map(t => trackHTML(t)).join('');
}

async function loadGalleryPage() {
    const c = document.getElementById('all-images');
    const { data, error } = await supabase.from('images').select('*').order('created_at', { ascending: false });
    if (error || !data || data.length === 0) { showEmpty(c, 'Henüz görsel eklenmemiş'); return; }
    c.innerHTML = data.map(i => galleryHTML(i)).join('');
}

async function loadNotesPage() {
    const c = document.getElementById('all-notes');
    const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
    if (error || !data || data.length === 0) { showEmpty(c, 'Henüz not eklenmemiş'); return; }
    c.innerHTML = data.map(n => noteHTML(n)).join('');
}

async function loadAboutPage() {
    try {
        const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl('covers/about.jpg');
        const aboutImg = document.getElementById('about-image');
        if (aboutImg) aboutImg.src = urlData.publicUrl;
        const [mr, ir, nr] = await Promise.all([
            supabase.from('musics').select('id', { count: 'exact', head: true }),
            supabase.from('images').select('id', { count: 'exact', head: true }),
            supabase.from('notes').select('id', { count: 'exact', head: true })
        ]);
        document.getElementById('stat-music').textContent = mr.count || 0;
        document.getElementById('stat-images').textContent = ir.count || 0;
        document.getElementById('stat-notes').textContent = nr.count || 0;
    } catch (e) { console.error(e); }
}

// ---- HTML TEMPLATES ----
function escAttr(s) { return s ? s.replace(/'/g, "\\'").replace(/"/g, '&quot;') : ''; }

function trackHTML(t) {
    return `<div class="track-item" id="track-${t.id}">
    <div class="track-cover-container" onclick="openTrackDetail('${t.id}')">
      <img class="track-cover" src="${t.cover_url || ''}" alt="${escAttr(t.title)}">
    </div>
    <div class="track-info">
      <div class="track-title-wrapper" onclick="openTrackDetail('${t.id}')">
        <div class="track-title">${t.title}</div>
        <div class="track-genre">${t.genre || ''}</div>
      </div>
    </div>
    <span class="track-bpm">${t.bpm ? t.bpm + ' BPM' : ''}</span>
    <button class="track-play-btn" onclick="event.stopPropagation();playTrackOnly('${t.id}')">▶</button>
  </div>`;
}

function galleryHTML(i) {
    return `<div class="gallery-item" onclick="openLightbox('${escAttr(i.image_url)}')">
    <img src="${i.image_url}" alt="${escAttr(i.title)}" loading="lazy">
    <div class="gallery-overlay"><div class="gallery-overlay-title">${i.title}</div><div class="gallery-overlay-desc">${i.description || ''}</div></div>
  </div>`;
}

function noteHTML(n) {
    return `<div class="note-card">
    <div class="note-date">${formatDate(n.created_at)}</div>
    <div class="note-title">${n.title}</div>
    <div class="note-content">${n.content || ''}</div>
  </div>`;
}

// ---- TIME FORMAT ----
function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// ====================================================
// MUSIC PLAYER (plays in mini-bar only, no modal)
// ====================================================
function playTrackOnly(id) {
    const t = trackCache[id];
    if (!t) return;
    startAudio(t, document.getElementById('track-' + id), false);
}

// ====================================================
// TRACK DETAIL MODAL
// ====================================================
function generateWaveformBars() {
    const wf = document.getElementById('tm-waveform');
    if (!wf || wf.children.length > 0) return;
    let bars = '';
    for (let i = 0; i < 28; i++) {
        const delay = (Math.random() * 1.2).toFixed(2);
        const maxH = 10 + Math.random() * 30;
        bars += `<div class="wv-bar" style="animation-delay:${delay}s;height:${maxH}px"></div>`;
    }
    wf.innerHTML = bars;
}

async function openTrackDetail(id, autoplay = true) {
    let t = trackCache[id];
    // If not cached, fetch from DB
    if (!t) {
        const { data } = await supabase.from('musics').select('*').eq('id', id).single();
        if (!data) { showToast('Parça bulunamadı', 'error'); return; }
        t = data;
        trackCache[id] = t;
    }

    const modal = document.getElementById('track-modal');
    const bg = document.getElementById('tm-bg');
    const coverImg = document.getElementById('tm-cover-img');
    const titleEl = document.getElementById('tm-title-text');
    const metaEl = document.getElementById('tm-meta-text');

    // Set content
    bg.style.backgroundImage = `url('${t.cover_url || ''}')`;
    coverImg.src = t.cover_url || '';
    titleEl.textContent = t.title;

    let metaParts = [];
    if (t.genre) metaParts.push(t.genre);
    if (t.bpm) metaParts.push(t.bpm + ' BPM');
    metaEl.innerHTML = metaParts.join('<span class="tm-meta-dot"></span>');

    // Generate waveform
    generateWaveformBars();

    // Open modal
    modal.classList.remove('closing');
    modal.classList.add('active');
    isModalOpen = true;
    document.body.style.overflow = 'hidden';

    // Hide mini-player while modal is open
    nowPlayingBar.classList.remove('active');

    // Start playing (or just load if autoplay is false)
    startAudio(t, document.getElementById('track-' + id), true, autoplay);
    if (autoplay) coverImg.classList.add('playing-anim');
}

function closeTrackDetail() {
    const modal = document.getElementById('track-modal');
    modal.classList.add('closing');
    isModalOpen = false;
    document.body.style.overflow = '';
    document.getElementById('tm-cover-img').classList.remove('playing-anim');

    // Stop audio completely
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
    }
    if (currentTrackEl) currentTrackEl.classList.remove('playing');
    currentTrackEl = null;
    currentTrackId = null;

    // Hide mini-player too
    nowPlayingBar.classList.remove('active');

    setTimeout(() => {
        modal.classList.remove('active', 'closing');
    }, 300);
}

function minimizeTrackDetail() {
    const modal = document.getElementById('track-modal');
    modal.classList.add('closing');
    isModalOpen = false;
    document.body.style.overflow = '';
    document.getElementById('tm-cover-img').classList.remove('playing-anim');

    // Show mini-player, keep music playing
    if (currentAudio && !currentAudio.paused) {
        nowPlayingBar.classList.add('active');
    }

    setTimeout(() => {
        modal.classList.remove('active', 'closing');
    }, 300);
}

function copyTrackLink(id) {
    const url = window.location.origin + window.location.pathname + '?track=' + id;
    const btn = document.getElementById('tm-share');
    navigator.clipboard.writeText(url).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '✓ Kopyalandı';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '🔗 Bağlantıyı Kopyala';
        }, 2000);
    }).catch(() => { showToast('Kopyalanamadı', 'error'); });
}

// ====================================================
// UNIFIED AUDIO ENGINE
// ====================================================
function startAudio(track, trackEl, openModal, autoplay = true) {
    const npCover = document.getElementById('np-cover');
    const npTitle = document.getElementById('np-title');
    const npFill = document.getElementById('np-fill');
    const npPlayPause = document.getElementById('np-play-pause');
    const npCurrent = document.getElementById('np-current');
    const npDuration = document.getElementById('np-duration');

    // Same track? Toggle play/pause
    if (currentTrackId === track.id && currentAudio) {
        if (currentAudio.paused) {
            currentAudio.play().catch(e => console.log("Play blocked"));
            syncPlayState(true);
        } else {
            currentAudio.pause();
            syncPlayState(false);
        }
        return;
    }

    // Stop previous
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        if (currentTrackEl) currentTrackEl.classList.remove('playing');
    }

    // New audio
    currentAudio = new Audio(track.audio_url);
    currentTrackEl = trackEl;
    currentTrackId = track.id;

    const volSlider = document.getElementById('np-volume');
    currentAudio.volume = volSlider ? parseFloat(volSlider.value) : 1;

    // Mini-player UI
    if (npCover) npCover.src = track.cover_url || '';
    if (npTitle) npTitle.textContent = track.title;
    if (trackEl) trackEl.classList.add('playing');

    // Show mini-player only if modal is NOT open
    if (!openModal && !isModalOpen) {
        nowPlayingBar.classList.add('active');
    }

    if (autoplay) {
        currentAudio.play().then(() => {
            syncPlayState(true);
        }).catch(e => {
            console.warn("Autoplay blocked:", e);
            syncPlayState(false);
            showToast('Oynatmak için basınız', 'info');
        });
    } else {
        syncPlayState(false);
    }

    // Time updates — sync both mini-player AND modal
    currentAudio.addEventListener('timeupdate', () => {
        if (!currentAudio || !currentAudio.duration) return;
        const pct = (currentAudio.currentTime / currentAudio.duration) * 100;
        const curTime = formatTime(currentAudio.currentTime);

        // Mini-player
        if (npFill) npFill.style.width = pct + '%';
        if (npCurrent) npCurrent.textContent = curTime;

        // Modal
        const tmFill = document.getElementById('tm-prog-fill');
        const tmCur = document.getElementById('tm-cur');
        if (tmFill) tmFill.style.width = pct + '%';
        if (tmCur) tmCur.textContent = curTime;
    });

    currentAudio.addEventListener('loadedmetadata', () => {
        const dur = formatTime(currentAudio.duration);
        if (npDuration) npDuration.textContent = dur;
        const tmDur = document.getElementById('tm-dur');
        if (tmDur) tmDur.textContent = dur;
    });

    currentAudio.addEventListener('ended', () => {
        syncPlayState(false);
        if (trackEl) trackEl.classList.remove('playing');
        if (npFill) npFill.style.width = '0%';
        if (npCurrent) npCurrent.textContent = '0:00';
        const tmFill = document.getElementById('tm-prog-fill');
        if (tmFill) tmFill.style.width = '0%';
        const tmCur = document.getElementById('tm-cur');
        if (tmCur) tmCur.textContent = '0:00';
        currentAudio = null;
        currentTrackId = null;
        const coverImg = document.getElementById('tm-cover-img');
        if (coverImg) coverImg.classList.remove('playing-anim');
    });
}

function syncPlayState(playing) {
    const npPP = document.getElementById('np-play-pause');
    const tmPP = document.getElementById('tm-play');
    const wf = document.getElementById('tm-waveform');
    const coverImg = document.getElementById('tm-cover-img');

    if (npPP) npPP.textContent = playing ? '⏸' : '▶';
    if (tmPP) tmPP.textContent = playing ? '⏸' : '▶';
    if (wf) wf.classList.toggle('paused', !playing);
    if (coverImg) coverImg.classList.toggle('playing-anim', playing);
}

// ---- LIGHTBOX ----
function openLightbox(url) {
    const lb = document.getElementById('lightbox');
    lb.querySelector('img').src = url;
    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.body.style.overflow = '';
}

// ---- COPY EMAIL ----
window.copyEmail = function () {
    const el = document.getElementById('email-copy');
    navigator.clipboard.writeText('umutcankiyar@gmail.com').then(() => {
        el.innerText = '✓ Kopyalandı';
        setTimeout(() => { el.innerText = '✉ umutcankiyar@gmail.com'; }, 2000);
    }).catch(() => { showToast('Kopyalanamadı', 'error'); });
};

// ---- URL PARAM: ?track=id ----
async function checkTrackParam() {
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get('track');
    if (!trackId) return;
    // Small delay to let page initialize
    setTimeout(() => { openTrackDetail(trackId, false); }, 600);
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
    // Nav links
    document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
        a.addEventListener('click', (e) => { e.preventDefault(); navigateTo(a.dataset.page); });
    });

    // Hamburger
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('open');
        });
    }

    // Lightbox
    const lb = document.getElementById('lightbox');
    if (lb) {
        lb.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
        lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
    }

    // ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isModalOpen) minimizeTrackDetail();
            else closeLightbox();
        }
    });

    // Mini-player controls
    const npPP = document.getElementById('np-play-pause');
    if (npPP) npPP.addEventListener('click', () => {
        if (!currentAudio) return;
        if (currentAudio.paused) { currentAudio.play(); syncPlayState(true); }
        else { currentAudio.pause(); syncPlayState(false); }
    });

    // Mini-player progress seek
    const npProg = document.getElementById('np-progress');
    if (npProg) npProg.addEventListener('click', (e) => {
        if (currentAudio && currentAudio.duration) {
            const r = npProg.getBoundingClientRect();
            currentAudio.currentTime = ((e.clientX - r.left) / r.width) * currentAudio.duration;
        }
    });

    // Volume
    const volSlider = document.getElementById('np-volume');
    const volBtn = document.getElementById('np-vol-btn');
    if (volSlider) volSlider.addEventListener('input', () => {
        const val = parseFloat(volSlider.value);
        if (currentAudio) currentAudio.volume = val;
        if (volBtn) {
            volBtn.classList.toggle('muted', val === 0);
        }
    });

    if (volBtn) volBtn.addEventListener('click', () => {
        if (!currentAudio) return;
        if (currentAudio.volume > 0) {
            volBtn.dataset.prev = currentAudio.volume;
            currentAudio.volume = 0;
            volSlider.value = 0;
            volBtn.classList.add('muted');
        } else {
            const prev = parseFloat(volBtn.dataset.prev || 1);
            currentAudio.volume = prev;
            volSlider.value = prev;
            volBtn.classList.remove('muted');
        }
    });

    // ---- TRACK MODAL CONTROLS ----
    document.getElementById('tm-close').addEventListener('click', closeTrackDetail);
    document.getElementById('tm-minimize').addEventListener('click', minimizeTrackDetail);
    document.getElementById('tm-share').addEventListener('click', () => {
        if (currentTrackId) copyTrackLink(currentTrackId);
    });

    // Modal play/pause
    document.getElementById('tm-play').addEventListener('click', () => {
        if (!currentAudio) return;
        if (currentAudio.paused) { currentAudio.play(); syncPlayState(true); }
        else { currentAudio.pause(); syncPlayState(false); }
    });

    // Modal progress seek
    const tmProg = document.getElementById('tm-prog-bar');
    if (tmProg) tmProg.addEventListener('click', (e) => {
        if (currentAudio && currentAudio.duration) {
            const r = tmProg.getBoundingClientRect();
            currentAudio.currentTime = ((e.clientX - r.left) / r.width) * currentAudio.duration;
        }
    });

    // Scroll effect
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.navbar');
        if (nav) nav.style.background = window.scrollY > 50 ? 'rgba(10,10,10,.95)' : 'rgba(10,10,10,.85)';
    });

    // Initial route
    handleRoute();

    // Check ?track=id param
    checkTrackParam();
});

window.addEventListener('hashchange', handleRoute);
