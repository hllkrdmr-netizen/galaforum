# GalaForum 1.0 — Yayın hazırlığı (Faz 9, 2026-09-28)

Bu belge yayına kadar yapılacakları, mağaza bilgilerini ve test planını tek yerde toplar. “✅” olanlar
depoda yapılmış ve doğrulanmıştır. “☐” olanlar senin (ya da işletenin) yapması gereken adımlardır;
bunlar bu ortamdan yapılamaz.

## 1. Durum

| Alan | Durum |
| --- | --- |
| Forum (kategoriler, konu, yanıt, alıntı, beğeni, @bahsetme, anket, arama) | ✅ Faz 1–4 |
| Üyelik (e-posta, doğrulama, şifre sıfırlama, profil, hesap silme) | ✅ Faz 4 |
| Maç merkezi, canlı oda, ilk 11 | ✅ Faz 5 |
| Topluluk (takip, rozet, buluşma, harita önizleme) | ✅ Faz 6 |
| Bildirim kutusu ve tercihleri | ✅ Faz 7 — telefona anlık bildirim ☐ (aşağıda) |
| Moderasyon (şikâyet, yaptırım, rol, kayıt, engelleme) | ✅ Faz 8 |
| Hata ekranı, hukuki sayfalar, kayıtta onay, yayın kontrolleri | ✅ Faz 9 |

## 2. Yayından önce zorunlu adımlar

### Supabase (üretim projesi)

1. ☐ Migration’ları `supabase/migrations` içindeki sırayla uygula (`supabase db push` ya da SQL editörü).
2. ☐ `scripts/db-check/release.sql` dosyasını SQL editöründe çalıştır. Çıktıda “release checks passed” görmelisin.
   Bu betik şunları doğrular:
   - her tabloda RLS açık,
   - yalnızca beklenen yazma politikaları var,
   - SECURITY DEFINER fonksiyonlar sabit `search_path` kullanıyor,
   - anonim kullanıcılar yalnızca okuma fonksiyonlarını çağırabiliyor,
   - iç fonksiyonlar kapalı,
   - rol sütunu korunuyor,
   - kategori ve rozet verileri yüklenmiş.
3. ☐ **Authentication → URL Configuration:**
   - Site URL = web adresi.
   - Redirect URLs listesine şunları ekle: `galaforum://auth-callback` ve `https://<web-adresi>/auth-callback`.
4. ☐ **Authentication → E-posta:**
   - “Confirm email” açık olmalı.
   - Kendi SMTP’ni tanımla (varsayılan servis saatte birkaç e-postayla sınırlıdır).
   - Şablonlar Türkçe olmalı.
5. ☐ İlk yöneticiyi ata: `update public.profiles set role = 'admin' where username = '<kullanıcı>';`
6. ☐ **Database → Replication:** `supabase_realtime` yayınında `matches`, `match_events`, `posts` ve `notifications` tabloları olmalı. Migration bunları ekler; burada yalnızca kontrol et.
7. ☐ Günlük temizlik: `pg_cron` ile `select public.prune_notifications();` sorgusunu günde bir kez çalıştır.
8. ☐ Yedekleme (Point-in-Time Recovery) ve bir staging projesi.

### Ortam değişkenleri (.env ve EAS)

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | ☐ evet | Proje adresi |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ☐ evet | Yalnızca anon anahtar. **Service role anahtarı asla istemciye girmez.** |
| `EXPO_PUBLIC_OPERATOR_NAME` | ☐ evet | KVKK veri sorumlusu (kişi ya da şirket adı) |
| `EXPO_PUBLIC_CONTACT_EMAIL` | ☐ evet | İtiraz, KVKK başvurusu ve destek adresi |
| `EXPO_PUBLIC_MAP_TILE_URL` | ☐ önerilir | Anahtarlı harita karo adresi. OSM’nin kendi sunucusu uygulama trafiği için uygun değil (Faz 6). |

EAS derlemelerinde bu değerleri `eas env:create` ile ya da expo.dev → Environment variables üzerinden tanımla.

### Hukuk ve moderasyon

- ☐ `lib/legal.ts` içindeki üç metni bir hukukçuya okut: topluluk kuralları, kullanım koşulları, gizlilik/KVKK.
  - Metinler uygulamanın gerçekte ne yaptığını anlatıyor, ancak yaş sınırı, uygulanacak hukuk ve yurt dışına aktarım ifadeleri onay ister.
  - Metin değişirse `LEGAL_VERSION` değerini güncelle. Kayıt sırasında onaylanan sürüm, kullanıcının auth kaydında `terms_version` olarak saklanır.
