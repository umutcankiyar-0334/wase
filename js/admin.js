/* ====================================================
   ADMIN.JS — Admin Panel İşlevleri
   ==================================================== */

// ---- Admin Giriş Kontrolü ----
async function checkAdminAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    return session !== null;
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
    return true;
}

// ---- Admin Logout ----
async function adminLogout() {
    await supabase.auth.signOut();
    showToast('Çıkış yapıldı', 'success');
    window.location.reload();
}

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

            // İlgili verileri yükle
            if (target === 'music') loadAdminMusic();
            if (target === 'images') loadAdminImages();
            if (target === 'notes') loadAdminNotes();
        });
    });
}

/* ====================================================
   MÜZİK YÖNETİMİ
   ==================================================== */

async function addMusic(formData) {
    try {
        let coverUrl = '';
        let audioUrl = '';

        // Kapak görseli yükle
        if (formData.coverFile) {
            coverUrl = await uploadFile(formData.coverFile, 'covers');
        }

        // Ses dosyası yükle
        if (formData.audioFile) {
            audioUrl = await uploadFile(formData.audioFile, 'music');
        }

        // Veritabanına ekle
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
        // Storage'dan dosyaları sil
        if (coverUrl) await deleteFile(coverUrl);
        if (audioUrl) await deleteFile(audioUrl);

        // Veritabanından sil
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

    showLoading(tableBody.parentElement);

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

    // Tabloyu yeniden oluştur
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
      <tbody id="music-table-body">
        ${data.map(track => `
          <tr>
            <td>
              <img src="${track.cover_url || ''}" alt="" style="width:40px;height:40px;border-radius:4px;object-fit:cover;background:var(--bg-surface);">
            </td>
            <td style="color:var(--text-primary);font-weight:500;">${track.title}</td>
            <td>${track.bpm || '—'}</td>
            <td>${track.genre || '—'}</td>
            <td>${formatDate(track.created_at)}</td>
            <td>
              <button class="btn btn-danger btn-small" onclick="deleteMusic('${track.id}', '${track.cover_url || ''}', '${track.audio_url || ''}')">
                Sil
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* ====================================================
   GÖRSEL YÖNETİMİ
   ==================================================== */

async function addImage(formData) {
    try {
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

    showLoading(tableBody.parentElement);

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
      <tbody id="images-table-body">
        ${data.map(img => `
          <tr>
            <td>
              <img src="${img.image_url || ''}" alt="" style="width:60px;height:40px;border-radius:4px;object-fit:cover;background:var(--bg-surface);">
            </td>
            <td style="color:var(--text-primary);font-weight:500;">${img.title}</td>
            <td>${img.description || '—'}</td>
            <td>${formatDate(img.created_at)}</td>
            <td>
              <button class="btn btn-danger btn-small" onclick="deleteImage('${img.id}', '${img.image_url || ''}')">
                Sil
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
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

    showLoading(tableBody.parentElement);

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
      <tbody id="notes-table-body">
        ${data.map(note => `
          <tr>
            <td style="color:var(--text-primary);font-weight:500;">${note.title}</td>
            <td>${note.content ? note.content.substring(0, 80) + '...' : '—'}</td>
            <td>${formatDate(note.created_at)}</td>
            <td>
              <button class="btn btn-danger btn-small" onclick="deleteNote('${note.id}')">
                Sil
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
