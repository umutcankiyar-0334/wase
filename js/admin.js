/* ====================================================
   ADMIN.JS — Admin Panel İşlevleri
   ==================================================== */

// ---- SESSION TIMEOUT CONFIG ----
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 dakika
let sessionTimer = null;
let sessionExpiry = null;

function startSessionTimer() {
  clearTimeout(sessionTimer);
  sessionExpiry = Date.now() + SESSION_TIMEOUT_MS;
  sessionTimer = setTimeout(() => {
    showToast('Oturum zaman aşımına uğradı. Lütfen tekrar giriş yapın.', 'error');
    adminLogout();
  }, SESSION_TIMEOUT_MS);
}

function resetSessionTimer() {
  if (sessionExpiry) startSessionTimer();
}

// Her kullanıcı etkileşiminde süreyi sıfırla
['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, resetSessionTimer, { passive: true });
});

// ---- Admin Giriş Kontrolü ----
async function checkAdminAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  // Token geçerliliğini kontrol et
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    await supabase.auth.signOut();
    return false;
  }

  startSessionTimer();
  return true;
}

// ---- Admin Login ----
async function adminLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    showToast('Giriş başarısız: ' + error.message, 'error');
    return false;
  }

  showToast('Giriş başarılı!', 'success');
  startSessionTimer();
  return true;
}

// ---- Admin Logout ----
async function adminLogout() {
  clearTimeout(sessionTimer);
  sessionExpiry = null;
  await supabase.auth.signOut();
  showToast('Çıkış yapıldı', 'success');

  const loginScreen = document.getElementById('login-screen');
  const adminPanel = document.getElementById('admin-panel');
  if (loginScreen) loginScreen.style.display = '';
  if (adminPanel) adminPanel.style.display = 'none';
}

// ---- Visibility Change: sekme tekrar aktif olunca yetki kontrolü ----
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel && adminPanel.style.display !== 'none') {
      const isAuth = await checkAdminAuth();
      if (!isAuth) {
        showToast('Oturum sona erdi. Lütfen tekrar giriş yapın.', 'error');
        adminLogout();
      }
    }
  }
});

// ---- Tab Değiştirme ----
function initAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const sections = document.querySelectorAll('.admin-section');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(`section-${target}`)?.classList.add('active');

      if (target === 'music') loadAdminMusic();
      if (target === 'images') loadAdminImages();
      if (target === 'notes') loadAdminNotes();
    });
  });
}

// ---- DOSYA DOĞRULAMA ----
const ALLOWED_AUDIO_TYPES = ['.mp3', '.m4a'];
const ALLOWED_AUDIO_MIMES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];
const IMAGE_MIN_SIZE = 10 * 1024;        // 10 KB
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;  // 10 MB
const IMAGE_MIN_PX = 200;                 // 200px min genişlik/yükseklik
const IMAGE_MAX_PX = 8000;                // 8000px max genişlik/yükseklik

function validateAudioFile(file) {
  if (!file) return 'Ses dosyası seçiniz.';
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_AUDIO_TYPES.includes(ext) && !ALLOWED_AUDIO_MIMES.includes(file.type)) {
    return `Sadece ${ALLOWED_AUDIO_TYPES.join(', ')} formatları desteklenir. Seçilen: ${ext}`;
  }
  return null; // geçerli
}

function validateImageFile(file) {
  return new Promise((resolve) => {
    if (!file) { resolve('Görsel seçiniz.'); return; }
    if (file.size < IMAGE_MIN_SIZE) { resolve(`Görsel çok küçük (min ${(IMAGE_MIN_SIZE / 1024).toFixed(0)} KB). Mevcut: ${(file.size / 1024).toFixed(0)} KB`); return; }
    if (file.size > IMAGE_MAX_SIZE) { resolve(`Görsel çok büyük (max ${(IMAGE_MAX_SIZE / 1024 / 1024).toFixed(0)} MB). Mevcut: ${(file.size / 1024 / 1024).toFixed(1)} MB`); return; }

    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      if (img.width < IMAGE_MIN_PX || img.height < IMAGE_MIN_PX) {
        resolve(`Görsel çok küçük. Minimum ${IMAGE_MIN_PX}x${IMAGE_MIN_PX}px olmalı. Mevcut: ${img.width}x${img.height}px`);
      } else if (img.width > IMAGE_MAX_PX || img.height > IMAGE_MAX_PX) {
        resolve(`Görsel çok büyük. Maksimum ${IMAGE_MAX_PX}x${IMAGE_MAX_PX}px olmalı. Mevcut: ${img.width}x${img.height}px`);
      } else {
        resolve(null); // geçerli
      }
    };
    img.onerror = () => { resolve('Görsel dosyası okunamadı.'); };
    img.src = URL.createObjectURL(file);
  });
}

