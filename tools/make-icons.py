# 產生 PWA 圖示：金色電極格上一顆液滴
import os
from PIL import Image, ImageDraw

root = os.path.join(os.path.dirname(__file__), '..', 'icons')
for size in (192, 512):
    scale = 4  # 先畫大再縮小，邊緣才平滑
    n = size * scale
    img = Image.new('RGB', (n, n), '#0b2b33')
    draw = ImageDraw.Draw(img)
    margin, gap = n * 0.14, n * 0.03
    cell = (n - 2 * margin - 2 * gap) / 3
    for r in range(3):
        for c in range(3):
            x, y = margin + c * (cell + gap), margin + r * (cell + gap)
            draw.rectangle([x, y, x + cell, y + cell], fill='#d9b45b')
    # 中央液滴
    radius = cell * 0.78
    cx = cy = n / 2
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill='#7bd8ef')
    img.resize((size, size), Image.LANCZOS).save(os.path.join(root, f'icon-{size}.png'))
print('ok')
