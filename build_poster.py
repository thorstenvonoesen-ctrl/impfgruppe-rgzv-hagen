from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / ".codex_deps"))

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from docx import Document
from docx.shared import Mm, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

W, H = 2480, 3508
INK = "#24180f"
RED = "#7a1f18"
PAPER = "#efe4c4"
URL = "https://formular.vereinsplaner.com/1c866a08-6853-4d40-9d07-5c64e17bc2ca"

SOURCE = Path(r"C:\Users\thors\.codex\generated_images\01a0c893-c2c1-7fa1-91d0-d5d8413fcbd8\exec-d2bec659-d407-443a-93ee-863ae1023ed8.png")
OUT = ROOT / "output"
QA = ROOT / "tmp" / "poster_qa"
OUT.mkdir(exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)

PNG = OUT / "RGZV_Hagen_Mitgliederplakat_1903.png"
PDF = OUT / "RGZV_Hagen_Mitgliederplakat_1903.pdf"
DOCX = OUT / "RGZV_Hagen_Mitgliederplakat_1903.docx"

FONT_REG = r"C:\Windows\Fonts\BOOKOS.TTF"
FONT_BOLD = r"C:\Windows\Fonts\BOOKOSB.TTF"
FONT_ITALIC = r"C:\Windows\Fonts\BOOKOSI.TTF"
FONT_DECOR = r"C:\Windows\Fonts\GOUDYSTO.TTF"


def font(path, size):
    return ImageFont.truetype(path, size=size)


def fit_font(draw, text, path, max_size, max_width, min_size=20):
    size = max_size
    while size > min_size:
        f = font(path, size)
        if draw.textbbox((0, 0), text, font=f)[2] <= max_width:
            return f
        size -= 2
    return font(path, min_size)


def centered(draw, text, y, fnt, fill=INK, stroke=0, stroke_fill=PAPER):
    box = draw.textbbox((0, 0), text, font=fnt, stroke_width=stroke)
    x = (W - (box[2] - box[0])) // 2
    draw.text((x, y), text, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)