/* ====================================================
   MÜZİK YÖNETİMİ
   ==================================================== */

async function addMusic(formData) {
  try {
    // Ses dosyası doğrulama
    const audioErr = validateAudioFile(formData.audioFile);
    if (audioErr) { showToast(audioErr, 'error'); return; }

    // Kapak görseli doğrulama (opsiyonel ama seçildiyse kontrol et)
    if (formData.coverFile) {
      const coverErr = await validateImageFile(formData.coverFile);
      if (coverErr) { showToast(coverErr, 'error'); return; }
    }

    let coverUrl = '';
    let audioUrl = '';

    if (formData.coverFile) {
      coverUrl = await uploadFile(formData.coverFile, 'covers');
    }

    if (formData.audioFile) {
      audioUrl = await uploadFile(formData.audioFile, 'music');
    }

    const { data, error } = await supabase
      .from('musics')
      .insert([{
        title: formData.title,
        bpm: parseInt(formData.bpm) || null,
        genre: formData.genre,
        cover_url: coverUrl,
        audio_url: audioUrl
      }])
      .select();

    if (error) throw error;

    showToast('Müzik başarıyla eklendi!', 'success');
    loadAdminMusic();
    return data;
  } catch (err) {
    console.error('Add music error:', err);
    showToast('Müzik eklenirken hata oluştu', 'error');
  }
}

async function deleteMusic(id, coverUrl, audioUrl) {
  if (!confirm('Bu müziği silmek istediğinize emin misiniz?')) return;

  try {
    if (coverUrl) await deleteFile(coverUrl);
    if (audioUrl) await deleteFile(audioUrl);

    const { error } = await supabase
      .from('musics')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('Müzik silindi', 'success');
    loadAdminMusic();
  } catch (err) {
    console.error('Delete music error:', err);
    showToast('Silme işlemi başarısız', 'error');
  }
}

async function loadAdminMusic() {
  const tableBody = document.getElementById('music-table-body');
  if (!tableBody) return;

  const { data, error } = await supabase
    .from('musics')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Müzikler yüklenemedi', 'error');
    return;
  }

  if (!data || data.length === 0) {
    showEmpty(tableBody.parentElement, 'Henüz müzik eklenmemiş');
    return;
  }

  adminDataCache.music = data;

  tableBody.parentElement.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Kapak</th>
          <th>Başlık</th>
          <th>BPM</th>
          <th>Tür</th>
          <th>Tarih</th>
          <th>İşlem</th>
        </tr>
      </thead>
      <tbody id="music-table-body"></tbody>
    </table>
  `;

  renderMusicTable(data);
}

/* ====================================================
   GÖRSEL YÖNETİMİ
   ==================================================== */

async function addImage(formData) {
  try {
    // Görsel doğrulama
    const imgErr = await validateImageFile(formData.imageFile);
    if (imgErr) { showToast(imgErr, 'error'); return; }

    let imageUrl = '';

    if (formData.imageFile) {
      imageUrl = await uploadFile(formData.imageFile, 'images');
    }

    const { data, error } = await supabase
      .from('images')
      .insert([{
        title: formData.title,
        image_url: imageUrl,
        description: formData.description || ''
      }])
      .select();

    if (error) throw error;

    showToast('Görsel başarıyla eklendi!', 'success');
    loadAdminImages();
    return data;
  } catch (err) {
    console.error('Add image error:', err);
    showToast('Görsel eklenirken hata oluştu', 'error');
  }
}

async function deleteImage(id, imageUrl) {
  if (!confirm('Bu görseli silmek istediğinize emin misiniz?')) return;

  try {
    if (imageUrl) await deleteFile(imageUrl);

    const { error } = await supabase
      .from('images')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('Görsel silindi', 'success');
    loadAdminImages();
  } catch (err) {
    console.error('Delete image error:', err);
    showToast('Silme işlemi başarısız', 'error');
  }
}

async function loadAdminImages() {
  const tableBody = document.getElementById('images-table-body');
  if (!tableBody) return;

  const { data, error } = await supabase
    .from('images')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Görseller yüklenemedi', 'error');
    return;
  }

  if (!data || data.length === 0) {
    showEmpty(tableBody.parentElement, 'Henüz görsel eklenmemiş');
    return;
  }

  adminDataCache.images = data;

  tableBody.parentElement.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Önizleme</th>
          <th>Başlık</th>
          <th>Açıklama</th>
          <th>Tarih</th>
          <th>İşlem</th>
        </tr>
      </thead>
      <tbody id="images-table-body"></tbody>
    </table>
  `;

  renderImagesTable(data);
}

