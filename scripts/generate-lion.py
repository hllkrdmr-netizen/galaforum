"""Procedurally generates an original faceted (low-poly) lion head SVG for GalaForum.

Frontal, symmetric lion face with a burgundy/wine mane and gold facial facets.
Output: lion.svg (transparent background).
"""
import math
import random

import numpy as np
from matplotlib.path import Path
from scipy.spatial import Delaunay

random.seed(7)
np.random.seed(7)

W = H = 1000
CX = 500


def lerp(a, b, t):
    return a + (b - a) * t


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(c):
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v)))) for v in c)


def ramp(stops, t):
    t = max(0.0, min(1.0, t))
    for i in range(len(stops) - 1):
        t0, c0 = stops[i]
        t1, c1 = stops[i + 1]
        if t <= t1:
            k = (t - t0) / (t1 - t0) if t1 > t0 else 0
            a, b = hex2rgb(c0), hex2rgb(c1)
            return tuple(lerp(a[j], b[j], k) for j in range(3))
    return hex2rgb(stops[-1][1])


def mirror(points):
    out = []
    for x, y in points:
        out.append((x, y))
        if abs(x - CX) > 0.5:
            out.append((2 * CX - x, y))
    return out


# ---------------------------------------------------------------- face
# Face outline (left half, top -> bottom), mirrored to build the full outline.
face_left = [
    (500, 232), (442, 238), (388, 260), (344, 298), (314, 352), (298, 418),
    (300, 488), (316, 552), (346, 612), (388, 668), (434, 710), (472, 734), (500, 740),
]
face_outline = face_left + [(2 * CX - x, y) for x, y in reversed(face_left[:-1])][:-1]
face_path = Path(face_outline)

face_pts_left = face_left + [
    (460, 272), (405, 292), (362, 335), (336, 400), (334, 470), (352, 540), (390, 610), (440, 668),
    (448, 318), (400, 345), (372, 395), (378, 460), (405, 530), (445, 590),
    (472, 360), (430, 372), (462, 460), (432, 500), (474, 548), (462, 690), (482, 712),
    (500, 280), (500, 340), (500, 420), (500, 500), (500, 600), (500, 680), (500, 720),
    (330, 560), (372, 640), (420, 630),
]
face_pts = mirror(face_pts_left)
face_pts = [(x + (np.random.rand() - 0.5) * 6 if abs(x - CX) > 1 else x, y) for x, y in face_pts]
# re-symmetrise jitter
sym = {}
face_pts_sym = []
for x, y in face_pts:
    face_pts_sym.append((x, y))
face_pts = face_pts_sym

face_stops = [
    (0.0, '#4a1420'),
    (0.28, '#7a2a1c'),
    (0.52, '#b0661f'),
    (0.74, '#d99a2e'),
    (1.0, '#f4cf6a'),
]


def face_light(cx, cy):
    # light comes from above/centre; sides and jaw fall into shadow
    dx = abs(cx - CX) / 240.0
    dy = (cy - 205) / 560.0
    center = 1.0 - min(1.0, dx) ** 1.25
    top = 1.0 - dy * 0.55
    ridge = math.exp(-((cx - CX) / 55.0) ** 2) * (0.22 if 380 < cy < 600 else 0.1)
    return 0.12 + 0.72 * center * top + ridge


# ---------------------------------------------------------------- mane
def mane_outline(n=64):
    pts = []
    for i in range(n):
        a = -math.pi / 2 + (i / n) * 2 * math.pi
        s = math.sin(a)  # -1 top, +1 bottom
        c = abs(math.cos(a))
        base = 360 + 70 * max(0, s) + 55 * c + 18 * math.sin(3 * a) + 12 * math.sin(7 * a + 1.3)
        if i % 2 == 0:
            spike = random.uniform(35, 90) * (0.7 + 0.5 * max(0, s) + 0.3 * c)
        else:
            spike = random.uniform(-25, 5)
        # sweep locks slightly downward/outward
        a2 = a + (0.035 if math.cos(a) > 0 else -0.035) * (1 if i % 2 == 0 else 0) * (1 + max(0, s))
        r = base + spike
        pts.append((CX + r * math.cos(a2) * 0.97, 505 + r * math.sin(a2) * 0.9))
    return pts


