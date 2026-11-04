"""Rebuild the local review kit. Uses Pillow/RAQM and bundled sharp; no services."""
from pathlib import Path
from collections import defaultdict
import json
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT = Path(__file__).resolve().parent
REFERENCE = Path('/Users/shachafemanoel/Documents/Codex/2026-10-27/ordexapp-plugin-computer-use-openai-bundled/outputs/retzef-brand/retzef-brand-direction-v1.png')
NODE = '/Users/shachafemanoel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
SHARP = '/Users/shachafemanoel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'
BLUE, ORANGE, INK, PAPER = '#2361E8', '#FF743D', '#142B36', '#F8FAFF'
MUTED, LINE = '#536773', '#E3E9EF'
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
SYMBOL_PATH = 'M28 188 H68 Q100 188 100 156 V140 Q100 108 132 108 H148 Q180 108 180 76 V60 Q180 28 212 28 H252'
for folder in ('sources', 'png', 'previews'):
    (ROOT / folder).mkdir(exist_ok=True)


def svg(body, width, height, viewbox=None):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="{viewbox or f"0 0 {width} {height}"}">{body}</svg>'


def symbol(color=None, inverted=False):
    # One continuous silhouette. The clip changes color, never geometry.
    path = f'<path d="{SYMBOL_PATH}" fill="none" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"'
    base = path + f' stroke="{color or ("#FFFFFF" if inverted else BLUE)}"/>'
    if color:
        return base
    return '<defs><clipPath id="orange"><rect x="140" y="0" width="148" height="224"/></clipPath></defs>' + base + path + f' stroke="{ORANGE}" clip-path="url(#orange)"/>'


