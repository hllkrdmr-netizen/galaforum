# Faz 8 — Moderasyon (2026-09-28)

## Uygulananlar

### Moderasyon paneli (`/moderasyon`)

Panele yalnızca moderatör ve yöneticiler girebilir. Dört sekmesi var:

- **Şikâyetler:**
  - Her şikâyet edilen mesaj tek bir kartta toplanır. Kartta şunlar görünür:
    - konu başlığı
    - mesaj metni
    - yazar ve yazarın aktif yaptırımı
    - şikâyet edenler, gerekçeleri ve zamanları
  - Kart üzerindeki işlemler: **Mesajı kaldır** (açılış mesajıysa **Konuyu gizle**), **Şikâyeti reddet**, **Üyeyi incele**.
  - “Açık” ve “Kapananlar” diye iki liste var. Reddedilmiş bir mesaj yeni bir gerekçeyle yeniden şikâyet edilirse tekrar açılır.
- **Üyeler:** Kullanıcı adıyla arama yapılır. Son işlem yapılan üyeler hızlı bağlantı olarak listelenir.
- **Gizlenenler:** Gizlenen konular gerekçe, gizleyen kişi ve zamanla birlikte listelenir. Buradan geri getirilebilir.
- **Kayıt (denetim kaydı):** Her moderasyon işlemi burada tutulur: işlem, hedef, gerekçe, yapan kişi ve zaman. Sayfalama var; kayıtlar silinemez ve değiştirilemez.

### Üye incelemesi (`/moderasyon/uye/<kullanıcı>`)

- Sayılar: mesaj, kaldırılan mesaj, açık şikâyet ve yaptırım.
- Aktif yaptırım gösterilir ve buradan kaldırılabilir.
- Yeni yaptırım uygulanabilir. İki tür var:
  - **Susturma:** Konu açamaz, yanıt yazamaz, buluşma açamaz. Okuyabilir ve beğenebilir.
  - **Yasaklama:** Hiçbir şey yazamaz; beğeni, oy, takip, maç tepkisi, ilk 11, buluşmaya katılım ve şikâyet de kapanır.
  - Süreler: 1 saat, 24 saat, 3 gün, 7 gün, 30 gün ya da süresiz.
  - Gerekçe zorunludur ve üyeye gösterilir.
- Moderatör ve yöneticilere yaptırım uygulanamaz.
- Rol değiştirme yalnızca yöneticilere açıktır: üye, onaylı üye, moderatör, yönetici. Kimse kendi rolünü değiştiremez.
- Yaptırım geçmişi listelenir.

### Konu ve mesajdaki araçlar

- Konu sayfasında moderatörlere kapalı duran bir “Moderasyon” düğmesi görünür. Açıldığında:
  - sabitle / sabitlemeyi kaldır
  - kilitle / kilidi aç
  - taşı (kategori seçerek)
  - gizle (gerekçe zorunlu)
- Mesajın “⋯” menüsünde moderatörlere **Mesajı kaldır** seçeneği çıkar. Gerekçe zorunludur ve işlem birkaç saniye içinde geri alınabilir.

### Üyeye bildirim

Mesaj kaldırıldığında, konu gizlendiğinde, susturma, yasaklama, yaptırım kaldırılması ya da rol değişikliğinde üyeye `moderation` türünde bildirim gider.

- Bildirimler moderatörün adıyla değil, “GalaForum ekibi” olarak gönderilir.
- Bu bildirimler ayarlardan kapatılamaz.

### Susturulan ya da yasaklanan üye

- Konu sayfasında yanıt kutusu yerine, Konu Aç ekranında da uyarı olarak neden ve bitiş zamanı gösterilir.
- Susturma ve yasaklama veritabanı düzeyinde zorunlu tutulur.

### Engelleme (her üye için)

- Profilde **Engelle** düğmesi var.
- Engellenen üyenin mesajları senin için kapanır; “Göster” ile tek tek açılabilir.
- Engellenen üye sana bildirim gönderemez.
- Aranızdaki takipler iki yönde de kalkar.
- Engellediklerin “Takip ettiklerin” sayfasında listelenir ve buradan engel kaldırılabilir.
- Engelleme moderatörlere bildirilmez.

### Daha sekmesi

Moderatörler “Moderasyon paneli” satırını açık şikâyet sayısıyla birlikte görür.

## Güvenlik modeli

