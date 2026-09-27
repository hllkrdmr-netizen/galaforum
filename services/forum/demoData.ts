import type { AuthorSummary } from '../../types/forum';

/**
 * Demo seed used when no Supabase project is configured (EXPO_PUBLIC_SUPABASE_URL missing).
 * All members and discussions are fictional sample content, clearly labelled as demo in the UI.
 * Times are expressed as "minutes ago" so the forum feels alive relative to the current clock.
 */

export interface DemoTopicSeed {
  id: string;
  categorySlug: string;
  title: string;
  authorId: string;
  views: number;
  pinned?: boolean;
  locked?: boolean;
}

export interface DemoPostSeed {
  id: string;
  topicId: string;
  authorId: string;
  minutesAgo: number;
  body: string;
}

export const DEMO_USERS: AuthorSummary[] = [
  { id: 'u-aslanpence', username: 'aslanpence', role: 'verified' },
  { id: 'u-tribun1905', username: 'tribun_1905', role: 'user' },
  { id: 'u-taktik', username: 'taktikdefteri', role: 'user' },
  { id: 'u-kopenhag', username: 'kopenhag2000', role: 'user' },
  { id: 'u-ankara', username: 'sarikirmizi_ank', role: 'user' },
  { id: 'u-akademi', username: 'akademigozlem', role: 'user' },
  { id: 'u-pota', username: 'potanin_aslani', role: 'user' },
  { id: 'u-mod', username: 'galaforum_mod', role: 'moderator' },
];

export const DEMO_TOPICS: DemoTopicSeed[] = [
  {
    id: 't-kurallar',
    categorySlug: 'serbest',
    title: 'Forum kuralları ve yeni üyeler için rehber',
    authorId: 'u-mod',
    views: 4210,
    pinned: true,
    locked: true,
  },
  { id: 't-cift-pivot', categorySlug: 'mac-taktik', title: 'Derbilerde çift pivot mu, tek ön libero mu?', authorId: 'u-taktik', views: 1893 },
  { id: 't-bek-bindirme', categorySlug: 'mac-taktik', title: 'Bek bindirmeleri ve geride kalan alan: savunma dengesi', authorId: 'u-aslanpence', views: 944 },
  { id: 't-kis-oncelik', categorySlug: 'transfer', title: 'Kış döneminde öncelik stoper mi, sol kanat mı?', authorId: 'u-ankara', views: 2380 },
  { id: 't-kaynak-rehberi', categorySlug: 'transfer', title: 'Transfer haberlerinde kaynak güvenilirliği nasıl ölçülür?', authorId: 'u-mod', views: 1320, pinned: true },
  { id: 't-rotasyon', categorySlug: 'takim-oyuncular', title: 'Yoğun fikstürde rotasyon: kimler dinlenmeli?', authorId: 'u-tribun1905', views: 760 },
  { id: 't-butce', categorySlug: 'yonetim-kulup', title: 'Genel kurul öncesi bütçe sunumunda merak ettiklerimiz', authorId: 'u-aslanpence', views: 610 },
  { id: 't-deplasman', categorySlug: 'avrupa', title: 'Avrupa deplasmanlarında bilet ve ulaşım tecrübeleri', authorId: 'u-kopenhag', views: 1105 },
  { id: 't-2000', categorySlug: 'galatasaray-tarihi', title: '2000 UEFA Kupası yolculuğu: sizin için unutulmaz an hangisi?', authorId: 'u-kopenhag', views: 5120 },
  { id: 't-ankara-bulusma', categorySlug: 'mac-oncesi-bulusmalar', title: 'Ankara çıkışlı ortak yolculuk — sezonun ilk iç saha maçı', authorId: 'u-ankara', views: 402 },
  { id: 't-basket-kadro', categorySlug: 'basketbol', title: 'Basketbol takımında guard rotasyonu yeterli mi?', authorId: 'u-pota', views: 538 },
  { id: 't-u19', categorySlug: 'altyapi-akademi', title: 'U19 takımını izleyenler: A takıma en hazır isim kim?', authorId: 'u-akademi', views: 870 },
  { id: 't-koreografi', categorySlug: 'taraftar-tribun', title: 'Sezon açılışı koreografisi için fikir havuzu', authorId: 'u-tribun1905', views: 1490 },
  { id: 't-mac-izleme', categorySlug: 'serbest', title: 'Deplasman maçlarını nerede izliyorsunuz? Şehir şehir öneriler', authorId: 'u-ankara', views: 690 },
];