def simplify(points, tolerance=1.6):
    if len(points) < 3:
        return points
    a, b = np.array(points[0]), np.array(points[-1])
    ab = b - a
    delta = np.array(points[1:-1]) - a
    if np.dot(ab, ab):
        t = np.clip(delta @ ab / np.dot(ab, ab), 0, 1)
        distances = np.linalg.norm(delta - t[:, None] * ab, axis=1)
    else:
        distances = np.linalg.norm(delta, axis=1)
    index = int(np.argmax(distances)) + 1
    if distances[index - 1] <= tolerance:
        return [points[0], points[-1]]
    return simplify(points[:index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


def trace_wordmark():
    # Reconstruct only the supplied wordmark; exclude the neighboring symbol.
    crop = np.array(Image.open(REFERENCE).convert('RGB').crop((918, 104, 1273, 246)))
    mask = (crop.max(axis=2) < 125)
    edges = defaultdict(list)
    height, width = mask.shape
    for y, x in zip(*np.where(mask)):
        if y == 0 or not mask[y - 1, x]: edges[(x, y)].append((x + 1, y))
        if x == width - 1 or not mask[y, x + 1]: edges[(x + 1, y)].append((x + 1, y + 1))
        if y == height - 1 or not mask[y + 1, x]: edges[(x + 1, y + 1)].append((x, y + 1))
        if x == 0 or not mask[y, x - 1]: edges[(x, y + 1)].append((x, y))
    loops = []
    while edges:
        start = next(iter(edges))
        p, loop = start, [start]
        while True:
            q = edges[p].pop()
            if not edges[p]: del edges[p]
            loop.append(q)
            p = q
            if p == start: break
        if len(loop) > 35:
            # Split the closed contour to avoid a degenerate simplification chord.
            half = len(loop) // 2
            loops.append(simplify(loop[:half + 1])[:-1] + simplify(loop[half:])[:-1])
    return loops


CONTOURS = trace_wordmark()


def wordmark(corrected=True, color=INK):
    paths = []
    for loop in CONTOURS:
        # The leftmost letter is final pe. Extend only its existing descender.
        pts = [(float(x), float(y) + (max(0, y - 111) * .4 if corrected and x < 120 else 0)) for x, y in loop]
        # Quadratic interpolation removes raster stair steps while preserving contours.
        mids = [((pts[i - 1][0] + p[0]) / 2, (pts[i - 1][1] + p[1]) / 2) for i, p in enumerate(pts)]
        d = f'M{mids[0][0]:.2f},{mids[0][1]:.2f}'
        for i, p in enumerate(pts):
            end = mids[(i + 1) % len(pts)]
            d += f' Q{p[0]:.2f},{p[1]:.2f} {end[0]:.2f},{end[1]:.2f}'
        paths.append(d + ' Z')
    return f'<path fill="{color}" fill-rule="evenodd" d="{" ".join(paths)}"/>'


ASSETS = {}


def asset(name, body, width, height, viewbox=None, pixels=None):
    path = ROOT / 'sources' / f'{name}.svg'
    path.write_text(svg(body, width, height, viewbox), encoding='utf-8')
    ASSETS[name] = {'source': str(path), 'target': str(ROOT / 'png' / f'{name}.png'), 'width': pixels or width}


asset('symbol', symbol(), 288, 224, pixels=1152)
asset('symbol-ink', symbol(INK), 288, 224, pixels=1152)
asset('symbol-white', symbol('#FFFFFF'), 288, 224, pixels=1152)
asset('wordmark-a', wordmark(False), 355, 154, pixels=1420)
asset('wordmark-b', wordmark(True), 355, 154, pixels=1420)
for name, color, mono in [('logo', INK, None), ('logo-ink', INK, INK), ('logo-white', '#FFFFFF', '#FFFFFF')]:
    body = f'<g transform="translate(0 12)">{wordmark(True, color)}</g><g transform="translate(390 0) scale(.68)">{symbol(mono)}</g>'
    asset(name, body, 596, 166, pixels=1788)
for size in (16, 24, 32, 48, 128):
    for theme in ('light', 'blue'):
        bg = PAPER if theme == 'light' else BLUE
        body = f'<rect width="320" height="320" rx="68" fill="{bg}"/><g transform="translate(16 48)">{symbol(inverted=theme == "blue")}</g>'
        asset(f'icon-{theme}-{size}', body, size, size, '0 0 320 320')
        mono = symbol('#FFFFFF' if theme == 'blue' else BLUE)
        asset(f'icon-{theme}-mono-{size}', f'<rect width="320" height="320" rx="68" fill="{bg}"/><g transform="translate(16 48)">{mono}</g>', size, size, '0 0 320 320')

render_js = f"const sharp=require({json.dumps(SHARP)}); const jobs={json.dumps(list(ASSETS.values()))}; Promise.all(jobs.map(j=>sharp(j.source,{{density:288}}).resize({{width:j.width}}).png().toFile(j.target))).catch(e=>{{console.error(e);process.exit(1)}});"
subprocess.run([NODE, '-e', render_js], check=True)


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def text(im, xy, value, size=24, fill=INK, bold=False, rtl=True):
    draw = ImageDraw.Draw(im)
    draw.text(xy, value, font=font(size, bold), fill=fill, anchor='rt' if rtl else 'lt', direction='rtl' if rtl else 'ltr', language='he' if rtl else 'en')


def rect(im, box, fill, radius=24, outline=None, width=1):
    ImageDraw.Draw(im).rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def place(im, name, box):
    source = Image.open(ROOT / 'png' / f'{name}.png').convert('RGBA')
    source.thumbnail((box[2] - box[0], box[3] - box[1]), Image.Resampling.LANCZOS)
    im.paste(source, (box[0] + (box[2] - box[0] - source.width) // 2, box[1] + (box[3] - box[1] - source.height) // 2), source)


def desktop():
    im = Image.new('RGB', (1440, 900), PAPER)
    d = ImageDraw.Draw(im)
    rect(im, (0, 0, 1439, 899), '#FFFFFF', 24, LINE)
    d.rectangle((0, 0, 1440, 52), fill='#EDF1F6')
    for x in (25, 46, 67): d.ellipse((x, 20, x + 10, 30), fill='#B2C0CC')
    text(im, (720, 16), 'REVIEW / SYNTHETIC DATA', 15, MUTED, rtl=False)
    d.rectangle((1190, 53, 1439, 899), fill='#FFFFFF')
    d.line((1190, 53, 1190, 899), fill=LINE, width=2)
    place(im, 'logo', (1230, 82, 1400, 142))
    for i, label in enumerate(('הזמנות', 'לקוחות', 'מלאי', 'משלוחים', 'הגדרות')):
        y = 196 + i * 68
        if not i: rect(im, (1210, y - 12, 1418, y + 42), '#EAF0FF', 12)
        text(im, (1395, y), label, 24, BLUE if not i else MUTED, not i)
    text(im, (1130, 105), 'הזמנות', 46, bold=True)
    text(im, (1130, 166), 'כל הזמנה, והשלב הבא שלה.', 23, MUTED)
    rect(im, (60, 104, 269, 159), BLUE, 12)
    text(im, (248, 118), '+ הזמנה חדשה', 23, '#FFFFFF', True)
    for i, (number, label) in enumerate((('24', 'בטיפול'), ('8', 'לקראת מסירה'), ('12', 'הושלמו השבוע'))):
        x = 60 + i * 365
        rect(im, (x, 230, x + 339, 350), '#FFFFFF', 18, LINE)
        text(im, (x + 309, 249), label, 22, MUTED)
        text(im, (x + 309, 284), number, 43, BLUE, True)
    rect(im, (60, 389, 1130, 818), '#FFFFFF', 18, LINE)
    headers = [(1096, 'הזמנה'), (925, 'לקוח'), (648, 'שלב נוכחי'), (350, 'מועד מסירה')]
    for x, label in headers: text(im, (x, 415), label, 20, MUTED, True)
    rows = [('1048', 'לקוח לדוגמה א׳', 'בדיקת מלאי', '29.10.26'), ('1047', 'לקוח לדוגמה ב׳', 'בתיאום משלוח', '30.10.26'), ('1046', 'לקוח לדוגמה ג׳', 'בהזמנת רכש', '01.11.26'), ('1045', 'לקוח לדוגמה ד׳', 'הושלמה', '27.10.26')]
    for i, row in enumerate(rows):
        y = 478 + i * 77
        d.line((80, y - 18, 1110, y - 18), fill=LINE)
        text(im, (1096, y), row[0], 23, bold=True)
        text(im, (925, y), row[1], 22)
        rect(im, (440, y - 7, 652, y + 35), '#EDF2FF', 10)
        text(im, (638, y + 1), row[2], 20, BLUE)
        text(im, (350, y), row[3], 21, MUTED)
    text(im, (1130, 851), 'המחשת ממשק • נתונים סינתטיים • אינה צילום של המוצר', 18, MUTED)
    return im


def mobile():
    im = Image.new('RGB', (480, 960), PAPER)
    d = ImageDraw.Draw(im)
    text(im, (440, 22), '9:41', 18, bold=True)
    place(im, 'logo', (288, 72, 444, 122))
    text(im, (440, 160), 'הזמנה 1047', 36, bold=True)
    text(im, (440, 212), 'לקוח לדוגמה ב׳', 23, MUTED)
    rect(im, (28, 267, 452, 388), BLUE, 20)
    text(im, (426, 289), 'השלב הנוכחי', 19, '#FFFFFF')
    text(im, (426, 324), 'בתיאום משלוח', 31, '#FFFFFF', True)
    text(im, (440, 431), 'התקדמות ההזמנה', 24, bold=True)
    stages = ['ההזמנה נקלטה', 'בדיקת מלאי', 'תיאום משלוח', 'השלמת מסירה']
    for i, label in enumerate(stages):
        y = 492 + i * 80
        if i < 3: d.line((426, y + 13, 426, y + 82), fill=BLUE if i < 2 else LINE, width=4)
        d.ellipse((416, y, 436, y + 20), fill=BLUE if i < 3 else '#FFFFFF', outline=BLUE if i < 3 else MUTED, width=2)
        text(im, (397, y - 2), label, 24, INK if i < 3 else MUTED, i == 2)
    rect(im, (28, 837, 452, 898), '#FFFFFF', 14, LINE)
    text(im, (426, 855), 'מסירה מתוכננת: 30.10.26', 22)
    text(im, (440, 924), 'המחשת ממשק • נתונים סינתטיים', 17, MUTED)
    return im


desktop().save(ROOT / 'previews' / 'desktop.png')
mobile().save(ROOT / 'previews' / 'mobile.png')


def board():
    im = Image.new('RGB', (2400, 1600), PAPER)
    text(im, (72, 74), 'RETZEF / BRAND REVIEW 02', 23, MUTED, rtl=False)
    text(im, (72, 116), '27.10.2026', 20, MUTED, rtl=False)
    place(im, 'logo', (1800, 58, 2328, 207))
    rect(im, (72, 254, 1512, 656), BLUE, 30)
    text(im, (1450, 294), 'כל הזמנה.', 98, '#FFFFFF', True)
    text(im, (1450, 410), 'מהתחלה עד הסוף.', 98, '#FFFFFF', True)
    text(im, (1450, 556), 'ניהול לקוחות, הזמנות ותפעול במקום אחד.', 34, '#FFFFFF')
    rect(im, (1550, 254, 2328, 656), '#FFFFFF', 30, LINE)
    place(im, 'symbol', (1590, 278, 1880, 521))
    place(im, 'icon-blue-128', (2014, 300, 2206, 492))
    for x, color, label in [(1590, BLUE, '2361E8'), (1770, ORANGE, 'FF743D'), (1950, INK, '142B36'), (2130, PAPER, 'F8FAFF')]:
        rect(im, (x, 554, x + 150, 595), color, 10, LINE if color == PAPER else None)
        text(im, (x, 610), '#' + label, 19, MUTED, rtl=False)
    text(im, (1512, 707), 'מבט אחד על ההזמנות', 31, bold=True)
    text(im, (2328, 707), 'ההזמנה ממשיכה איתך', 31, bold=True)
    desktop_im = Image.open(ROOT / 'previews' / 'desktop.png')
    rect(im, (72, 766, 1512, 1518), '#EDF1F6', 26)
    desktop_im = desktop_im.resize((1152, 720), Image.Resampling.LANCZOS)
    im.paste(desktop_im, (216, 782))
    rect(im, (1734, 765, 2146, 1515), INK, 44)
    phone = Image.open(ROOT / 'previews' / 'mobile.png').resize((360, 720), Image.Resampling.LANCZOS)
    im.paste(phone, (1760, 780))
    text(im, (2328, 1550), 'רצף — ערכה לבחינה • ההדמיות אינן צילום מוצר • ללא הטמעה', 21, MUTED)
    text(im, (72, 1550), '02 / CONTINUITY IN PRACTICE', 18, MUTED, rtl=False)
    im.save(ROOT / 'retzef-brand-direction-v2.png')


def checksheet():
    im = Image.new('RGB', (2400, 1840), '#FFFFFF')
    d = ImageDraw.Draw(im)
    text(im, (2328, 55), 'רצף / בדיקות צורה וקריאות', 44, bold=True)
    text(im, (2328, 120), 'A — שחזור הכיוון המקורי     B — הארכה מתונה של ף׳ בלבד', 25, MUTED)
    for col, (name, label) in enumerate((('wordmark-a', 'A / השוואה'), ('wordmark-b', 'B / מועמד מומלץ'))):
        x = 72 + col * 1164
        text(im, (x + 1060, 200), label, 30, BLUE, True)
        place(im, name, (x + 150, 248, x + 850, 550))
        for y, width in [(590, 80), (680, 120), (780, 200)]:
            place(im, name, (x + 780 - width, y, x + 780, y + round(width * 154 / 355)))
            text(im, (x + 90, y), f'{width}px / 1×', 21, MUTED, rtl=False)
    d.line((72, 935, 2328, 935), fill=LINE, width=2)
    text(im, (2328, 970), 'אייקונים בגודל טבעי / שתי גרסאות רקע', 32, bold=True)
    for i, size in enumerate((16, 24, 32, 48, 128)):
        x = 110 + i * 450
        text(im, (x, 1035), f'{size}px / 1×', 22, MUTED, rtl=False)
        for y, theme in [(1090, 'light'), (1255, 'blue')]:
            icon = Image.open(ROOT / 'png' / f'icon-{theme}-{size}.png').convert('RGBA')
            im.paste(icon, (x, y), icon)
    text(im, (2328, 1450), 'אותה צללית, גם בצבע אחד', 32, bold=True)
    place(im, 'symbol-ink', (1470, 1510, 1740, 1740))
    rect(im, (1880, 1500, 2328, 1755), BLUE, 20)
    place(im, 'symbol-white', (1960, 1510, 2240, 1740))
    text(im, (72, 1790), 'View this sheet at 100% to assess 1× sizes. No user readability test has been performed.', 22, MUTED, rtl=False)
    im.save(ROOT / 'retzef-checksheet-v2.png')


def icon_detail():
    im = Image.new('RGB', (1600, 1480), '#FFFFFF')
    text(im, (1536, 42), 'אייקונים קטנים / צורה, צבע וניגודיות', 36, bold=True)
    for i, size in enumerate((16, 24, 32)):
        x = 64 + i * 520
        text(im, (x, 120), f'{size}px / native + 8× nearest', 22, MUTED, rtl=False)
        for j, suffix in enumerate(('light', 'blue', 'light-mono', 'blue-mono')):
            y = 195 + j * 310
            icon = Image.open(ROOT / 'png' / f'icon-{suffix}-{size}.png').convert('RGBA')
            im.paste(icon, (x, y), icon)
            large = icon.resize((size * 8, size * 8), Image.Resampling.NEAREST)
            im.paste(large, (x + 100, y), large)
            text(im, (x + 370, y + 20), suffix, 16, MUTED, rtl=False)
    im.save(ROOT / 'previews' / 'icon-detail.png')


board()
checksheet()
icon_detail()


def luminance(hex_value):
    values = [int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in values]
    return sum(a * b for a, b in zip(linear, (.2126, .7152, .0722)))


def contrast(a, b):
    light, dark = sorted((luminance(a), luminance(b)), reverse=True)
    return round((light + .05) / (dark + .05), 4)


pairs = [(INK, PAPER), (INK, '#FFFFFF'), (MUTED, PAPER), (MUTED, '#FFFFFF'), (MUTED, '#EDF1F6'), ('#FFFFFF', BLUE), (BLUE, '#FFFFFF'), (BLUE, '#EDF2FF'), (BLUE, '#EAF0FF')]
report = {'contrast': [{'foreground': a, 'background': b, 'ratio': contrast(a, b)} for a, b in pairs], 'wordmark_contours': len(CONTOURS), 'source_reference': str(REFERENCE), 'font': 'Arial (local rendering only; no font files redistributed)', 'svg_count': len(ASSETS), 'generated_files': []}
report['decorative_color_contrast'] = [{'foreground': ORANGE, 'background': bg, 'ratio': contrast(ORANGE, bg)} for bg in (PAPER, '#FFFFFF', BLUE)]
report['icon_silhouette_checks'] = []


def component_count(mask):
    remaining = set(zip(*np.where(mask)))
    count = 0
    while remaining:
        stack = [remaining.pop()]
        count += 1
        while stack:
            y, x = stack.pop()
            for dy, dx in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
                candidate = (y + dy, x + dx)
                if candidate in remaining:
                    remaining.remove(candidate)
                    stack.append(candidate)
    return count


for name, item in ASSETS.items():
    ET.parse(item['source'])
    source_text = Path(item['source']).read_text()
    assert '<image' not in source_text and '<text' not in source_text
    if name.startswith(('symbol', 'logo', 'icon')):
        assert SYMBOL_PATH in source_text, name
    im = Image.open(item['target'])
    report['generated_files'].append({'name': name, 'size': im.size, 'has_alpha': im.mode == 'RGBA'})
    if name.startswith('icon-'):
        rgba = np.array(im.convert('RGBA')).astype(int)
        bg = BLUE if name.startswith('icon-blue') else PAPER
        rgb = np.array([int(bg[i:i + 2], 16) for i in (1, 3, 5)])
        mask = (np.max(np.abs(rgba[:, :, :3] - rgb), axis=2) > 40) & (rgba[:, :, 3] > 200)
        ys, xs = np.where(mask)
        components = component_count(mask)
        clear_edge = bool(xs.min() > 0 and ys.min() > 0 and xs.max() < im.width - 1 and ys.max() < im.height - 1)
        report['icon_silhouette_checks'].append({'name': name, 'connected_components_8_neighbors': components, 'clear_of_canvas_edge': clear_edge})
        assert components == 1 and clear_edge, name
assert Image.open(ROOT / 'retzef-brand-direction-v2.png').size == (2400, 1600)
assert all(item['ratio'] >= 4.5 for item in report['contrast'])
(ROOT / 'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'assets': len(ASSETS), 'contours': len(CONTOURS), 'contrast': report['contrast']}, ensure_ascii=False))