mane_out = mane_outline()
# symmetrise mane outline
half = len(mane_out) // 2
for i in range(1, half):
    x, y = mane_out[i]
    mane_out[len(mane_out) - i] = (2 * CX - x, y)
mane_path = Path(mane_out)
mane_pts_extra = []

mane_pts = list(mane_out)
for ring_r, count in [(290, 30), (330, 38), (372, 46), (412, 52)]:
    for i in range(count):
        a = -math.pi / 2 + (i + 0.5 * (ring_r % 2)) / count * 2 * math.pi
        s = math.sin(a)
        r = ring_r + 40 * max(0, s) + random.uniform(-18, 18)
        mane_pts.append((CX + r * math.cos(a), 505 + r * math.sin(a) * 0.93))
mane_pts += face_outline
mane_pts = [(x, y) for x, y in mane_pts]

mane_stops = [
    (0.0, '#1a0508'),
    (0.35, '#3d0b16'),
    (0.62, '#6b1424'),
    (0.82, '#8f2230'),
    (1.0, '#c0762a'),
]


def mane_light(cx, cy):
    d = math.hypot(cx - CX, (cy - 505) / 0.93)
    radial = 1.0 - min(1.0, max(0.0, (d - 270) / 210.0)) ** 0.8
    top = 1.0 - (cy - 60) / 1000.0
    return 0.08 + 0.62 * radial * (0.6 + 0.4 * top)


def tris(points, keep):
    pts = np.array(points)
    tri = Delaunay(pts)
    out = []
    for simplex in tri.simplices:
        p = pts[simplex]
        c = p.mean(axis=0)
        if keep(c):
            out.append((p, c))
    return out


svg = []
svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
svg.append('''<defs>
  <radialGradient id="glow" cx="50%" cy="48%" r="52%">
    <stop offset="0%" stop-color="#e0a93b" stop-opacity="0.30"/>
    <stop offset="45%" stop-color="#8f2230" stop-opacity="0.18"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="eye" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#ffe08a"/>
    <stop offset="100%" stop-color="#d98a1c"/>
  </linearGradient>
</defs>''')
svg.append(f'<circle cx="{CX}" cy="500" r="500" fill="url(#glow)"/>')

# mane
for p, c in tris(mane_pts, lambda c: mane_path.contains_point(c)):
    t = mane_light(*c) + random.uniform(-0.07, 0.07)
    col = ramp(mane_stops, t)
    d = ' '.join(f'{x:.1f},{y:.1f}' for x, y in p)
    svg.append(f'<polygon points="{d}" fill="{rgb2hex(col)}" stroke="{rgb2hex(col)}" stroke-width="0.8"/>')

# gold lock strands: thin curved strokes flowing outward
for i in range(0, len(mane_out), 2):
    x, y = mane_out[i]
    a = math.atan2(y - 505, x - CX)
    r0 = math.hypot(x - CX, y - 505)
    for k, off in enumerate((-0.06, 0.05)):
        r1 = r0 - 150 - 25 * k
        sx, sy = CX + r1 * math.cos(a + off), 505 + r1 * math.sin(a + off) * 0.95
        mx, my = CX + (r0 - 70) * math.cos(a + off * 0.4), 505 + (r0 - 70) * math.sin(a + off * 0.4) * 0.95
        op = 0.06 + 0.16 * max(0.0, 1 - y / 1000)
        x, y = CX + (r0 - 28) * math.cos(a), 505 + (r0 - 28) * math.sin(a)
        svg.append(f'<path d="M{sx:.1f},{sy:.1f} Q{mx:.1f},{my:.1f} {x:.1f},{y:.1f}" fill="none" stroke="#e0a93b" stroke-opacity="{op:.2f}" stroke-width="{1.6 - k * 0.6:.1f}" stroke-linecap="round"/>')

