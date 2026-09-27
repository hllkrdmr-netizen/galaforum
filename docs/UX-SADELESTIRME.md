# Sadeleştirme analizi — 2026-09-27

> **Durum:** 9 maddenin tamamı `ux/sadelestirme` dalında uygulandı (bkz. en alttaki “Uygulama notları”).

Kapsam: Faz 5 sonrası tüm ana ekranlar, 390 px mobil ve 1440 px masaüstü web ekran görüntüleri üzerinden
(demo verisiyle). Amaç: daha az görsel gürültü, daha net hiyerarşi, daha kısa kaydırma — marka yönünü
(koyu bordo/altın, aslan hero, forum-önce yapı) değiştirmeden.

## Genel teşhis

1. **Her bölümde çift başlık.** Neredeyse her bölüm “— ÜST ETİKET” + büyük H1 başlık ile açılıyor
   (ör. “SON MESAJ / Forumda en son”, “FORUM / Kategoriler”, “GÜNDEM / Şu an konuşulanlar”). Aynı bilgiyi iki kez
   söylüyor ve dikeyde ~70 px yer kaplıyor.
2. **Her şey kutu içinde.** Bölümlerin çoğu çerçeveli yüzey (kart) içinde; kartların içinde de çerçeveli
   parçalar var (ör. ilk mesaj kutusu, durum etiketi kutusu, ilk 11 kısayolu). Tasarım yönergesi “her şeyi karta
   sarma” diyor.
3. **Satır başına çok fazla meta veri.** Konu satırında 1 rozet + başlık + (kategori · yazar · zaman) + (yanıt ·
   görüntülenme · “Son: kullanıcı · zaman”) — yani başlığın etrafında 3 satır bilgi.
4. **Rozet enflasyonu.** “Popüler” rozeti gündemdeki hemen her konuda; ayrıca “Yakında”, “Demo”, “Sabit”,
   “Onaylı Üye”, kategori hapları. Rozetler ayırt edici olmaktan çıkmış.
5. **Altın rengi fazla dağılmış.** Üst etiketler, çizgiler, “Son: kullanıcı” adları, bağlantılar, rakamlar altın.
   Altın; birincil eylem, aktif durum ve Galatasaray vurgusu için saklanmalı.
6. **Ana sayfada öncelik sırası ters.** “Gündem” sekmesinin ana içeriği (şu an konuşulanlar) 12 kategorinin
   altında, sayfanın en sonunda kalıyor.
7. **Gelecek özellik listeleri ana ekranlarda.** Transfer, Topluluk (ve önceki Maç) ekranlarındaki “Yakında / Bu
   alanda neler olacak” listeleri kullanıcıya değer katmıyor, kaydırmayı uzatıyor.

## Ekran ekran öneriler

### Ana sayfa (Gündem)
- Hero’yu kısalt: açıklama metnini tek satıra indir (“Galatasaray taraftarının tartışma adresi.”), istatistik
  satırını (18 konu · 38 mesaj · 8 aktif üye) kaldır ya da çok küçült. “Kategoriler” ikincil butonu gereksiz
  (hemen aşağıda zaten var) → yalnızca **Konu Aç** kalsın.
- Sıra: **Hero → Gündem (ilk 5 konu) → Kategoriler**. “Son Mesaj” kartını Gündem listesinin üstünde tek satırlık
  “Son mesaj: kullanıcı · konu · 2 dk” şeridine dönüştür.
- Kategorileri kompaktlaştır: mobilde açıklama gizli, satır = ikon + ad + “6 konu · 2 dk önce”. Satır yüksekliği
  ~110 → ~64 px; 12 kategori ~1300 → ~770 px.

### Konu satırı (tüm listeler)
- 2 satıra indir: **Başlık** / “Kategori · 12 yanıt · 2 dk önce”. Görüntülenme ve “Son: kullanıcı” detay sayfasına.
- “Popüler” rozeti yerine başlık yanında küçük alev ikonu ve yalnızca gerçekten öne çıkan 1–2 konuda.
- Avatar boyutu 40 → 32.

### Konu detayı
- Mesaj eylemlerini tek satır ikon dizisine çevir: ♥ sayı · alıntı · “⋯” (Bildir bu menüde). Şu an “Bildir” ayrı
  satıra düşüyor ve fazla görünür.
- Tarihi tekle: “dün · 26 Eyl 2026, 16:23” yerine yalnızca “dün 16:23”.
- İlk mesajın altın çerçeveli kutusunu kaldır; ince bir ayraç ve biraz daha büyük yazı yeterli.
- Tek sayfalık konularda “Önceki sayfa / Sayfa 1 / Sonraki sayfa” satırını gizle.

### Maç sekmesi
- Başlık bloğunu küçült: 3 satırlık açıklamayı kaldır (sekme adı zaten “Maç”).
- Geri sayımda maça 1 günden fazla varken saniyeyi gösterme (sürekli hareket dikkat dağıtıyor).
- “Son tartışmalar” listesinden “Canlı Maç Konusu” başlıklı konuları çıkar; bunlara maç kartlarından zaten
  ulaşılıyor (şu an fikstürü ikinci kez gösteriyor).
- İlk 11 kısayolunu kart yerine sıradaki maç kartının içinde üçüncü, metin tipinde bir bağlantı yap.

### Canlı maç odası
- Tepkileri tek satırlık kompakt ikon düğmelerine indir (şu an 2 satıra taşıyor).
- “İlk 11’ini kur” ve “Tüm konuyu aç” düğmelerini skor tabelası ile akış arasından kaldır: “Tüm konuyu aç”
  başlık çubuğunda ikon, İlk 11 yalnızca maç öncesinde.