- ☐ VERBİS kaydı gerekip gerekmediğini değerlendir.
- ☐ **Şikâyetler 24 saat içinde yanıtlanmalı.** Apple 1.2 kullanıcı içeriği (UGC) kuralı bunu ister. Kurallar sayfası da bu süreyi taahhüt ediyor, bu yüzden en az bir aktif moderatör gerekli.
- ☐ **Marka:** Uygulama adı, açıklaması ve ekran görüntüleri resmî kulüp izlenimi vermemeli.
  - Kulüp logosu ya da armasını kullanma; uygulamadaki aslan özgün bir görsel.
  - Uygulamada ve mağaza açıklamasında “bağımsız taraftar platformu” ibaresi var.
  - Apple 5.2 (fikri mülkiyet) incelemesinde isim sorun çıkarırsa alternatif bir ad hazır tut.

### Anlık bildirim (isteğe bağlı, 1.0 için şart değil)

- ☐ `npx expo install expo-notifications expo-device`
- ☐ `docs/PHASE7.md` içindeki `createExpoPushProvider` adımlarını uygula.
- ☐ APNs ve FCM anahtarlarını EAS’e ekle.
- ☐ Gönderici Edge Function’ı yaz ve her dakika çalışacak şekilde zamanla.

Bunlar yapılmadan uygulama içi bildirimler yine çalışır; ayarlar ekranı anlık bildirimin kapalı olduğunu açıkça söyler.

### Derleme ve mağaza

```bash
npm install -g eas-cli && eas login
eas build:configure                         # proje kimliğini app.json'a ekler
eas build --profile preview --platform all  # iç test: iOS ad-hoc, Android APK
eas build --profile production --platform all
eas submit --profile production --platform ios|android
```

- Sürüm bilgileri:
  - `app.json` sürümü `1.0.0`.
  - iOS `buildNumber` 1, Android `versionCode` 1.
  - Her yeni mağaza yüklemesinde bu iki sayıyı artır.
- `ios.config.usesNonExemptEncryption: false`: uygulama yalnızca HTTPS kullanıyor, bu yüzden şifreleme beyanı “hayır”.
- Görseller:
  - `icon.png` 1024×1024, `adaptive-icon.png` 1024×1024.
  - Açılış görseli koyu arka plan üzerinde aslan.

**App Store “App Privacy” / Google Play “Data safety” yanıtları (öneri):**

- **Toplananlar:** e-posta adresi, kullanıcı kimliği, kullanıcı içeriği (mesajlar ve diğer içerik); anlık bildirim açılırsa cihaz anahtarı. Hepsi kullanıcıya bağlı ve yalnızca uygulamanın çalışması için.
- **İzleme (tracking):** yok. Reklam yok, analiz SDK’sı yok.
- **Aktarım:** şifreli (HTTPS).
- **Silme:** Uygulama içinden yapılabiliyor (Hesap → Hesabı sil).
- **Yaş derecelendirmesi:** Kullanıcı içeriği ve sohbet olduğu için iOS’ta 12+, Google Play’de “Teen” önerilir.

**Mağaza metni (taslak):**

> **GalaForum — Daima Galatasaray**
> Galatasaray taraftarlarının derinlemesine tartıştığı bağımsız forum. Maç & Taktik’ten Transfer’e, Avrupa
> gecelerinden Galatasaray Tarihi’ne 12 kategoride konu aç, yanıtla, alıntıla ve anket kur. Canlı maç odasında
> skoru, olayları ve tribünün nabzını takip et; ilk 11’ini kur ve paylaş. Şehrindeki maç buluşmalarına katıl,
> ortak yolculuk organize et. Yanıtlar, bahsetmeler ve maç uyarıları için bildirimleri istediğin gibi ayarla.
> Saygılı, kaynaklı ve moderasyonlu bir tartışma ortamı.
> GalaForum bağımsız bir taraftar platformudur; Galatasaray Spor Kulübü’nün resmî uygulaması değildir.

Anahtar kelimeler: galatasaray, forum, taraftar, maç, transfer, süper lig, cimbom, tribün.

## 3. Otomatik kontroller (her sürümden önce)