# soft drop shadow under the face for depth
sd = ' '.join(f'{x:.1f},{y + 22:.1f}' for x, y in face_outline)
svg.append('<filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>')
svg.append(f'<polygon points="{sd}" fill="#0a0203" fill-opacity="0.75" filter="url(#blur)"/>')

# face
for p, c in tris(face_pts, lambda c: face_path.contains_point(c)):
    t = face_light(*c) + random.uniform(-0.05, 0.05)
    col = ramp(face_stops, t)
    d = ' '.join(f'{x:.1f},{y:.1f}' for x, y in p)
    svg.append(f'<polygon points="{d}" fill="{rgb2hex(col)}" stroke="{rgb2hex(col)}" stroke-width="0.8"/>')


def poly(points, fill, extra=''):
    d = ' '.join(f'{x:.1f},{y:.1f}' for x, y in points)
    svg.append(f'<polygon points="{d}" fill="{fill}" {extra}/>')


def both(points, fill, extra=''):
    poly(points, fill, extra)
    poly([(2 * CX - x, y) for x, y in points], fill, extra)


# cheek fur tufts (break the mask silhouette)
both([(318, 470), (262, 520), (300, 528), (252, 580), (312, 572), (282, 632), (340, 606), (318, 552)], '#8f2a22')
both([(318, 480), (278, 522), (304, 530), (286, 566), (322, 560)], '#c07a2a', 'fill-opacity="0.55"')
both([(360, 640), (330, 700), (380, 684), (372, 730), (410, 692)], '#7a2a1c')
# stern brow: angled shadow wedges
both([(330, 372), (410, 360), (472, 386), (462, 404), (410, 392), (340, 398)], '#3a0d14', 'fill-opacity="0.9"')
both([(352, 364), (420, 350), (470, 372), (420, 362)], '#f4cf6a', 'fill-opacity="0.45"')
# eye sockets
both([(356, 410), (410, 400), (458, 422), (446, 440), (398, 442), (362, 430)], '#1c0508')
# eyes (almond, angled up to the outside)
both([(366, 414), (406, 407), (450, 424), (436, 434), (398, 436)], 'url(#eye)')
both([(400, 409), (412, 410), (413, 434), (402, 435)], '#140305')
both([(404, 412), (409, 412), (408, 419)], '#fff6d6', 'fill-opacity="0.9"')
# nose bridge highlight
poly([(484, 420), (516, 420), (526, 530), (500, 540), (474, 530)], '#f6d77e', 'fill-opacity="0.32"')
# broad lion nose
poly([(446, 548), (500, 538), (554, 548), (546, 574), (512, 600), (488, 600), (454, 574)], '#240609')
poly([(466, 552), (500, 545), (534, 552), (500, 566)], '#6a2224', 'fill-opacity="0.9"')
# philtrum and mouth
poly([(496, 600), (504, 600), (503, 642), (497, 642)], '#240609')
both([(500, 638), (468, 654), (432, 650), (442, 664), (472, 670), (500, 655)], '#240609')
# muzzle pads
both([(412, 596), (456, 590), (484, 626), (458, 646), (418, 640)], '#f4d27a', 'fill-opacity="0.22"')
for (x, y) in [(432, 610), (450, 618), (438, 628), (456, 632)]:
    svg.append(f'<circle cx="{x}" cy="{y}" r="2.4" fill="#3a0d14"/>')
    svg.append(f'<circle cx="{2 * CX - x}" cy="{y}" r="2.4" fill="#3a0d14"/>')
# chin
poly([(458, 690), (500, 680), (542, 690), (500, 738)], '#6b1c1a', 'fill-opacity="0.5"')
# ears peeking from the mane
both([(352, 280), (318, 214), (296, 286), (324, 318)], '#4a0f1a')
both([(342, 282), (320, 238), (310, 288)], '#b0661f', 'fill-opacity="0.6"')

# thin gold edge on face outline


svg.append('</svg>')

with open('lion.svg', 'w') as f:
    f.write('\n'.join(svg))
print('ok', len(svg))
