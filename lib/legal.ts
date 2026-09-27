/**
 * Topluluk kuralları, kullanım koşulları ve gizlilik (KVKK aydınlatma) metinleri.
 *
 * Bu metinler uygulamanın gerçekte yaptığını anlatır (hangi veri, nerede, ne kadar süre). Yayından önce
 * bir hukukçunun gözden geçirmesi ve işletenin adı ile iletişim adresinin .env'e girilmesi gerekir
 * (docs/RELEASE.md). Değişiklikte LEGAL_VERSION ve LEGAL_UPDATED güncellenmeli; kayıt ekranı bu sürümü
 * üyenin onayıyla birlikte saklar.
 */
export const LEGAL_VERSION = '2026-09-28';
export const LEGAL_UPDATED = '28 Eylül 2026';

export type LegalSlug = 'kurallar' | 'kosullar' | 'gizlilik';

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalPage {
  slug: LegalSlug;
  title: string;
  intro: string;
  sections: LegalSection[];
}

export interface LegalContext {
  operatorName: string;
  contactEmail: string;
}

export const LEGAL_PAGES: Array<{ slug: LegalSlug; title: string; icon: 'people-outline' | 'document-text-outline' | 'lock-closed-outline' }> = [
  { slug: 'kurallar', title: 'Topluluk kuralları', icon: 'people-outline' },
  { slug: 'kosullar', title: 'Kullanım koşulları', icon: 'document-text-outline' },
  { slug: 'gizlilik', title: 'Gizlilik ve KVKK aydınlatma metni', icon: 'lock-closed-outline' },
];

export function isLegalSlug(s: string | undefined): s is LegalSlug {
  return s === 'kurallar' || s === 'kosullar' || s === 'gizlilik';
}

function operator(ctx: LegalContext): string {
  return ctx.operatorName || 'GalaForum’u işleten kişi veya kurum';
}

function contact(ctx: LegalContext): string {
  return ctx.contactEmail
    ? `${ctx.contactEmail} adresine e-posta göndererek`
    : 'uygulamada yayınlanan iletişim adresine yazarak';
}

