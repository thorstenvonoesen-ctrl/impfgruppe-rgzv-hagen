from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent / "tmp" / "festschrift_render"
pages = sorted(root.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 16)
for group_start in range(0, len(pages), 20):
    group = pages[group_start:group_start+20]
    sheet = Image.new("RGB", (5*310, 4*455), "#303030")
    draw = ImageDraw.Draw(sheet)
    for idx, path in enumerate(group):
        im = Image.open(path).convert("RGB")
        im.thumbnail((285, 404), Image.Resampling.LANCZOS)
        x = (idx % 5) * 310 + 12
        y = (idx // 5) * 455 + 28
        sheet.paste(im, (x, y))
        page_no = group_start + idx + 1
        draw.text((x, 5 + (idx // 5) * 455), f"Seite {page_no}", font=font, fill="white")
    out = root / f"contact-{group_start+1:02d}-{group_start+len(group):02d}.png"
    sheet.save(out, optimize=True)
    print(out)