/* ====================================================
   NOT YÖNETİMİ
   ==================================================== */

async function addNote(formData) {
  try {
    const { data, error } = await supabase
      .from('notes')
      .insert([{
        title: formData.title,
        content: formData.content
      }])
      .select();

    if (error) throw error;

    showToast('Not başarıyla eklendi!', 'success');
    loadAdminNotes();
    return data;
  } catch (err) {
    console.error('Add note error:', err);
    showToast('Not eklenirken hata oluştu', 'error');
  }
}

async function deleteNote(id) {
  if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return;

  try {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('Not silindi', 'success');
    loadAdminNotes();
  } catch (err) {
    console.error('Delete note error:', err);
    showToast('Silme işlemi başarısız', 'error');
  }
}

async function loadAdminNotes() {
  const tableBody = document.getElementById('notes-table-body');
  if (!tableBody) return;

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Notlar yüklenemedi', 'error');
    return;
  }

  if (!data || data.length === 0) {
    showEmpty(tableBody.parentElement, 'Henüz not eklenmemiş');
    return;
  }

  adminDataCache.notes = data;

  tableBody.parentElement.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Başlık</th>
          <th>İçerik</th>
          <th>Tarih</th>
          <th>İşlem</th>
        </tr>
      </thead>
      <tbody id="notes-table-body"></tbody>
    </table>
  `;

  renderNotesTable(data);
}

/* ====================================================
   DÜZENLEME VE GÖRÜNTÜLEME MANTIĞI
   ==================================================== */

function openEditModal(type, item) {
  const modal = document.getElementById('edit-modal');
  const fieldsContainer = document.getElementById('edit-fields');
  const title = document.getElementById('modal-title');
  const idInput = document.getElementById('edit-id');
  const typeInput = document.getElementById('edit-type');

  idInput.value = item.id;
  typeInput.value = type;
  fieldsContainer.innerHTML = '';

  if (type === 'music') {
    title.textContent = 'Müziği Düzenle';
    fieldsContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">Başlık</label>
                <input class="form-input" type="text" id="edit-music-title" value="${escHtml(item.title)}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Tür</label>
                <input class="form-input" type="text" id="edit-music-genre" value="${escHtml(item.genre || '')}">
            </div>
            <div class="form-group">
                <label class="form-label">BPM</label>
                <input class="form-input" type="number" id="edit-music-bpm" value="${item.bpm || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Yeni Kapak (Opsiyonel)</label>
                <input class="form-input" type="file" id="edit-music-cover" accept="image/*">
                <small style="color:var(--text-muted);font-size:0.7rem;display:block;margin-top:4px">Değiştirmek istemiyorsanız boş bırakın.</small>
            </div>
            <div class="form-group">
                <label class="form-label">Yeni Ses Dosyası (Opsiyonel)</label>
                <input class="form-input" type="file" id="edit-music-audio" accept=".mp3,.m4a,audio/mpeg,audio/mp4">
                <small style="color:var(--text-muted);font-size:0.7rem;display:block;margin-top:4px">Değiştirmek istemiyorsanız boş bırakın.</small>
            </div>
            <input type="hidden" id="old-cover-url" value="${item.cover_url || ''}">
            <input type="hidden" id="old-audio-url" value="${item.audio_url || ''}">
        `;
  } else if (type === 'images') {
    title.textContent = 'Görseli Düzenle';
    fieldsContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">Başlık</label>
                <input class="form-input" type="text" id="edit-image-title" value="${escHtml(item.title)}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Açıklama</label>
                <textarea class="form-textarea" id="edit-image-desc">${escHtml(item.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Yeni Görsel (Opsiyonel)</label>
                <input class="form-input" type="file" id="edit-image-file" accept="image/*">
                <small style="color:var(--text-muted);font-size:0.7rem;display:block;margin-top:4px">Değiştirmek istemiyorsanız boş bırakın.</small>
            </div>
            <input type="hidden" id="old-image-url" value="${item.image_url || ''}">
        `;
  } else if (type === 'notes') {
    title.textContent = 'Notu Düzenle';
    fieldsContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">Başlık</label>
                <input class="form-input" type="text" id="edit-note-title" value="${escHtml(item.title)}" required>
            </div>
            <div class="form-group">
                <label class="form-label">İçerik</label>
                <textarea class="form-textarea" id="edit-note-content" style="min-height:200px;">${escHtml(item.content || '')}</textarea>
            </div>
        `;
  }

  modal.style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

function openViewModal(title, content) {
  const modal = document.getElementById('view-modal');
  document.getElementById('view-modal-title').textContent = title;
  document.getElementById('view-modal-body').innerHTML = `
        <div class="view-content-box">${content}</div>
    `;
  modal.style.display = 'flex';
}

function closeViewModal() {
  document.getElementById('view-modal').style.display = 'none';
}

// Modal dışına tıklayınca kapatma
window.onclick = (event) => {
  const editModal = document.getElementById('edit-modal');
  const viewModal = document.getElementById('view-modal');
  if (event.target == editModal) closeEditModal();
  if (event.target == viewModal) closeViewModal();
}

// ---- Düzenleme Formu Gönderimi ----
document.addEventListener('DOMContentLoaded', () => {
  const editForm = document.getElementById('edit-form');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-id').value;
      const type = document.getElementById('edit-type').value;
      const submitBtn = document.getElementById('edit-submit');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Güncelleniyor...';

      let updateData = {};
      let table = '';

      if (type === 'music') {
        updateData = {
          title: document.getElementById('edit-music-title').value,
          genre: document.getElementById('edit-music-genre').value,
          bpm: parseInt(document.getElementById('edit-music-bpm').value) || null
        };
        table = 'musics';

        // Check for new files
        const newCover = document.getElementById('edit-music-cover').files[0];
        const newAudio = document.getElementById('edit-music-audio').files[0];
        const oldCover = document.getElementById('old-cover-url').value;
        const oldAudio = document.getElementById('old-audio-url').value;

        if (newCover) {
          const coverErr = await validateImageFile(newCover);
          if (coverErr) { showToast(coverErr, 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Değişiklikleri Kaydet'; return; }
          if (oldCover) await deleteFile(oldCover);
          updateData.cover_url = await uploadFile(newCover, 'covers');
        }
        if (newAudio) {
          const audioErr = validateAudioFile(newAudio);
          if (audioErr) { showToast(audioErr, 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Değişiklikleri Kaydet'; return; }
          if (oldAudio) await deleteFile(oldAudio);
          updateData.audio_url = await uploadFile(newAudio, 'music');
        }

      } else if (type === 'images') {
        updateData = {
          title: document.getElementById('edit-image-title').value,
          description: document.getElementById('edit-image-desc').value
        };
        table = 'images';

        const newImg = document.getElementById('edit-image-file').files[0];
        const oldImg = document.getElementById('old-image-url').value;

        if (newImg) {
          const imgErr = await validateImageFile(newImg);
          if (imgErr) { showToast(imgErr, 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Değişiklikleri Kaydet'; return; }
          if (oldImg) await deleteFile(oldImg);
          updateData.image_url = await uploadFile(newImg, 'images');
        }

      } else if (type === 'notes') {
        updateData = {
          title: document.getElementById('edit-note-title').value,
          content: document.getElementById('edit-note-content').value
        };
        table = 'notes';
      }

      try {
        const { error } = await supabase
          .from(table)
          .update(updateData)
          .eq('id', id);

        if (error) throw error;

        showToast('İçerik güncellendi', 'success');
        closeEditModal();

        if (type === 'music') loadAdminMusic();
        if (type === 'images') loadAdminImages();
        if (type === 'notes') loadAdminNotes();

      } catch (err) {
        console.error('Update error:', err);
        showToast('Güncelleme hatası!', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Değişiklikleri Kaydet';
      }
    });
  }
});

// ---- Tablo Filtreleme ----
let adminDataCache = { music: [], images: [], notes: [] };

function filterAdminList(type, query) {
  const tableBody = document.getElementById(`${type === 'music' ? 'music' : type === 'images' ? 'images' : 'notes'}-table-body`);
  if (!tableBody || !adminDataCache[type]) return;

  const filtered = adminDataCache[type].filter(item => {
    const searchText = (item.title || '') + ' ' + (item.genre || '') + ' ' + (item.description || '') + ' ' + (item.content || '');
    return searchText.toLowerCase().includes(query.toLowerCase());
  });

  if (type === 'music') renderMusicTable(filtered);
  if (type === 'images') renderImagesTable(filtered);
  if (type === 'notes') renderNotesTable(filtered);
}

function renderMusicTable(data) {
  const tableBody = document.getElementById('music-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = data.map(track => `
      <tr>
        <td><img src="${track.cover_url || ''}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;"></td>
        <td style="color:var(--text-primary);font-weight:500;">${track.title}</td>
        <td>${track.bpm || '—'}</td>
        <td>${track.genre || '—'}</td>
        <td>${formatDate(track.created_at)}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-secondary btn-small" onclick='openEditModal("music", ${JSON.stringify(track).replace(/'/g, "&apos;")})'>Düzenle</button>
            <button class="btn btn-danger btn-small" onclick="deleteMusic('${track.id}', '${track.cover_url || ''}', '${track.audio_url || ''}')">Sil</button>
          </div>
        </td>
      </tr>
    `).join('');
}

function renderImagesTable(data) {
  const tableBody = document.getElementById('images-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = data.map(img => `
      <tr>
        <td><img src="${img.image_url || ''}" style="width:60px;height:40px;border-radius:4px;object-fit:cover;"></td>
        <td style="color:var(--text-primary);font-weight:500;">${img.title}</td>
        <td onclick="openViewModal('Açıklama', \`${(img.description || '').replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)" style="cursor:pointer;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--accent);">${img.description || '—'}</td>
        <td>${formatDate(img.created_at)}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-secondary btn-small" onclick='openEditModal("images", ${JSON.stringify(img).replace(/'/g, "&apos;")})'>Düzenle</button>
            <button class="btn btn-danger btn-small" onclick="deleteImage('${img.id}', '${img.image_url || ''}')">Sil</button>
          </div>
        </td>
      </tr>
    `).join('');
}

function renderNotesTable(data) {
  const tableBody = document.getElementById('notes-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = data.map(note => `
      <tr>
        <td style="color:var(--text-primary);font-weight:500;">${note.title}</td>
        <td onclick="openViewModal('Not İçeriği', \`${(note.content || '').replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)" style="cursor:pointer;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--accent);">${note.content || '—'}</td>
        <td>${formatDate(note.created_at)}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-secondary btn-small" onclick='openEditModal("notes", ${JSON.stringify(note).replace(/'/g, "&apos;")})'>Düzenle</button>
            <button class="btn btn-danger btn-small" onclick="deleteNote('${note.id}')">Sil</button>
          </div>
        </td>
      </tr>
    `).join('');
}
