# Faz 5 — Maç merkezi, canlı maç odası, ilk 11 kurucu (2026-09-27)

## Uygulananlar

- **Maç sekmesi (maç merkezi):** canlı maç bandı (CANLI · dakika · skor), sıradaki maç kartı (rakip, tarih, saat,
  stat, saniye saniye geri sayım, “Maç Detayı” ve “Tartışmaya Katıl”), İlk 11 kurucu kısayolu, yaklaşan maçlar,
  son sonuçlar ve Maç & Taktik tartışmaları.
- **Canlı maç odası (`/mac/[id]`):** skor tabelası, maç durumu (başlamadı / canlı dakika / devre arası / maç sonu),
  önemli anlar akışı (gol, kart, değişiklik, VAR…), maç öncesi geri sayım, canlı tepkiler (Gol! / Alkış / Heyecan /
  Üzgün — 3 saniyede bir, yalnızca maç sırasında), maç konusunun son 20 yorumu, anket, yanıt yazma.
  Forum kimliği korunur: oda, otomatik oluşturulan maç konusudur; kontrolsüz bir sohbet odası değildir.
- **Otomatik maç konusu:** her yeni maç için “<Ev> – <Deplasman> | Canlı Maç Konusu” başlıklı konu Maç & Taktik
  kategorisinde veritabanı tetikleyicisiyle açılır.
- **İlk 11 kurucu (`/ilk-11`):** 4-2-3-1, 4-3-3, 3-4-3, 4-4-2; oyuncuyu sahaya sürükle-bırak (sahadaki iki oyuncu
  arasında sürükleyince yer değiştirir) ya da erişilebilir yol olarak önce pozisyona sonra oyuncuya dokun;
  diziliş değişince ortak pozisyonlar korunur; kaydet; maç konusuna (yoksa yeni konu olarak) paylaş.
  Resmi kadro listesi `squad_players` tablosundan gelir; boşsa oyuncular elle eklenir.
- **Realtime (seçici):** yalnızca ilgili maç satırı, o maçın olayları ve maç konusuna gelen yeni mesajlar dinlenir;
  bağlantı koparsa 45 sn’de bir hafif yenileme yapılır.

## Veritabanı

`supabase/migrations/20260927210000_match_center.sql`: `matches`, `match_events`, `match_reactions`,
`squad_players`, `lineups`; maç konusu tetikleyicisi; `match_react`, `match_reaction_counts`; hesap silmede tepki
ve ilk 11 kayıtlarının da silinmesi; Supabase’te `supabase_realtime` yayınına `matches`, `match_events`, `posts`
eklenir (düz PostgreSQL’de atlanır).

Yetki: maç, olay ve kadro yalnızca moderatör/yönetici (veya service role ile çalışan bir sunucu işi) tarafından
yazılır; üyeler okur, tepki verir, kendi ilk 11’ini kaydeder/siler. Tepkilerde kimin ne verdiği dışarı açılmaz.

## Canlı veri kaynağı

Skor ve dakikayı güncelleyen harici bir sağlayıcı (API) bağlanmadı. Şimdilik yönetici paneli/SQL ya da ileride
bir Supabase Edge Function (service role, sunucuda) ile `matches` ve `match_events` güncellenir. İstemci bu
tabloları yalnızca okur. Demo modunda fikstür örnektir ve “Demo fikstür” olarak etiketlenir.

## Doğrulama

- Migration’lar (çekirdek → Faz 5) PostgreSQL 16 + Supabase benzeri auth katmanında iki kez uygulandı.
  Kontroller `scripts/db-check/phase5.sql`: üye maç ekleyemez, moderatör ekler ve maç konusu otomatik açılır,
  skor güncellemesi `updated_at`’i değiştirir, tepki sayımı, 3 sn sınırı, geçersiz tepki, maç canlı değilken tepki reddi,
  üye skor değiştiremez, başkası adına ilk 11 kaydedilemez, geçersiz diziliş reddi, anonim okuma, anonim tepki reddi,
  hesap silinince tepki ve ilk 11 kayıtlarının silinmesi.

## Sınırlar

- Harici canlı skor API’si yok (yukarıya bak).
- Oyuncu fotoğrafı/numara gösterimi yok; kadro yalnızca isim listesi.
- Maç sonrası oyuncu puanlama ve “maçın adamı” oylaması sonraki bir faza bırakıldı.
