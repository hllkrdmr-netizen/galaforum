# Faz 6 — Topluluk: profiller, takip, rozetler, buluşmalar (2026-09-27)

## Uygulananlar

- **Profil:** hakkında (280 karakter), şehir, en sevdiği kategori, seviye, rozetler, takipçi sayısı,
  “Takip et” düğmesi. Düzenleme: Hesap → Profil. Seviye, katkıdan hesaplanır
  (puan = mesaj + 2 × alınan beğeni; seviye n için 10·(n−1)² puan) — puan yarışı değil, sade bir gösterge.
- **Takip:** üye (profilde), konu (konu başlığındaki zil), kategori (kategori sayfasında “Takip et”).
  “Daha → Takip ettiklerin” sayfası hepsini listeler. Bildirimler Faz 7’de bu verileri kullanacak.
- **Rozetler (otomatik):** Kurucu Üye (ilk 1000), Yeni Üye, Aktif Taraftar (30 günde 30 mesaj), Tribün Müdavimi
  (3 buluşma ya da Taraftar & Tribün’de 25 mesaj), Taktikçi, Transfer Uzmanı (25 mesaj), Tarihçi (15 mesaj),
  100 Mesaj, 1000 Mesaj. Veritabanı tetikleyicileriyle verilir; istemci rozet yazamaz.
- **Topluluk sekmesi:** yaklaşan buluşmalar, son 30 günün aktif üyeleri, tribün ve buluşma konuşmaları.
- **Buluşmalar:** liste (şehir filtresi), detay (tarih, yer, katılımcılar, harita, “Katılıyorum”), oluşturma
  (isteğe bağlı maç seçimi — başlık ve saat maçtan 3 saat öncesi olarak önerilir; tarih, saat, şehir, nokta,
  adres, konum, kontenjan). Düzenleyen otomatik katılır, ayrılamaz ama iptal edebilir; kontenjan veritabanında
  kilitli satırla kontrol edilir; bir üye aynı anda en fazla 5 yaklaşan buluşma açabilir.
- **Harita:** ek paket gerektirmeyen statik harita önizlemesi (OpenStreetMap karoları) + cihazın harita
  uygulamasında yol tarifi (Apple Haritalar / Android geo / web’de OSM). Konum, “41.0082, 28.9784” ya da harita
  bağlantısı yapıştırılarak girilir.

## Harita sağlayıcısı hakkında

OpenStreetMap karo sunucuları yoğun uygulama trafiği için değildir. Yayına çıkmadan önce anahtarlı bir
sağlayıcıya geçilmeli: `.env` içinde `EXPO_PUBLIC_MAP_TILE_URL` (ör. MapTiler/Mapbox raster karo adresi).
Etkileşimli harita (sürükle, yakınlaştır, konum seç) istenirse `@rnmapbox/maps` veya `react-native-maps`
geliştirme derlemesiyle eklenebilir; `lib/maps.ts` ve `MapPreview` bu geçiş için tek nokta.

## Veritabanı

`supabase/migrations/20260927220000_community.sql`: profil alanları (bio, city, favorite_category_id),
`user_follows`, `topic_follows`, `category_follows`, `badges` (+ tohum), `user_badges`, `meetups`,
`meetup_attendees`; RPC’ler `set_follow`, `my_follows`, `community_profile`, `active_members`, `create_meetup`,
`set_meetup_attendance`, `cancel_meetup`; rozet tetikleyicileri; hesap silmede takip, rozet ve katılım kayıtlarının
silinmesi, açtığı gelecek buluşmaların iptali. Takip edilen konu/kategori listeleri yalnızca sahibine görünür.

Doğrulama: `scripts/db-check/phase6.sql` (PostgreSQL 16 + Supabase benzeri katman) — kendini takip reddi,
geçersiz tür, anonim yazma reddi, geçmiş tarih, yarım koordinat, kontenjan dolu, düzenleyenin ayrılamaması,
başkasının buluşmasını iptal reddi, doğrudan tablo yazma reddi, 25 mesajda Taktikçi rozeti, hesap silme temizliği.

## Sınırlar

- Profil fotoğrafı yükleme henüz yok (Supabase Storage ile eklenecek).
- Buluşmalar için mesajlaşma/yorum yok; tartışma “Maç Öncesi Buluşmalar” kategorisinde yapılır.
- Takip bildirimleri Faz 7.
