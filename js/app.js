/* ====================================================
   APP.JS — SPA Routing + Persistent Music Player
   ==================================================== */

// ---- SPA ROUTING ----
const pages = ['home', 'music', 'gallery', 'notes', 'about'];
let currentPage = 'home';
let loadedPages = {};

function navigateTo(page) {
    if (!pages.includes(page)) page = 'home';
    window.location.hash = page;
}

function handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'home';
    const page = pages.includes(hash) ? hash : 'home';

    // Hide all pages, show target
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    // Update nav active
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.toggle('active', a.dataset.page === page);
    });

    // Close mobile menu
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    if (hamburger) hamburger.classList.remove('active');
    if (navLinks) navLinks.classList.remove('open');

    // Scroll to top
    window.scrollTo(0, 0);

    // Load page data
    currentPage = page;
    loadPageData(page);

    // Footer padding for player
    document.body.classList.toggle('page-padded', nowPlayingBar && nowPlayingBar.classList.contains('active'));
}

async function loadPageData(page) {
    try {
        if (page === 'home' && !loadedPages.home) {
            await loadHomeData();
            loadedPages.home = true;
        } else if (page === 'music' && !loadedPages.music) {
            await loadMusicPage();
            loadedPages.music = true;
        } else if (page === 'gallery' && !loadedPages.gallery) {
            await loadGalleryPage();
            loadedPages.gallery = true;
        } else if (page === 'notes' && !loadedPages.notes) {
            await loadNotesPage();
            loadedPages.notes = true;
        } else if (page === 'about' && !loadedPages.about) {
            await loadAboutPage();
            loadedPages.about = true;
        }
    } catch (err) {
        console.error('Load page error:', err);
    }
}

// ---- HOME DATA ----
async function loadHomeData() {
    // Latest 3 music
    const { data: md } = await supabase.from('musics').select('*').order('created_at', { ascending: false }).limit(3);
    const mc = document.getElementById('latest-music');
    if (md && md.length > 0) {
        mc.innerHTML = md.map(t => trackHTML(t)).join('');
    } else { showEmpty(mc, 'Henüz müzik eklenmemiş'); }

    // Latest 4 images
    const { data: id } = await supabase.from('images').select('*').order('created_at', { ascending: false }).limit(4);
    const ic = document.getElementById('latest-images');
    if (id && id.length > 0) {
        ic.innerHTML = id.map(i => galleryHTML(i)).join('');
    } else { showEmpty(ic, 'Henüz görsel eklenmemiş'); }

    // Latest 3 notes
    const { data: nd } = await supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(3);
    const nc = document.getElementById('latest-notes');
    if (nd && nd.length > 0) {
        nc.innerHTML = nd.map(n => noteHTML(n)).join('');
    } else { showEmpty(nc, 'Henüz not eklenmemiş'); }
}

async function loadMusicPage() {
    const c = document.getElementById('all-tracks');
    const { data, error } = await supabase.from('musics').select('*').order('created_at', { ascending: false });
    if (error) { showEmpty(c, 'Yüklenirken hata oluştu'); return; }
    if (!data || data.length === 0) { showEmpty(c, 'Henüz müzik eklenmemiş'); return; }
    c.innerHTML = data.map(t => trackHTML(t)).join('');
}

async function loadGalleryPage() {
    const c = document.getElementById('all-images');
    const { data, error } = await supabase.from('images').select('*').order('created_at', { ascending: false });
    if (error) { showEmpty(c, 'Yüklenirken hata oluştu'); return; }
    if (!data || data.length === 0) { showEmpty(c, 'Henüz görsel eklenmemiş'); return; }
    c.innerHTML = data.map(i => galleryHTML(i)).join('');
}

async function loadNotesPage() {
    const c = document.getElementById('all-notes');
    const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
    if (error) { showEmpty(c, 'Yüklenirken hata oluştu'); return; }
    if (!data || data.length === 0) { showEmpty(c, 'Henüz not eklenmemiş'); return; }
    c.innerHTML = data.map(n => noteHTML(n)).join('');
}

