# Faz 7 — Bildirimler (2026-09-27)

## Uygulananlar

- **Bildirim merkezi (`/bildirimler`):**
  - Bildirimler Bugün / Dün / Bu hafta / Daha önce bölümlerine ayrılıyor.
  - “Tümü | Okunmamış” seçici, “Tümünü okundu say” düğmesi ve “Daha eski bildirimler” ile sayfalama var.
  - Bir bildirime dokununca okundu sayılır ve ilgili ekrana gidilir: konu, maç, buluşma ya da profil.
  - Okunmamış satırlar bordo zemin, sol altın çizgi ve altın nokta ile ayrışıyor.
  - Aynı konuya gelen yanıtlar ve aynı mesaja gelen beğeniler, okunana kadar tek satırda toplanır (“burak_gs ve 2 kişi daha”).
- **Zil:**
  - Ana sayfanın üst çubuğunda okunmamış sayacıyla duruyor.
  - “Daha” sekmesinde “Bildirimler” satırında da sayaç var.
  - Sayaç Supabase realtime ile canlı güncellenir ve uygulama öne gelince yenilenir. Tüm ekranlar tek bir kanalı paylaşır.
- **Bildirim ayarları (`/bildirim-ayarlari`):** Aşağıdaki 9 türün her biri için “Uygulama” ve “Anlık” anahtarları var:
  - yanıt
  - bahsetme
  - alıntı
  - beğeni
  - yeni takipçi
  - takip edilen kategoride yeni konu
  - maç
  - buluşma
  - rozet

  Anlık bildirim yalnızca uygulama içi açıkken gönderilir; bu kural veritabanında da zorunlu tutuluyor. Ayarlar sayfasına Hesap ekranından da ulaşılabiliyor.
- **Bildirim üreten olaylar:** Bunların hepsi veritabanı tetikleyicileriyle oluşuyor; istemci bildirim yazamaz.

| Tür | Kime | Gruplama |
| --- | --- | --- |
| Yanıt | Konu sahibi ve konuyu takip edenler (yazan hariç) | Konu başına, okunana kadar |
| Alıntı | Alıntılanan mesajın sahibi | — |
| Bahsetme | @anılan üye (yalnızca bir kez; mesaj düzenlense de tekrar gelmez) | — |
| Beğeni | Mesaj sahibi (aynı kişinin beğen/geri al/beğen döngüsü sayıyı şişirmez) | Mesaj başına |
| Takip | Takip edilen üye (bir kez) | — |
| Yeni konu | Kategoriyi takip edenler | — |
| Buluşmaya katılım | Düzenleyen | Buluşma başına |
| Buluşma iptali | Katılımcılar | — |
| Maç başladı / gol / maç sonu | Maç bildirimini kapatmamış tüm üyeler | — |
| Rozet | Rozeti kazanan (yeni üyeye hoş geldin rozeti dahil) | — |

- **Öncelik:** Hem alıntılanan hem @anılan üye yalnızca alıntı bildirimini alır. Alıntılanan ya da anılan üye aynı mesaj için ayrıca “yanıt” bildirimi almaz; o türü kapattıysa yanıt olarak alır.
- **Hesap silme:** Bildirimler, ayarlar ve cihaz anahtarları da silinir.

## Anlık bildirim (push) — şu an ne var, ne eksik

Anlık bildirim altyapısı hazır, ancak bildirim henüz telefona ulaşmıyor. Bunun iki nedeni var:

1. **Uygulamada `expo-notifications` paketi yok.** Bu ortamda npm kayıt deposuna erişim kapalı olduğu için paketi ekleyemedim.
   - Ayarlar ekranı bu durumu dürüstçe gösteriyor: “Anlık bildirimler bu sürümde kapalı”.
   - Web’de telefon bildirimi zaten gönderilmiyor.
2. **Gönderen bir sunucu işi (worker) yok.** Veritabanındaki kuyruk hazır, ama onu okuyup Expo’ya gönderecek iş henüz yazılmadı.

Hazır olanlar:

- `push_tokens` tablosu:
  - `register_push_token` ve `unregister_push_token` RPC’leri
  - Anahtar biçimi doğrulanıyor.
  - Bir üyenin en fazla 10 cihazı tutuluyor.
  - Bir anahtar, onu en son kaydeden üyeye aittir.
- Çıkış yaparken bu cihazın anahtarı silinir.
- **Kuyruk (outbox):** Üye o tür için anlık bildirimi açık tuttuysa satır `push_status = 'pending'` olarak yazılır.
  - Gruplanan bildirimlerde yalnızca ilk olay için bir push gönderilir.
- Yalnızca service role çalıştırabilen RPC’ler:
  - `claim_push_batch(limit)`
  - `disable_push_tokens(tokens)`
  - `mark_push_failed(ids)`
  - `prune_notifications()`
- `lib/push.ts`:
  - `PushProvider` arayüzü
  - `enablePushOnThisDevice` ve `disablePushOnThisDevice`
- Bildirime dokununca açılacak adres: `pushHref(data)` (`lib/notifications.ts`).

### Etkinleştirme adımları (kendi bilgisayarında)