export function legalPage(slug: LegalSlug, ctx: LegalContext): LegalPage {
  switch (slug) {
    case 'kurallar':
      return {
        slug,
        title: 'Topluluk kuralları',
        intro:
          'GalaForum, Galatasaray taraftarlarının derinlemesine tartıştığı bağımsız bir forumdur. Bu kurallar tartışmanın kalitesini ve herkesin güvenliğini korumak için var.',
        sections: [
          {
            title: '1. Saygı',
            paragraphs: [
              'Fikre itiraz et, kişiye değil. Hakaret, küfür, aşağılama ve kişisel saldırı kaldırılır. Rakip takımların taraftarlarına da aynı saygıyı göster.',
            ],
          },
          {
            title: '2. Nefret söylemi ve şiddet',
            paragraphs: [
              'Irk, etnik köken, din, cinsiyet, cinsel yönelim, engellilik veya memleket üzerinden ayrımcılık ve nefret söylemi yasaktır. Tehdit, şiddete çağrı ve taraftar grupları arasında kavga organize etmek hesabın kalıcı olarak yasaklanmasıyla sonuçlanır.',
            ],
          },
          {
            title: '3. Kaynak ve doğruluk',
            paragraphs: [
              'Transfer, sakatlık ve yönetim haberlerinde kaynağını belirt. Uydurma “resmî açıklama”, sahte ekran görüntüsü ve kaynaksız kesin iddialar kaldırılır.',
            ],
          },
          {
            title: '4. Düzen',
            paragraphs: [
              'Konu açmadan önce aramayı kullan, doğru kategoriyi seç ve başlığı açık yaz. Aynı mesajı birden çok konuya yapıştırmak, reklam, yasa dışı bahis tanıtımı ve spam yasaktır.',
            ],
          },
          {
            title: '5. Kişisel bilgiler ve telif',
            paragraphs: [
              'Başkasının adresini, telefonunu, iş yerini veya izinsiz fotoğrafını paylaşma. Korsan maç yayını bağlantısı ve izinsiz yayın görüntüsü paylaşılmaz.',
            ],
          },
          {
            title: '6. Bildirme, engelleme ve moderasyon',
            paragraphs: [
              'Kurala aykırı bir mesajı “⋯ → Bildir” ile moderatörlere ilet; bildirimler en geç 24 saat içinde incelenir. Seni rahatsız eden bir üyeyi profilinden engelleyebilirsin.',
              'Moderatörler mesajı kaldırabilir, konuyu kilitleyebilir veya gizleyebilir, üyeyi süreli ya da süresiz susturabilir veya yasaklayabilir. Her işlem gerekçesiyle kayda geçer ve ilgili üyeye bildirilir.',
              `Bir karara itiraz etmek için ${contact(ctx)} ulaşabilirsin.`,
            ],
          },
        ],
      };

    case 'kosullar':
      return {
        slug,
        title: 'Kullanım koşulları',
        intro: `Bu koşullar GalaForum uygulamasını ve web sitesini kullanımını düzenler. Hizmeti ${operator(ctx)} sunar. Üye olarak bu koşulları ve topluluk kurallarını kabul etmiş olursun.`,
        sections: [
          {
            title: 'Bağımsız platform',
            paragraphs: [
              'GalaForum bağımsız bir taraftar platformudur; Galatasaray Spor Kulübü’nün veya herhangi bir resmî kurumun kanalı değildir. Forumdaki görüşler yazanlara aittir.',
            ],
          },
          {
            title: 'Üyelik',
            paragraphs: [
              'Üye olmak için geçerli bir e-posta adresi gerekir ve en az 13 yaşında olmalısın; 18 yaşından küçüksen velinin onayıyla kullanmalısın. Hesabının ve şifrenin güvenliğinden sen sorumlusun. Kullanıcı adın herkese açıktır.',
            ],
          },
          {
            title: 'Paylaştığın içerik',
            paragraphs: [
              'Yazdıklarının hakları sende kalır. Paylaşarak, içeriğin forumda gösterilmesi, aranabilmesi ve alıntılanabilmesi için GalaForum’a ücretsiz ve süresiz bir kullanım izni vermiş olursun.',
              'Hesabını sildiğinde e-posta adresin ve profil bilgilerin silinir; tartışmaların bütünlüğü korunsun diye mesajların “silinmiş üye” adıyla kalır.',
            ],
          },
          {
            title: 'Yasak kullanım',
            paragraphs: [
              'Topluluk kurallarına aykırı içerik; başkasının hesabını kullanmak; otomatik araçlarla toplu içerik göndermek veya veri kazımak; sistemin güvenliğini aşmaya çalışmak yasaktır.',
            ],
          },
          {
            title: 'Moderasyon ve hesabın kapatılması',
            paragraphs: [
              'Kurallara aykırı içerik kaldırılabilir; üyeler süreli veya süresiz olarak susturulabilir ya da yasaklanabilir. Hesabını dilediğin zaman Hesap → Hesabı sil adımıyla kapatabilirsin.',
            ],
          },
          {
            title: 'Sorumluluk',
            paragraphs: [
              'Hizmet “olduğu gibi” sunulur; kesintisiz çalışacağı garanti edilmez. Üyelerin paylaştığı bilgilerin (transfer iddiaları, buluşma detayları dahil) doğruluğundan yazanlar sorumludur. Buluşmalara katılırken kendi güvenliğini gözet.',
            ],
          },
          {
            title: 'Değişiklikler ve iletişim',
            paragraphs: [
              `Koşullar değişirse güncel metin burada yayınlanır ve önemli değişiklikler uygulamada duyurulur. Sorular için ${contact(ctx)} ulaşabilirsin.`,
            ],
          },
        ],
      };

    case 'gizlilik':
      return {
        slug,
        title: 'Gizlilik ve KVKK aydınlatma metni',
        intro: `6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu: ${operator(ctx)}. Bu metin hangi verileri, neden ve ne kadar süre işlediğimizi anlatır.`,
        sections: [
          {
            title: 'Topladığımız veriler',
            paragraphs: [
              'Hesap: e-posta adresi, kullanıcı adı ve şifre (şifre yalnızca kimlik doğrulama sağlayıcısında, geri çevrilemez biçimde saklanır).',
              'Profil (isteğe bağlı): hakkında yazısı, şehir, en sevdiğin kategori.',
              'Forum etkinliği: açtığın konular, mesajlar, beğeniler, anket oyları, takip ettiklerin, engellediklerin, bildirdiğin mesajlar, buluşma katılımların, kaydettiğin ilk 11’ler ve maç tepkilerin.',
              'Bildirimler: bildirim kutun, bildirim tercihlerin ve anlık bildirim açtıysan cihazının bildirim anahtarı.',
              'Konum takibi yapmıyoruz; buluşma konumu yalnızca buluşmayı açan kişinin elle girdiği bilgidir. Reklam veya analiz amaçlı izleme aracı kullanmıyoruz.',
            ],
          },
          {
            title: 'Neden işliyoruz (hukuki sebep)',
            paragraphs: [
              'Hesabını açmak ve forumu sunmak için (sözleşmenin kurulması ve ifası, KVKK m.5/2-c); forumun güvenliği, kötüye kullanımın önlenmesi ve moderasyon kayıtları için (meşru menfaat, m.5/2-f); yasal yükümlülükler için (m.5/2-ç).',
            ],
          },
          {
            title: 'Kimlerle paylaşıyoruz',
            paragraphs: [
              'Veriler, altyapı hizmeti aldığımız Supabase (veritabanı ve kimlik doğrulama) sunucularında saklanır; sunucular yurt dışında bulunabilir (KVKK m.9). Anlık bildirimler Expo ve Apple/Google bildirim servisleri üzerinden iletilir. Harita önizlemesi açıldığında harita karoları harita sağlayıcısından yüklenir ve IP adresin bu sağlayıcıya iletilir.',
              'Kullanıcı adın, profilin ve forum mesajların herkese açıktır. E-posta adresin diğer üyelere gösterilmez. Verilerini satmıyoruz.',
            ],
          },
          {
            title: 'Ne kadar süre saklıyoruz',
            paragraphs: [
              'Hesap verileri hesabın açık olduğu sürece saklanır. Hesabını sildiğinde e-posta adresin, profil bilgilerin, beğenilerin, oyların, takiplerin, engellemelerin, bildirimlerin ve cihaz anahtarların silinir; mesajların “silinmiş üye” adıyla kalır.',
              'Okunmuş bildirimler 90 gün, okunmamışlar en geç 180 gün sonra silinir. Moderasyon kayıtları ve yaptırımlar, forumun güvenliği için hesap silindikten sonra da anonim hesapla ilişkili olarak saklanır.',
            ],
          },
          {
            title: 'Hakların',
            paragraphs: [
              'KVKK m.11 uyarınca verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltilmesini veya silinmesini isteme, işlemeye itiraz etme ve zararın giderilmesini talep etme hakların vardır. Profil bilgilerini Hesap ekranından düzeltebilir, hesabını uygulamadan silebilirsin.',
              `Diğer talepler için ${contact(ctx)} başvurabilirsin; başvurular en geç 30 gün içinde yanıtlanır.`,
            ],
          },
        ],
      };
  }
}