async function loadAboutPage() {
    try {
        // Profil resmini Storage'dan al
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
    return `<div class="track-item" onclick="playTrack('${escAttr(t.audio_url)}','${escAttr(t.title)}','${escAttr(t.cover_url)}',this)">
    <img class="track-cover" src="${t.cover_url || ''}" alt="${escAttr(t.title)}">
    <div class="track-info"><div class="track-title">${t.title}</div><div class="track-genre">${t.genre || ''}</div></div>
    <span class="track-bpm">${t.bpm ? t.bpm + ' BPM' : ''}</span>
    <button class="track-play-btn">▶</button>
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

// ---- PERSISTENT MUSIC PLAYER ----
let currentAudio = null;
let currentTrackEl = null;
const nowPlayingBar = document.getElementById('now-playing');

function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function playTrack(url, title, cover, el) {
    const npCover = document.getElementById('np-cover');
    const npTitle = document.getElementById('np-title');
    const npFill = document.getElementById('np-fill');
    const npPlayPause = document.getElementById('np-play-pause');
    const npCurrent = document.getElementById('np-current');
    const npDuration = document.getElementById('np-duration');

    // Same track clicked — toggle
    if (currentTrackEl === el && currentAudio) {
        if (currentAudio.paused) {
            currentAudio.play();
            npPlayPause.textContent = '⏸';
        } else {
            currentAudio.pause();
            npPlayPause.textContent = '▶';
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
    currentAudio = new Audio(url);
    currentTrackEl = el;

    // Volume
    const volSlider = document.getElementById('np-volume');
    currentAudio.volume = volSlider ? parseFloat(volSlider.value) : 1;

    // UI
    if (npCover) npCover.src = cover || '';
    if (npTitle) npTitle.textContent = title;
    if (el) el.classList.add('playing');
    nowPlayingBar.classList.add('active');
    npPlayPause.textContent = '⏸';

    currentAudio.play().catch(e => { console.error(e); showToast('Ses çalınamadı', 'error'); });

    currentAudio.addEventListener('timeupdate', () => {
        if (currentAudio.duration) {
            const pct = (currentAudio.currentTime / currentAudio.duration) * 100;
            if (npFill) npFill.style.width = pct + '%';
            if (npCurrent) npCurrent.textContent = formatTime(currentAudio.currentTime);
        }
    });

    currentAudio.addEventListener('loadedmetadata', () => {
        if (npDuration) npDuration.textContent = formatTime(currentAudio.duration);
    });

    currentAudio.addEventListener('ended', () => {
        if (el) el.classList.remove('playing');
        npPlayPause.textContent = '▶';
        if (npFill) npFill.style.width = '0%';
        if (npCurrent) npCurrent.textContent = '0:00';
    });
}

// ---- LIGHTBOX ----
function openLightbox(url) {
    const lb = document.getElementById('lightbox');
    const img = lb.querySelector('img');
    img.src = url;
    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lb = document.getElementById('lightbox');
    lb.classList.remove('active');
    document.body.style.overflow = '';
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
    // Nav links
    document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(a.dataset.page);
        });
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
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
    }

    // Player controls
    const npPlayPause = document.getElementById('np-play-pause');
    if (npPlayPause) {
        npPlayPause.addEventListener('click', () => {
            if (!currentAudio) return;
            if (currentAudio.paused) { currentAudio.play(); npPlayPause.textContent = '⏸'; }
            else { currentAudio.pause(); npPlayPause.textContent = '▶'; }
        });
    }

    // Progress bar click
    const npProgress = document.getElementById('np-progress');
    if (npProgress) {
        npProgress.addEventListener('click', (e) => {
            if (currentAudio && currentAudio.duration) {
                const rect = npProgress.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                currentAudio.currentTime = pos * currentAudio.duration;
            }
        });
    }

    // Volume
    const volSlider = document.getElementById('np-volume');
    const volBtn = document.getElementById('np-vol-btn');
    if (volSlider) {
        volSlider.addEventListener('input', () => {
            if (currentAudio) currentAudio.volume = parseFloat(volSlider.value);
            if (volBtn) volBtn.textContent = parseFloat(volSlider.value) === 0 ? '🔇' : '🔊';
        });
    }
    if (volBtn) {
        volBtn.addEventListener('click', () => {
            if (!currentAudio) return;
            if (currentAudio.volume > 0) {
                volBtn.dataset.prevVol = currentAudio.volume;
                currentAudio.volume = 0;
                volSlider.value = 0;
                volBtn.textContent = '🔇';
            } else {
                currentAudio.volume = parseFloat(volBtn.dataset.prevVol || 1);
                volSlider.value = currentAudio.volume;
                volBtn.textContent = '🔊';
            }
        });
    }

    // Scroll effect
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.navbar');
        if (nav) nav.style.background = window.scrollY > 50 ? 'rgba(10,10,10,.95)' : 'rgba(10,10,10,.85)';
    });

    // Handle initial route
    handleRoute();
});

window.addEventListener('hashchange', handleRoute);
