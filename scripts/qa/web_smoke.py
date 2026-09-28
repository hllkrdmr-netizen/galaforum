"""
GalaForum web smoke test (demo mode).

Serves an `expo export -p web` output folder and walks every route at phone (390 px) and desktop
(1440 px) widths, then runs the main demo flows. Fails on console errors, uncaught exceptions,
horizontal page overflow, unnamed buttons/links and missing key text.

    npx expo export -p web --output-dir dist/web-qa
    pip install playwright && python -m playwright install chromium
    python scripts/qa/web_smoke.py dist/web-qa            # add --shots out/ to save screenshots

Exit code 0 = all checks passed.
"""
import http.server
import json
import os
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROUTES = [
    ('/', 'GalaForum'),
    ('/mac', 'Maç'),
    ('/transfer', 'Transfer'),
    ('/topluluk', 'Topluluk'),
    ('/daha', 'Daha'),
    ('/ara', 'Ara'),
    ('/konu-ac', 'Konu'),
    ('/kategori/mac-taktik', 'Maç & Taktik'),
    ('/konu/t-cift-pivot', 'Derbilerde çift pivot'),
    ('/konu/t-cift-pivot?mesaj=p-pivot-4', 'Derbide ilk 20 dakika'),
    ('/mac/m-canli', 'Trabzonspor'),
    ('/ilk-11', 'İlk 11'),
    ('/bulusmalar', 'Buluşma'),
    ('/bulusma/bm-ankara', 'Ankara'),
    ('/bulusma-olustur', 'Buluşma'),
    ('/takip', 'Takip'),
    ('/uye/taktikdefteri', 'taktikdefteri'),
    ('/hesap', 'Hesap'),
    ('/giris', 'Giriş'),
    ('/kayit', 'Aileye katıl'),
    ('/sifre-sifirla', 'Şifre'),
    ('/bildirimler', 'Bildirimler'),
    ('/bildirim-ayarlari', 'Bildirim ayarları'),
    ('/moderasyon', 'Moderasyon'),
    ('/moderasyon/uye/taktikdefteri', 'taktikdefteri'),
    ('/mac-yonetimi', 'Maç yönetimi'),
    ('/mac-yonetimi/m-canli', 'Maçı yönet'),
    ('/bilgi/kurallar', 'Topluluk kuralları'),
    ('/bilgi/kosullar', 'Kullanım koşulları'),
    ('/bilgi/gizlilik', 'KVKK'),
    ('/boyle-bir-sayfa-yok', 'Aradığın sayfa burada değil'),
]

VIEWPORTS = [('phone', 390, 844, True), ('desktop', 1440, 900, False)]

# Checks run inside the page.
AUDIT_JS = """
() => {
  const doc = document.scrollingElement || document.documentElement;
  const overflow = doc.scrollWidth - window.innerWidth;
  const unnamed = [];
  const small = [];
  for (const el of document.querySelectorAll('[role="button"],[role="link"],button,a,[role="tab"],[role="checkbox"],[role="switch"]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').trim();
    if (!name) unnamed.push(el.outerHTML.slice(0, 120));
    if (Math.min(r.width, r.height) < 24) small.push((name || el.outerHTML).slice(0, 60));
  }
  return { overflow, unnamed, small, text: document.body.innerText };
}
"""