- Mobilde **“Akış | Yorumlar”** sekmeli görünüm: kullanıcı ikisini alt alta kaydırmak zorunda kalmasın.

### Transfer ve Topluluk
- “Yakında” listelerini kaldır (yol haritası `docs/ROADMAP.md`’de).
- Başlıktaki iki düğmeden birini bırak (Konu Aç); “… kategorisi” düğmesi liste altındaki “Tümü” bağlantısına.
- Transfer durum etiketi açıklama kutusunu varsayılan olarak kapalı, “ⓘ Etiketler ne anlama geliyor?” ile açılır yap.

### Arama
- 3 sıra filtre çipi (sıralama, tarih, kategori) sonuçlardan önce ekranın yarısını kaplıyor. Tek **Filtrele**
  düğmesi + alttan açılan panel; seçili filtreler arama kutusunun altında kaldırılabilir çipler olarak görünsün.

### Konu Aç
- 12 kategori hapı başlıktan önce tüm ekranı kaplıyor. Sıra: **Başlık → Mesaj → Kategori (tek satır seçici /
  açılır liste) → Anket (kapalı)**. Kategori, kategori sayfasından gelindiyse zaten seçili.

### Daha
- İyi durumda. “Tüm kategoriler” ızgarası ana sayfadaki kompakt listeyle aynı bileşeni kullanmalı.

## Tasarım sistemi düzeyinde değişiklikler

| Değişiklik | Neden |
| --- | --- |
| Bölüm başlığı: üst etiket **veya** başlık; başlık boyutu H1 (30) → H2 (20) | Çift başlık ve dikey boşluk israfı |
| `Card` yerine varsayılan olarak ayraçlı liste; kart yalnızca hero, maç tabelası, ilk mesaj dışı özel durumlar | “Her şey kutuda” görünümü |
| Altın: birincil düğme, aktif sekme/çip, Galatasaray adı, canlı skor. Kullanıcı adları ve meta bilgiler nötr | Vurgu enflasyonu |
| Rozetler: aynı satırda en fazla 1; “Popüler” yerine ikon | Rozet gürültüsü |
| Tek meta satırı kuralı: liste öğesinde başlık + 1 meta satır | Okunabilirlik |

## Önerilen uygulama sırası

**Önce (yüksek etki, düşük risk):**
1. Konu satırını 2 satıra indir ve “Popüler” rozetini ikona çevir.
2. Bölüm başlıklarını tekle ve küçült.
3. Ana sayfa sırası: Gündem kategorilerin üstüne; hero’dan istatistik ve ikinci düğmeyi kaldır.
4. Transfer/Topluluk’tan “Yakında” listelerini kaldır.
5. Konu detayında mesaj eylemlerini ikon satırına çevir, Bildir “⋯” menüsüne.

**Sonra:**
6. Arama filtrelerini tek “Filtrele” paneline taşı.
7. Konu Aç formunda kategori seçiciyi kompaktlaştır ve sırayı değiştir.
8. Canlı maç odasında “Akış | Yorumlar” sekmeleri ve kompakt tepkiler.
9. Kategori listesini kompaktlaştır; Daha’daki ızgarayla birleştir.

Tahmini etki (mobil, demo verisi): ana sayfa toplam kaydırma ~4.300 px → ~2.600 px; konu listesinde ekrana sığan
konu sayısı ~4 → ~7.

Not: `features/forum/Interactions.tsx`, `PostItem.tsx` ve `TabBar.tsx` senin Faz 3 / dock değişikliklerini içerdiği
için bu dosyalara dokunan maddeler (5 ve 8) onayınla yapılmalı.

## Uygulama notları

| # | Madde | Uygulama |
| --- | --- | --- |
| 1 | Konu satırı | Başlık + tek meta satırı (kategori/yazar · yanıt · son aktivite); sabit/kilitli/popüler küçük ikon; avatar 32 px; “Popüler” eşiği 5 yanıt veya 3.000 görüntülenme |
| 2 | Bölüm başlıkları | `SectionHeader` tek satır: altın çizgi + H2 başlık; üst etiket artık gösterilmiyor |
| 3 | Ana sayfa | Hero: kısa slogan, tek “Konu Aç” düğmesi, istatistik satırı yok. Sıra: Son mesaj şeridi → Şu an konuşulanlar (5) → Kategoriler |
| 4 | Yakında listeleri | Transfer ve Topluluk’tan kaldırıldı; başlıkta tek “Konu Aç”, liste başlığında “Tümü”; transfer etiket açıklaması katlanır |
| 5 | Mesaj eylemleri | Kalp + sayı, alıntı ikonu, “⋯” menüsünde Bildir; tek zaman etiketi (“dün 16:23”); ilk mesaj çerçevesiz, biraz büyük yazı; tek sayfalı konuda sayfalama gizli; yazar ve @bahsetme profile gider |
| 6 | Arama | “Filtrele” düğmesi + açılır panel; etkin filtreler kaldırılabilir çipler |
| 7 | Konu Aç | Başlık → Mesaj → Kategori (seçili kategori tek çip, “Değiştir” ile liste) → Anket |
| 8 | Canlı maç odası | Tepkiler tek satır; “Tüm konuyu aç” başlıkta ikon; İlk 11 yalnızca maç öncesi; dar ekranda “Akış / Yorumlar” sekmeleri |
| 9 | Kategoriler | Mobilde ikon + ad + “N konu · zaman”; geniş ekranda açıklama ve son konu; Daha’da aynı sade satır |
| + | Maç merkezi | Açıklama ve kutu başlık kaldırıldı; 1 günden uzak maçta saniye yok; maç konuları taktik listesinden çıkarıldı; İlk 11 bağlantısı maç kartında |