- Her yetkili işlem, rolü kontrol eden bir RPC’den geçer ve `moderation_log` tablosuna tek bir satır yazar. Bu RPC’ler `mod_*` adlı ve SECURITY DEFINER olarak çalışıyor.
- İstemcinin `topics` ve `posts` tablolarında doğrudan UPDATE yetkisi kaldırıldı. Eski “staff manage/moderate” politikaları da silindi. Böylece hiçbir değişiklik kayıt dışında kalmaz.
- Gizli konular ve mesajları RLS ile herkesten saklanır: listeler, sayaçlar, arama, profil, takip listesi ve doğrudan bağlantı dahil.
  - Gizli konuya yanıt yazılamaz (tetikleyiciyle engelleniyor).
  - Moderatörler gizli konulara panel üzerinden ulaşır.
- Yaptırımlar `BEFORE INSERT` tetikleyicileriyle uygulanır (`aa_enforce_sanction`). Bu tetikleyiciler 12 tabloya bağlı, dolayısıyla istemci atlatamaz.
- `user_sanctions` tablosuna istemci erişimi yok:
  - Üye kendi durumunu `my_restriction()` ile görür.
  - Moderatör `mod_member()` ile görür.
- Denetim kaydını yalnızca moderatörler okuyabilir. Ekleme, güncelleme ve silme kimseye açık değil.
- Hesap silindiğinde engellemeler silinir. Yaptırımlar ve denetim kaydı hesap sorumluluğu için anonim kayıtla birlikte saklanır.

## Veritabanı

Migration: `supabase/migrations/20260928090000_moderation.sql`. Faz 7 migration’ından sonra uygulanır ve ekleme yapar.

**Yeni tablolar:**

- `moderation_log`
- `user_sanctions`
- `user_blocks`

**Yeni sütunlar:**

- `posts`: `removed_*`
- `topics`: `hidden_*`
- `post_reports`: `status`, `handled_*`, `note`

**Güncellenen fonksiyonlar:** `notify` (engelleme kontrolü eklendi), `notification_default`, `forum_profile`, `my_follows`, `delete_my_account`.

## Doğrulama

- **PostgreSQL 16 (yerel):**
  - Tüm migration’lar sıfır bir veritabanına uygulandı.
  - `scripts/db-check/phase8.sql` beklenen 13 hatayla geçti.
  - Kontrol edilenler:
    - şikâyet kuyruğu; reddetme ve yeniden açma
    - mesaj kaldırma ve geri getirme (yanıt sayacıyla birlikte)
    - açılış mesajı koruması
    - sabitleme, kilitleme, taşıma, gizleme ve geri getirme
    - gizli konunun anonim kullanıcıya ve profile yansımaması
    - gizli konuya yanıt engeli
    - doğrudan UPDATE reddi
    - susturma, yasaklama ve kaldırma
    - personele yaptırım engeli
    - rol yetkisi
    - engelleme: takiplerin kalkması ve bildirimin gitmemesi
    - denetim kaydı ve hesap silme
  - Faz 4–7 kontrolleri yeni tetikleyicilerle yeniden çalıştırıldı; hepsi yalnızca beklenen hataları verdi.
- **Uygulama:**
  - `tests/moderation.test.ts`: 6 test.
  - Moderasyon SQL’inde üretilen her hata kodunun Türkçe karşılığı var mı diye testle kontrol ediliyor.
  - Tip kontrolü, testler ve web/iOS/Android dışa aktarma çalıştırıldı.
  - Web ekran görüntüleri demo verisiyle alındı.
- **Doğrulanmadı:** Gerçek Supabase projesinde RPC yanıt biçimleri ve RLS’in PostgREST üzerinden davranışı.

## Bilinen sınırlamalar

- **Demo modu:**
  - Misafir, her aracı deneyebilsin diye yönetici gibi davranır.
  - Demo şikâyetleri örnek veridir; demoda gönderilen şikâyetler kuyruğa düşmez.
  - Demoda yaptırımlar uygulanmaz.
- **İlk yönetici:** Kurulumda veritabanından elle atanır:
  ```sql
  update public.profiles set role = 'admin' where username = '...';
  ```
- **Otomatik filtre yok:** Küfür filtresi ve hız sınırı henüz yok (maç tepkilerindeki hız sınırı dışında).
- **Maç yönetimi kayıt dışı:** Maç ve maç olayı yönetimi hâlâ doğrudan tablo politikalarıyla yapılıyor (Faz 5) ve denetim kaydına düşmüyor.
- **Kaldırılan mesajlar:** Konudaki numaralandırmada boşluk bırakmadan kaybolur; konuda “kaldırıldı” yer tutucusu gösterilmez.