def serve(folder, port):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=folder, **kw)

        def do_GET(self):
            path = self.path.split('?')[0]
            if path == '/' or not os.path.exists(os.path.join(folder, path.lstrip('/'))):
                self.path = '/index.html'
            return super().do_GET()

        def log_message(self, *args):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', port), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    folder = os.path.abspath(sys.argv[1])
    shots = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
    if shots:
        os.makedirs(shots, exist_ok=True)
    port = 8799
    httpd = serve(folder, port)
    base = f'http://127.0.0.1:{port}'
    failures, notes = [], []

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page(w, h, mobile):
            ctx = browser.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, locale='tr-TR')
            page = ctx.new_page()
            errors = []
            # Map tiles cannot load in sandboxed CI; everything else must be clean.
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'tile' not in m.text.lower() and 'ERR_TUNNEL' not in m.text and 'ERR_NAME' not in m.text else None)
            page.on('pageerror', lambda e: errors.append(f'PAGEERROR {e}'))
            return ctx, page, errors

        # 1) every route at both widths
        for vname, w, h, mobile in VIEWPORTS:
            for route, expect in ROUTES:
                ctx, page, errors = new_page(w, h, mobile)
                page.goto(base + route)
                page.wait_for_timeout(1800)
                audit = page.evaluate(AUDIT_JS)
                tag = f'[{vname}] {route}'
                if errors:
                    failures.append(f'{tag}: console errors: {errors[:3]}')
                if audit['overflow'] > 1:
                    failures.append(f'{tag}: horizontal overflow {audit["overflow"]}px')
                if audit['unnamed']:
                    failures.append(f'{tag}: {len(audit["unnamed"])} unnamed controls, e.g. {audit["unnamed"][0]}')
                if expect.lower() not in audit['text'].lower():
                    failures.append(f'{tag}: expected text "{expect}" not found')
                if audit['small'] and mobile:
                    notes.append(f'{tag}: small targets {audit["small"][:3]}')
                if shots:
                    slug = 'home' if route == '/' else route.strip('/').replace('/', '_')
                    page.screenshot(path=os.path.join(shots, f'{vname}_{slug}.png'))
                ctx.close()

        # 2) demo flows (phone)
        def flow(name, fn):
            ctx, page, errors = new_page(390, 844, True)
            try:
                fn(page)
                if errors:
                    failures.append(f'flow {name}: console errors {errors[:3]}')
            except Exception as e:  # noqa: BLE001
                failures.append(f'flow {name}: {e}')
            finally:
                ctx.close()

        def create_topic_and_reply(page):
            page.goto(base + '/konu-ac?kategori=serbest')
            page.wait_for_timeout(1500)
            page.get_by_label('Konu başlığı').first.fill('Duman testi: deplasman otobüsü saat kaçta?')
            page.get_by_label('Konu mesajı').first.fill('Ankara çıkışlı otobüs için saat bilgisini paylaşır mısınız?')
            page.get_by_role('button', name='Yayımla').first.click()
            page.wait_for_timeout(2000)
            assert '/konu/' in page.url, f'did not open the new topic ({page.url})'
            page.get_by_text('Duman testi: deplasman otobüsü').first.wait_for(timeout=4000)

        def like_and_quote(page):
            page.goto(base + '/konu/t-cift-pivot')
            page.wait_for_timeout(1500)
            page.get_by_role('button', name='Beğen').first.click()
            page.wait_for_timeout(800)
            assert page.get_by_role('button', name='Beğeniyi kaldır').count() > 0, 'like did not toggle'

        def notifications(page):
            page.goto(base + '/bildirimler')
            page.wait_for_timeout(1500)
            page.get_by_role('button', name='Tümünü okundu say').first.click()
            page.wait_for_timeout(1200)
            assert page.get_by_role('button', name='Tümünü okundu say').count() == 0, 'mark-all did not clear unread'

        def moderation(page):
            page.goto(base + '/moderasyon')
            page.wait_for_timeout(1500)
            page.get_by_role('button', name='Şikâyeti reddet').first.click()
            page.get_by_role('button', name='Reddet').first.click()
            page.wait_for_timeout(1200)
            page.get_by_role('tab', name='Kayıt').click()
            page.wait_for_timeout(1000)
            assert 'Şikâyet reddedildi' in page.inner_text('body'), 'dismissal not in audit log'

        def block_member(page):
            page.goto(base + '/uye/taktikdefteri')
            page.wait_for_timeout(1500)
            page.get_by_role('button', name='Engelle').first.click()
            page.get_by_role('button', name='Engelle').last.click()
            page.wait_for_timeout(1000)
            assert page.get_by_role('button', name='Engeli kaldır').count() > 0, 'block did not apply'

        def signup_requires_terms(page):
            page.goto(base + '/kayit')
            page.wait_for_timeout(1500)
            assert page.get_by_role('checkbox').count() == 1, 'terms checkbox missing'

        def run_match(page):
            page.goto(base + '/mac-yonetimi')
            page.wait_for_timeout(1500)
            page.get_by_role('button', name='Yeni maç').first.click()
            page.get_by_label('Deplasman').first.fill('Göztepe')
            page.get_by_label('Tarih').first.fill('15.10.2026')
            page.get_by_label('Saat').first.fill('19:00')
            page.get_by_role('button', name='Maçı ekle').first.click()
            page.wait_for_timeout(1500)
            assert '/mac-yonetimi/' in page.url, f'did not open the new match ({page.url})'
            page.get_by_role('button', name='Canlı', exact=True).first.click()
            page.wait_for_timeout(1000)
            page.get_by_role('button', name='Galatasaray', exact=True).first.click()
            page.get_by_label('Dakika').first.fill('12')
            page.get_by_role('button', name='Olayı ekle').first.click()
            page.wait_for_timeout(1200)
            assert page.get_by_label('Skor 1 – 0').count() > 0, 'goal did not update the score'

        def profanity_warning(page):
            page.goto(base + '/konu/t-cift-pivot')
            page.wait_for_timeout(1500)
            page.get_by_label('Yanıt mesajı').first.fill('amk bu hakem')
            page.get_by_role('button', name='Yanıtı gönder').first.click()
            page.wait_for_timeout(600)
            assert page.get_by_role('button', name='Yine de gönder').count() > 0, 'no profanity warning'
            page.get_by_role('button', name='Düzenle').first.click()
            page.get_by_label('Yanıt mesajı').first.fill('Hakem bugün çok kötüydü.')
            assert page.get_by_role('button', name='Yanıtı gönder').count() > 0

        def deep_link(page):
            page.goto(base + '/konu/t-cift-pivot?mesaj=p-pivot-4')
            page.wait_for_timeout(2500)
            scrolled = page.evaluate("() => Math.max(0, ...[...document.querySelectorAll('div')].map((e) => e.scrollTop))")
            assert scrolled > 100, f'deep link did not scroll to the post (scrollTop {scrolled})'

        for name, fn in [
            ('konu aç', create_topic_and_reply),
            ('beğeni', like_and_quote),
            ('bildirimler', notifications),
            ('moderasyon', moderation),
            ('engelleme', block_member),
            ('kayıt onayı', signup_requires_terms),
            ('maç yönetimi', run_match),
            ('küfür uyarısı', profanity_warning),
            ('mesaja bağlantı', deep_link),
        ]:
            flow(name, fn)

        browser.close()
    httpd.shutdown()

    print(json.dumps({'routes': len(ROUTES) * len(VIEWPORTS), 'failures': failures, 'notes': notes[:20]}, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
