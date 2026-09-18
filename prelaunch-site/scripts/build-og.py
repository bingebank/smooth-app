#!/usr/bin/env python3
"""Build public/assets/og-card.jpg — the 1200x630 social preview.

Composites the scanner mockup onto the brand green with the wordmark, so the
share card shows the live product rather than a stale screenshot.

    python3 scripts/build-og.py
"""
import pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).resolve().parent.parent
ASSETS = HERE / 'public' / 'assets'

W, H = 1200, 630
GREEN_900, GREEN_800 = (0x14, 0x3A, 0x2B), (0x1A, 0x45, 0x34)
MINT, PAPER = (0x63, 0xC7, 0xA6), (0xF4, 0xF2, 0xEA)

card = Image.new('RGB', (W, H), GREEN_900)
d = ImageDraw.Draw(card)
for y in range(H):                                   # soft vertical wash
    t = y / H
    d.line([(0, y), (W, y)],
           fill=tuple(round(a + (b - a) * t) for a, b in zip(GREEN_900, GREEN_800)))

# phone on the right, bled off the bottom edge, with rounded corners and a shadow
shot = Image.open(ASSETS / 'scanner-mockup.jpg').convert('RGB')
sw = 430
shot = shot.resize((sw, round(shot.height * sw / shot.width)), Image.LANCZOS)
sx, sy, R = W - sw - 64, 58, 26
mask = Image.new('L', shot.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width - 1, shot.height - 1], R, fill=255)

shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle(
    [sx - 6, sy - 6, sx + shot.width + 6, sy + shot.height + 6], R + 6, fill=(0, 0, 0, 110))
card.paste(Image.alpha_composite(card.convert('RGBA'), shadow.filter(ImageFilter.GaussianBlur(18))).convert('RGB'), (0, 0))
card.paste(shot, (sx, sy), mask)

def font(size, bold=False):
    name = 'LiberationSans-Bold.ttf' if bold else 'LiberationSans-Regular.ttf'
    return ImageFont.truetype(f'/usr/share/fonts/truetype/liberation/{name}', size)

x = 84
d.polygon([(x, 104), (x + 4, 66), (x + 22, 46), (x + 52, 40),
           (x + 48, 74), (x + 30, 96)], fill=(0x6F, 0xBF, 0x4A))
d.line([(x, 104), (x + 40, 58)], fill=(0x2F, 0x6B, 0x21), width=4)

d.text((x + 70, 44), 'MyHealth', font=font(52, True), fill=PAPER)
d.text((x + 72, 100), 'Scanner', font=font(38), fill=(0xCF, 0xE6, 0xDA))

d.text((x, 214), 'Two scores for', font=font(54, True), fill=PAPER)
d.text((x, 274), 'every product.', font=font(54, True), fill=PAPER)
d.text((x, 334), 'One of them is yours.', font=font(54, True), fill=MINT)

d.text((x, 428), 'Scan any barcode and see how a product scores', font=font(24), fill=(0xB9, 0xD5, 0xC7))
d.text((x, 468), 'on its own merits — and how it scores for you.', font=font(25), fill=(0xB9, 0xD5, 0xC7))

d.text((x, 540), 'myhealthscanner.com', font=font(26, True), fill=MINT)

card.save(ASSETS / 'og-card.jpg', quality=90, optimize=True, progressive=True)
print('wrote', ASSETS / 'og-card.jpg', card.size)