def spaced_center(draw, text, y, fnt, spacing=5, fill=INK):
    widths = [draw.textlength(ch, font=fnt) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = (W - total) / 2
    for ch, cw in zip(text, widths):
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += cw + spacing


def ornament(draw, y, left=180, right=W-180, color=INK, width=4):
    mid = W // 2
    draw.line((left, y, mid-90, y), fill=color, width=width)
    draw.line((mid+90, y, right, y), fill=color, width=width)
    draw.arc((mid-90, y-35, mid-20, y+35), 190, 520, fill=color, width=width)
    draw.arc((mid+20, y-35, mid+90, y+35), 20, 350, fill=color, width=width)
    draw.ellipse((mid-7, y-7, mid+7, y+7), fill=color)


base = Image.open(SOURCE).convert("RGB")
# Crop the source to A-series ratio without stretching the illustration.
target_ratio = W / H
crop_h = round(base.width / target_ratio)
top = max(0, (base.height - crop_h) // 2)
base = base.crop((0, top, base.width, top + crop_h)).resize((W, H), Image.Resampling.LANCZOS)
draw = ImageDraw.Draw(base)

# Soften only the explicitly reserved lower text field; retain visible paper grain.
wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
wd = ImageDraw.Draw(wash)
wd.rectangle((95, 2440, 2385, 3495), fill=(239, 228, 196, 222))
wash = wash.filter(ImageFilter.GaussianBlur(8))
base = Image.alpha_composite(base.convert("RGBA"), wash).convert("RGB")
draw = ImageDraw.Draw(base)

# Historical masthead.
f = fit_font(draw, "RASSEGEFLÜGELZUCHTVEREIN", FONT_BOLD, 106, 2170)
spaced_center(draw, "RASSEGEFLÜGELZUCHTVEREIN", 105, f, spacing=3)
centered(draw, "Hagen und Umgebung", 225, font(FONT_BOLD, 86), INK)
centered(draw, "gegründet 1903", 325, font(FONT_ITALIC, 48), RED)
ornament(draw, 415, 310, W-310, RED, 4)

# City identification and recruiting headline integrated over the engraved panorama.
centered(draw, "HAGEN IN WESTFALEN", 470, font(FONT_REG, 42), INK, 3, PAPER)
headline = fit_font(draw, "FREUNDE DER RASSEGEFLÜGELZUCHT!", FONT_BOLD, 96, 2220)
centered(draw, "FREUNDE DER RASSEGEFLÜGELZUCHT!", 740, headline, INK, 8, PAPER)
member = fit_font(draw, "WERDET MITGLIED!", FONT_DECOR, 150, 1920)
centered(draw, "WERDET MITGLIED!", 875, member, RED, 7, PAPER)

# Lower advertising matter, intentionally set as newspaper/reclame lines rather than cards.
centered(draw, "UNSERE TIERE · VERBINDEN GENERATIONEN", 2460, font(FONT_BOLD, 58), INK)
ornament(draw, 2540, 250, W-250, RED, 3)

left_x = 150
body_f = font(FONT_REG, 42)
body_b = font(FONT_BOLD, 43)
lines = [
    "— Fachlicher Austausch und Hilfe —",
    "— Vereinsleben und Gemeinschaft —",
    "— Unterstützung bei Haltung, Zucht und Aufzucht —",
    "— Mitbrutgelegenheiten für Vereinsmitglieder —",
    "— ND-Impfangebot —",
    "— Ausstellungen und Tierbesprechungen —",
]
y = 2600
for line in lines:
    draw.text((left_x, y), line, font=body_f, fill=INK)
    y += 60
draw.text((left_x, 2975), "TRADITION BEWAHREN – ZUKUNFT GESTALTEN", font=body_b, fill=RED)
draw.text((left_x, 3060), "20 € JAHRESBEITRAG FÜR ERWACHSENE", font=font(FONT_BOLD, 52), fill=INK)
draw.text((left_x, 3128), "Kinder und Jugendliche sind beitragsfrei.", font=font(FONT_ITALIC, 39), fill=INK)

# Generate the real QR code independently, with H error correction and 4-module quiet zone.
qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H, box_size=16, border=4)
qr.add_data(URL)
qr.make(fit=True)
qr_img = qr.make_image(fill_color="#000000", back_color="#FFFFFF").convert("RGB")
qr_size = 610  # 51.6 mm at 300 dpi
qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.NEAREST)
qx, qy = 1735, 2750
draw.rectangle((qx-26, qy-26, qx+qr_size+26, qy+qr_size+26), fill="#FFFFFF")
base.paste(qr_img, (qx, qy))
label = fit_font(draw, "ONLINE-AUFNAHMEANTRAG", FONT_BOLD, 38, 690)
box = draw.textbbox((0, 0), "ONLINE-AUFNAHMEANTRAG", font=label)
draw.text((qx + (qr_size-(box[2]-box[0]))/2, 2668), "ONLINE-AUFNAHMEANTRAG", font=label, fill=INK)
label2 = font(FONT_BOLD, 35)
box = draw.textbbox((0, 0), "QR-CODE SCANNEN", font=label2)
draw.text((qx + (qr_size-(box[2]-box[0]))/2, 3370), "QR-CODE SCANNEN", font=label2, fill=INK)

# Footer.
draw.text((150, 3235), "UNSERE HEIMAT · UNSER VEREIN · UNSERE ZUKUNFT", font=font(FONT_BOLD, 38), fill=INK)
draw.text((150, 3310), "www.rgzv-hagen-westfalen.com", font=font(FONT_REG, 39), fill=RED)

base.save(PNG, format="PNG", dpi=(300, 300), optimize=True)
preview = base.copy()
preview.thumbnail((900, 1273), Image.Resampling.LANCZOS)
preview.save(QA / "poster-preview.png", format="PNG", optimize=True)

# Print-ready A4 PDF with no page margins.
c = canvas.Canvas(str(PDF), pagesize=A4, pageCompression=1)
c.drawImage(ImageReader(base), 0, 0, width=A4[0], height=A4[1], preserveAspectRatio=False, mask=None)
c.showPage()
c.save()

# One-page A4 DOCX with the final poster embedded edge-to-edge.
doc = Document()
section = doc.sections[0]
section.page_width = Mm(210)
section.page_height = Mm(297)
section.top_margin = Mm(0)
section.bottom_margin = Mm(0)
section.left_margin = Mm(0)
section.right_margin = Mm(0)
section.header_distance = Mm(0)
section.footer_distance = Mm(0)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(0)
p.paragraph_format.space_after = Pt(0)
r = p.add_run()
r.add_picture(str(PNG), width=Mm(210), height=Mm(296.5))
doc.core_properties.title = "RGZV Hagen Mitgliederplakat 1903"
doc.core_properties.subject = "Mitgliederwerbeplakat im historischen Reklamestil"
doc.core_properties.author = "Rassegeflügelzuchtverein Hagen und Umgebung"
doc.save(DOCX)

print(PNG)
print(PDF)
print(DOCX)