1. Paketleri kur:
   ```
   npx expo install expo-notifications expo-device
   ```
2. `lib/pushExpo.ts` dosyasını ekle:
   ```ts
   import * as Device from 'expo-device';
   import * as Notifications from 'expo-notifications';
   import Constants from 'expo-constants';
   import type { PushProvider } from './push';

   export function createExpoPushProvider(): PushProvider {
     return {
       name: 'expo',
       async getStatus() {
         if (!Device.isDevice) return 'unsupported';
         const { status } = await Notifications.getPermissionsAsync();
         return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
       },
       async requestToken() {
         const { status } = await Notifications.requestPermissionsAsync();
         if (status !== 'granted') return null;
         const projectId = Constants.expoConfig?.extra?.eas?.projectId;
         return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
       },
     };
   }
   ```
3. `app/_layout.tsx` içinde, uygulama açılırken bir kez:
   - `setPushProvider(createExpoPushProvider())` çağır.
   - Bildirime dokunulduğunda `Notifications.addNotificationResponseReceivedListener` içinde `router.push(pushHref(response.notification.request.content.data))` çalıştır.
4. Android için FCM, iOS için APNs anahtarlarını EAS’e tanıt. Expo Go ile anlık bildirim test edilemez; geliştirme derlemesi (development build) gerekir.
5. Gönderici işi yaz. Örnek: Supabase Edge Function, `service_role` ile her dakika çalışacak şekilde zamanlanır.
   - `claim_push_batch(100)` çağırılır; dönen her satır için Expo Push API’ye (`https://exp.host/--/api/v2/push/send`) şu mesaj gönderilir:
     - `to`: tokens
     - `title` ve `body`: satırdaki `data` ile `lib/notifications.ts` içindeki metinlerle aynı mantıkla üretilir.
     - `data`: `{ notificationId, kind, topicId, matchId, meetupId, actorUsername }`
   - Yanıtta `DeviceNotRegistered` gelen anahtarlar için `disable_push_tokens` çağırılır; gönderilemeyen satırlar `mark_push_failed` ile işaretlenir.
   - `prune_notifications()` günde bir kez çalıştırılır.

   Bu adımları bu ortamda çalıştırmadım; örnek kod doğrulanmadı.

## Veritabanı

- Migration: `supabase/migrations/20260927230000_notifications.sql`. Faz 6 migration’ından sonra uygulanır ve yalnızca ekleme yapar.
- `notifications`: RLS açık; üye yalnızca kendi satırlarını okur. Yazma, güncelleme ve silme istemciye kapalıdır.
  - Okundu işaretlemek için `mark_notifications_read(ids | null)` kullanılır.
- `notification_settings`: kaydedilmemiş türlerde varsayılanlar geçerli.
  - Uygulama içi: hepsi açık.
  - Anlık: yanıt, alıntı, bahsetme, takip, buluşma ve maç açık; beğeni, yeni konu ve rozet kapalı.
  - Varsayılanlar `lib/notifications.ts` ile aynı; bu eşleşme testle kontrol ediliyor.
- Realtime: `notifications` tablosu `supabase_realtime` yayınına eklendi. İstemci `user_id=eq.<uid>` filtresiyle dinliyor.
- **Ölçek notu:** Maç bildirimleri her üye için bir satır yazıyor. Birkaç bin üyede sorun olmaz; çok daha büyük ölçekte bu dağıtım gönderici işe taşınmalı.

## Doğrulama

- **PostgreSQL 16 (yerel):**
  - Tüm migration’lar sıfır bir veritabanına uygulandı.
  - `scripts/db-check/phase7.sql` beklenen 5 hatayla geçti: doğrudan ekleme reddi, `invalid_group`, `invalid_token`, üyenin `claim_push_batch` çağrısının reddi, `push_tokens` okuma reddi.
  - Kontrol edilenler: gruplama, öncelik, tek seferlik takip bildirimi, ayarlar, okundu durumu, buluşma katılım/iptal, maç başladı/gol/maç sonu (kapatan üyeye gitmiyor), push kuyruğu (okunmuş satırlar atlanıyor, cihazı olmayanlar `skipped`), hesap silme.
  - Faz 4, 5 ve 6 kontrolleri yeni tetikleyicilerle yeniden çalıştırıldı; hepsi yalnızca beklenen hataları verdi.
- **Uygulama:**
  - `tests/notifications.test.ts`: 10 test.
  - Tip kontrolü, testler ve web/iOS/Android dışa aktarma çalıştırıldı.
  - Web ekran görüntüleri demo verisiyle alındı.
- **Doğrulanmadı:**
  - Gerçek bir Supabase projesinde realtime aboneliği ve PostgREST sorguları (sayfalama imleci, `actor` ilişkisi).
  - Gerçek cihazda anlık bildirim.

## Bilinen sınırlamalar

- Demo modunda örnek bildirimler var; demo etkileşimleri (yanıt, beğeni) yeni bildirim üretmiyor.
- Konu bağlantısı konunun başına gidiyor; yanıtın bulunduğu mesaja atlama henüz yok.
- Susturma ve engelleme (belirli üye ya da konu) Faz 8’de, moderasyonla birlikte ele alınacak.
