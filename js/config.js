/* ====================================================
   SUPABASE CONFIG — Underground Vibe
   ==================================================== */

// ⚠️ BU DEĞERLERİ KENDİ SUPABASE PROJENİZİN BİLGİLERİYLE DEĞİŞTİRİN
const SUPABASE_URL = 'https://aerzinjuyprgalofsnyo.supabase.co';       // Örn: https://xyzcompany.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlcnppbmp1eXByZ2Fsb2ZzbnlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODExODksImV4cCI6MjA4Njg1NzE4OX0.FeuDSKwCzVrBTvlXbvPaG2-_7gFE6VcJsEopiIfde54'; // Örn: eyJhbGciOiJIUz...

// Supabase Client oluştur
// NOT: CDN 'window.supabase' olarak SDK'yı yükler, 'const' kullanırsak çakışır.
// Bu yüzden 'var' kullanıyoruz — hoisting sırasında mevcut window.supabase korunur.
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Storage bucket adı
const STORAGE_BUCKET = 'uploads';

/* ====================================================
   YARDIMCI FONKSİYONLAR
   ==================================================== */

/**
 * Dosyayı Supabase Storage'a yükler
 * @param {File} file — Yüklenecek dosya
 * @param {string} folder — Storage içindeki klasör (music, images, covers)
 * @returns {Promise<string>} — Public URL
 */
async function uploadFile(file, folder = '') {
  const fileExt = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Upload error:', error);
    throw error;
  }

  // Public URL al
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Dosyayı Supabase Storage'dan siler
 * @param {string} publicUrl — Dosyanın public URL'i
 */
async function deleteFile(publicUrl) {
  // URL'den dosya yolunu çıkar
  const path = publicUrl.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`)[1];
  if (!path) return;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path]);

  if (error) {
    console.error('Delete file error:', error);
  }
}

/**
 * Tarihi formatlar
 * @param {string} dateString — ISO tarih stringi
 * @returns {string} — Formatlanmış tarih
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('tr-TR', options);
}

/**
 * Toast (bildirim) gösterir
 * @param {string} message — Mesaj
 * @param {string} type — 'success' veya 'error'
 */
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Loading spinner gösterir
 * @param {HTMLElement} container — Spinner'ın gösterileceği element
 */
function showLoading(container) {
  container.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
    </div>
  `;
}

/**
 * Boş durum mesajı gösterir
 * @param {HTMLElement} container — Mesajın gösterileceği element
 * @param {string} message — Mesaj
 */
function showEmpty(container, message = 'Henüz içerik yok') {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">∅</div>
      <div class="empty-state-text">${message}</div>
    </div>
  `;
}

/**
 * Genel içerik görüntüleme modalını açar
 * @param {string} title — Modal başlığı
 * @param {string} content — Modal içeriği
 */
function openViewModal(title, content) {
  const modal = document.getElementById('view-modal');
  const titleEl = document.getElementById('view-modal-title');
  const bodyEl = document.getElementById('view-modal-body');

  if (modal && titleEl && bodyEl) {
    titleEl.textContent = title;
    bodyEl.innerHTML = `<div class="view-content-box">${content}</div>`;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  } else {
    console.error('View modal elements not found');
    // Fallback for missing modal
    alert(title + "\n\n" + content);
  }
}

/**
 * Genel içerik görüntüleme modalını kapatır
 */
function closeViewModal() {
  const modal = document.getElementById('view-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}