```bash
npm run typecheck                    # uygulama + testler (TypeScript strict)
npm test                             # birim testleri
# Veritabanı (yerel PostgreSQL 16):
psql -f scripts/db-check/supabase-shim.sql
# ardından migration'lar sırayla, sonra:
psql -f scripts/db-check/phase4.sql … phase8.sql
psql -f scripts/db-check/release.sql
# Web duman testi (demo modu):
npx expo export -p web --output-dir dist/web-qa
python scripts/qa/web_smoke.py dist/web-qa --shots dist/qa-shots
```

`web_smoke.py` 28 rotayı telefon (390 px) ve masaüstü (1440 px) genişliğinde gezer. Test başarısız sayılır, eğer:

- konsolda hata ya da yakalanmamış istisna varsa,
- sayfa yatay taşıyorsa,
- adı olmayan bir düğme veya bağlantı varsa,
- beklenen metin ekranda yoksa.

Ardından şu akışları çalıştırır: konu açma, beğeni, “tümünü okundu say”, şikâyet reddi ve denetim kaydı, engelleme, kayıt onayı kutusu.

## 4. Gerçek cihazda manuel test planı

Staging Supabase projesiyle, iOS’ta ve Android’de ayrı ayrı yapılmalı.

1. **Üyelik:**
   - Kayıt: onay kutusu işaretlenmeden devam edilemiyor mu?
   - Doğrulama e-postasındaki bağlantı uygulamayı açıyor mu?
   - Giriş, çıkış ve şifre sıfırlama e-postası çalışıyor mu?
   - Kullanıcı adı değişikliği ve hesap silme: silinen hesabın mesajları “silinmiş üye” olarak kalıyor mu?
2. **Forum:**
   - Konu açma (anketli ve anketsiz), yanıt, alıntı, @bahsetme, beğeni, şikâyet.
   - 20’den fazla yanıtta sayfalama.
   - Arama filtreleri.
   - Kilitli konuya yanıt yazılamıyor mu?
3. **Maç:**
   - Moderatör hesabıyla maç ekle: otomatik maç konusu açılıyor mu?
   - Maçı “canlı” yap: bildirim ve canlı skor güncelleniyor mu (realtime)?
   - Gol olayı ekle, tepki ver (3 saniye sınırı), ilk 11 kur ve paylaş.
4. **Topluluk:** Takip et / bırak, buluşma aç, katıl, kontenjan dolunca katılım kapanıyor mu, iptal, haritada aç.
5. **Bildirimler:**
   - Yanıt, bahsetme, beğeni ve takip ikinci bir hesaptan geliyor mu? Zil sayacı canlı güncelleniyor mu?
   - Ayarlardan kapatılan türler artık gelmiyor mu?
6. **Moderasyon:**
   - Şikâyet → mesajı kaldır: yazara bildirim gidiyor mu?
   - Konuyu gizle ve geri getir.
   - Susturma: yanıt kutusu yerine uyarı çıkıyor mu?
   - Yasaklama: beğeni de engelleniyor mu?
   - Yaptırımı kaldır, rol değiştir (yönetici).
   - Engelleme: mesajlar gizleniyor mu, bildirim gelmiyor mu?
7. **Genel:**
   - Uçak modunda hata ekranları ve “Tekrar dene” düğmeleri.
   - Ekran okuyucu (VoiceOver/TalkBack) ile ana akışlar.
   - Büyük yazı boyutu.
   - Tablet ve yatay ekran.

## 5. Bilinen sınırlamalar (1.0 sonrası)

- **Anlık bildirim:** Göndermek için paket ve gönderici iş gerekiyor (bölüm 2).
- **Hata raporlama:** Çökme ve hata raporlama servisi (ör. Sentry) yok. Uygulamada Türkçe bir hata ekranı var ama hatalar merkezi olarak toplanmıyor.
- **Eksik geliştirme araçları:** ESLint ve TanStack Query, bu projenin kurulduğu ortamda paket deposu kapalı olduğu için eklenmedi. `hooks/useForumQuery` aynı işi gören küçük bir karşılık.
- **Arama:** Tür başına en fazla 50 sonuç gösteriyor, sayfalama yok.
- **Konu bağlantıları:** Bir mesaja doğrudan atlanamıyor.
- **Otomatik küfür filtresi yok.**
- **Maç yönetimi:** Maç ekleme ve güncelleme denetim kaydına düşmüyor.
- **Web paketi:**
  - Web çıktısı yaklaşık 6.9 MB (ikon fontları dahil; yalnızca kullanılanlar indirilir).
  - Ana JS dosyası 2.3 MB ve sıkıştırılmamış.
  - Aslan görseli web’de WebP (0.5 MB), uygulamada PNG olarak yükleniyor.