export const DEMO_POSTS: DemoPostSeed[] = [
  // Forum kuralları
  {
    id: 'p-kurallar-1',
    topicId: 't-kurallar',
    authorId: 'u-mod',
    minutesAgo: 60 * 24 * 40,
    body:
      'GalaForum’a hoş geldin. Burada tartışmanın derinliği önemli: konu açmadan önce aramayı kullan, başlığı net yaz ve doğru kategoriyi seç.\n\nKişisel hakaret, nefret söylemi ve kaynaksız “resmi” iddialar kaldırılır. Transfer haberlerinde kaynağını belirt. Rakip taraftarlara da saygı çerçevesinde yaklaşalım.\n\nDaima Galatasaray.',
  },
  // Çift pivot
  {
    id: 'p-pivot-1',
    topicId: 't-cift-pivot',
    authorId: 'u-taktik',
    minutesAgo: 60 * 26,
    body:
      'Büyük maçlarda rakip baskıyı önde yaptığında tek ön libero ile oyun kurmak zorlaşıyor. Çift pivotla ilk pas hattı rahatlıyor ama bu sefer ceza sahası çevresinde bir kişi eksik kalıyoruz. Sizce derbilerde hangisi daha doğru?',
  },
  {
    id: 'p-pivot-2',
    topicId: 't-cift-pivot',
    authorId: 'u-aslanpence',
    minutesAgo: 60 * 20,
    body:
      'Bence rakibin ilk pres yapısına göre karar verilmeli. İki forvetle basan takıma karşı çift pivot şart; tek forvetle basan takıma karşı tek pivot ve öne çıkan bir sekiz numara daha etkili.',
  },
  {
    id: 'p-pivot-3',
    topicId: 't-cift-pivot',
    authorId: 'u-tribun1905',
    minutesAgo: 60 * 3,
    body: 'Tribünden izlerken en çok fark ettiğim şey, çift pivotta kanatların çok daha rahat çizgiye açılabilmesi. Geçiş savunması da daha derli toplu duruyor.',
  },
  {
    id: 'p-pivot-4',
    topicId: 't-cift-pivot',
    authorId: 'u-taktik',
    minutesAgo: 14,
    body:
      '> Geçiş savunması da daha derli toplu duruyor.\n\nKesinlikle. Topu kaybettiğimiz anda iki oyuncunun merkezi kapatması, stoperlerin öne çıkma riskini azaltıyor. Derbide ilk 20 dakika bunu görmek isterim.',
  },
  // Bek bindirme
  {
    id: 'p-bek-1',
    topicId: 't-bek-bindirme',
    authorId: 'u-aslanpence',
    minutesAgo: 60 * 30,
    body: 'İki bek aynı anda hücuma çıktığında kontrada stoperler geniş alanda kalıyor. Bir bek içeri kat edip üçlü savunma oluşturursa bu risk azalır mı?',
  },
  {
    id: 'p-bek-2',
    topicId: 't-bek-bindirme',
    authorId: 'u-taktik',
    minutesAgo: 60 * 9,
    body: 'Ters bek fikri mantıklı. Top bizdeyken 3-2 yapı kurmak hem pas açısını artırır hem de geçiş savunmasında merkezi korur.',
  },
  // Kış öncelik
  {
    id: 'p-kis-1',
    topicId: 't-kis-oncelik',
    authorId: 'u-ankara',
    minutesAgo: 60 * 50,
    body: 'Sakatlıklar düşünüldüğünde stoper derinliği sorun gibi. Öte yandan sol kanatta birebirde adam eksiltecek profil de eksik. Bütçe tek transfere yeterse hangisi?',
  },
  {
    id: 'p-kis-2',
    topicId: 't-kis-oncelik',
    authorId: 'u-kopenhag',
    minutesAgo: 60 * 5,
    body: 'Uzun sezonda savunma derinliği şampiyonluk getirir. Ben stoperden yanayım; kanatta mevcut oyuncularla rotasyon yapılabilir.',
  },
  {
    id: 'p-kis-3',
    topicId: 't-kis-oncelik',
    authorId: 'u-pota',
    minutesAgo: 47,
    body: 'Katılıyorum ama sol ayaklı bir stoper olursa oyun kurulumu da rahatlar. Tek transferle iki sorunu kısmen çözmek mümkün.',
  },
  // Kaynak rehberi
  {
    id: 'p-kaynak-1',
    topicId: 't-kaynak-rehberi',
    authorId: 'u-mod',
    minutesAgo: 60 * 24 * 12,
    body:
      'Transfer bölümünde her haberin yanında kaynak belirtelim. Durum etiketleri: söylenti, görüşme, güçlü iddia ve resmi. “Resmi” etiketi yalnızca kulübün doğrulanmış açıklamasından sonra kullanılır.',
  },
  // Rotasyon
  {
    id: 'p-rot-1',
    topicId: 't-rotasyon',
    authorId: 'u-tribun1905',
    minutesAgo: 60 * 40,
    body: 'Üç günde bir maç oynanan dönemde kilit oyuncuları nasıl koruyacağız? Özellikle orta sahada yük çok fazla.',
  },
  {
    id: 'p-rot-2',
    topicId: 't-rotasyon',
    authorId: 'u-akademi',
    minutesAgo: 60 * 7,
    body: 'Kupa maçları akademiden gelen oyunculara süre vermek için iyi bir fırsat. Hem yük dağılır hem de genç oyuncular tecrübe kazanır.',
  },
  // Bütçe
  {
    id: 'p-butce-1',
    topicId: 't-butce',
    authorId: 'u-aslanpence',
    minutesAgo: 60 * 70,
    body: 'Genel kurulda bütçe sunumu yapılacak. Altyapı yatırımları ve tesis planlamasıyla ilgili hangi soruların sorulmasını istersiniz? Ortak bir liste hazırlayalım.',
  },
  // Avrupa deplasman
  {
    id: 'p-dep-1',
    topicId: 't-deplasman',
    authorId: 'u-kopenhag',
    minutesAgo: 60 * 24 * 3,
    body: 'Avrupa deplasmanlarında bilet tahsisi ve ulaşım planı her seferinde karmaşık oluyor. Tecrübelerinizi paylaşırsanız yeni gidecekler için bir rehber çıkarabiliriz.',
  },
  {
    id: 'p-dep-2',
    topicId: 't-deplasman',
    authorId: 'u-ankara',
    minutesAgo: 60 * 11,
    body: 'Bilet açıklamasını beklemeden konaklamayı iptal edilebilir seçenekle ayırmak çok işime yaradı. Şehir içi ulaşımı da deplasman grubuyla ortak organize ettik.',
  },
  // 2000
  {
    id: 'p-2000-1',
    topicId: 't-2000',
    authorId: 'u-kopenhag',
    minutesAgo: 60 * 24 * 6,
    body: 'Kopenhag’daki final gecesi hâlâ dün gibi. Sizin için o yolculuğun en unutulmaz anı hangisiydi? Penaltılar mı, yoksa finale giden yoldaki bir deplasman mı?',
  },
  {
    id: 'p-2000-2',
    topicId: 't-2000',
    authorId: 'u-tribun1905',
    minutesAgo: 60 * 24 * 2,
    body: 'Son penaltıdan sonra bütün mahallenin sokağa döküldüğü an. O gece şehirde kimse uyumadı.',
  },
  {
    id: 'p-2000-3',
    topicId: 't-2000',
    authorId: 'u-aslanpence',
    minutesAgo: 60 * 2,
    body: 'Birkaç ay sonra gelen Süper Kupa’yı da unutmayalım. Avrupa’da iki kupa art arda — bu kulübün hafızasındaki en özel dönemlerden biri.',
  },
  // Ankara buluşma
  {
    id: 'p-ank-1',
    topicId: 't-ankara-bulusma',
    authorId: 'u-ankara',
    minutesAgo: 60 * 16,
    body: 'Ankara’dan ortak otobüsle gitmeyi düşünüyoruz. Katılmak isteyenler bu konuya yazsın; kalkış saati ve buluşma noktasını birlikte belirleyelim.',
  },
  // Basketbol
  {
    id: 'p-bask-1',
    topicId: 't-basket-kadro',
    authorId: 'u-pota',
    minutesAgo: 60 * 28,
    body: 'Avrupa ve lig maçları üst üste gelince guard rotasyonu kısa kalıyor. Oyun kurucu pozisyonunda bir takviye şart mı sizce?',
  },
  {
    id: 'p-bask-2',
    topicId: 't-basket-kadro',
    authorId: 'u-tribun1905',
    minutesAgo: 60 * 4,
    body: 'Şart. Özellikle son çeyreklerde top kaybı sayısı yükseliyor; yorgunluk etkisi net görülüyor.',
  },
  // U19
  {
    id: 'p-u19-1',
    topicId: 't-u19',
    authorId: 'u-akademi',
    minutesAgo: 60 * 22,
    body: 'Bu sezon U19 maçlarını düzenli izliyorum. Orta sahada oyun görüşü çok iyi bir isim var; fizik olarak biraz daha gelişmesi lazım ama A takım antrenmanlarına çağrılmayı hak ediyor.',
  },
  {
    id: 'p-u19-2',
    topicId: 't-u19',
    authorId: 'u-taktik',
    minutesAgo: 60 * 6,
    body: 'Akademiden gelen oyunculara net bir geçiş planı olmalı: önce kupa maçları, sonra ligde skor rahatken süre.',
  },
  // Koreografi
  {
    id: 'p-kor-1',
    topicId: 't-koreografi',
    authorId: 'u-tribun1905',
    minutesAgo: 60 * 12,
    body: 'Sezon açılışı için sarı-kırmızı dalgalı bir kareli koreografi düşünüyoruz. Tema önerilerinizi ve tribün bloklarındaki uygulanabilirliği buraya yazın.',
  },
  {
    id: 'p-kor-2',
    topicId: 't-koreografi',
    authorId: 'u-kopenhag',
    minutesAgo: 60 * 1 + 20,
    body: '1905’ten bugüne uzanan bir zaman çizgisi teması güzel olur. Her blok bir dönemi temsil edebilir.',
  },
  // Serbest - izleme
  {
    id: 'p-izle-1',
    topicId: 't-mac-izleme',
    authorId: 'u-ankara',
    minutesAgo: 60 * 24 * 1 + 60,
    body: 'Deplasman maçlarını kalabalık izlemek başka keyif. Şehrinizde taraftarların toplandığı mekânları paylaşalım; buluşma bölümüne de bağlantı veririz.',
  },
];
