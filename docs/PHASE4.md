# Faz 4 — Kimlik doğrulama, profiller ve gerçek arama (2026-09-27)

## Uygulananlar

- **Supabase Auth (e-posta):** kayıt (kullanıcı adı + e-posta + şifre), giriş, e-posta doğrulama ve tekrar gönderme,
  şifre sıfırlama bağlantısı, yeni şifre belirleme, kalıcı oturum (AsyncStorage), çıkış.
  PKCE akışı her platformda kullanılır; e-posta bağlantıları `app/auth-callback.tsx` içinde oturuma çevrilir.
  Yönlendirmeler yalnızca bilinen uygulama içi rotalara yapılır (açık yönlendirme yok).
- **Hesap yönetimi (`/hesap`):** kullanıcı adı değiştirme (benzersizlik ve ayrılmış adlar veritabanında korunur),
  şifre değiştirme, çıkış, **hesabı kalıcı silme** (“SİL” yazarak onay).
- **Hesap silme politikası:** auth kimliği, e-posta, beğeniler, anket oyları, şikâyet ve bahsetme kayıtları silinir;
  tartışma bütünlüğü için mesajlar `silinmis_…` adlı anonim bir kayıt altında kalır ve profil sayfası gizlenir.
  Mesajların da silinmesi istenirse bu politika Faz 8 (moderasyon) ile birlikte genişletilebilir.
- **Profil sayfası (`/uye/[kullanici]`):** kullanıcı adı, rol rozeti, katılım tarihi, konu/mesaj/alınan beğeni sayıları,
  son açılan konular, “Tüm mesajları” bağlantısı. E-posta gibi özel veri döndürülmez.
- **Gerçek arama:** Supabase’te Türkçe kök bulmalı tam metin arama (`to_tsvector('turkish')`) + kısmi kelimeler için
  trigram; sonuçlar veritabanında sıralanır. Filtreler: kategori, üye, tarih (24 saat / 7 gün / 30 gün),
  sıralama (en ilgili / en yeni / en çok yanıt). Sorgu boşken yalnızca üye filtresiyle o üyenin içeriği listelenir.
  Demo modu aynı filtreleri uygular.
- **Arayüz bağlantıları:** “Daha” sekmesinde Profilim / Hesap ayarları / Giriş yap satırları gerçek; konu açma ve
  yanıt alanlarında oturum yoksa “Giriş yap / Üye ol” istemi gösterilir (demo modunda gösterilmez).

## Veritabanı

Yeni migration: `supabase/migrations/20260927200000_auth_profiles_search.sql` (öncekilerden sonra, bir kez).
İçerik: `profiles.deleted_at`, kullanıcı adı koruma tetikleyicisi, kayıt sırasında seçilen kullanıcı adını kullanan
`handle_new_user`, `username_available`, `forum_profile`, `delete_my_account`, `forum_search_topics`,
`forum_search_posts` ve tam metin indeksleri. Tüm fonksiyonlar açık yetkilendirme ile verilir; hesap silme yalnızca
oturum açmış kullanıcıya açıktır.

## Supabase panelinde yapılması gerekenler

1. Authentication → Providers → Email: açık; “Confirm email” açık.
2. Authentication → URL Configuration → Redirect URLs listesine ekle:
   - `galaforum://auth-callback` (iOS/Android)
   - geliştirme web adresin, ör. `http://localhost:8081/auth-callback`
   - yayındaki web alan adın + `/auth-callback`
   - Expo Go ile test ediyorsan `exp://**`
3. Proje kökünde `.env`: `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` (service role anahtarı asla).

## Doğrulama

- `npm run typecheck`, `npm test`, web export ve iOS/Android JS bundle — sonuçlar teslim raporunda.
- Migration’lar (çekirdek + Faz 3 + Diğer Branşlar + Faz 4) PostgreSQL 16 üzerinde Supabase benzeri auth/rol katmanıyla
  (`scripts/db-check/`) iki kez uygulandı; kontroller: meta veriden kullanıcı adı, ayrılmış ad engeli, ad müsaitliği,
  tam metin + kısmi arama, kategori/üye/tarih filtreleri, geçersiz sorgu reddi, anonim hesap silme reddi,
  hesap silme sonrası auth kaydının kaybolması, mesajların anonim kalması, profilin gizlenmesi, adın yeniden
  kullanılabilmesi, silinmiş hesabın geri getirilememesi.
- Canlı bir Supabase projesine karşı uçtan uca e-posta akışı **denenmedi** (proje bilgisi yok).

## Sınırlar

- Apple / Google ile giriş henüz yok; `AuthProvider` buna uygun genişletilebilir yapıda.
- Profil fotoğrafı yükleme Faz 6 (topluluk) ile gelecek.
- Arama sonuçları sayfalanmıyor (en fazla 50 sonuç / tür).
