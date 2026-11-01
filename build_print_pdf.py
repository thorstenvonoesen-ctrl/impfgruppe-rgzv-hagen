from pathlib import Path
from io import BytesIO
from pypdf import PdfReader, PdfWriter, Transformation
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

ROOT = Path(__file__).resolve().parent / "Festschrift_125_Jahre_RGZV_Hagen" / "10_Druckdaten"
SRC = ROOT / "Festschrift_RGZV_Hagen_125_Jahre_1903-2028.pdf"
OUT = ROOT / "Festschrift_RGZV_Hagen_125_Jahre_1903-2028_DRUCK.pdf"

bleed = 3 / 25.4 * 72
trim_w, trim_h = A4
outer_w, outer_h = trim_w + 2 * bleed, trim_h + 2 * bleed

buf = BytesIO()
c = canvas.Canvas(buf, pagesize=(outer_w, outer_h))
c.setLineWidth(0.3)
c.setStrokeColorRGB(0, 0, 0)
gap = 1.2 / 25.4 * 72
length = 5 / 25.4 * 72
# Horizontal crop marks.
for y in (bleed, bleed + trim_h):
    c.line(0, y, bleed-gap, y)
    c.line(bleed+trim_w+gap, y, outer_w, y)
# Vertical crop marks.
for x in (bleed, bleed + trim_w):
    c.line(x, 0, x, bleed-gap)
    c.line(x, bleed+trim_h+gap, x, outer_h)
c.showPage()
c.save()
buf.seek(0)
marks = PdfReader(buf).pages[0]

reader = PdfReader(str(SRC))
writer = PdfWriter()
for src_page in reader.pages:
    page = writer.add_blank_page(width=outer_w, height=outer_h)
    page.merge_transformed_page(src_page, Transformation().translate(bleed, bleed))
    page.merge_page(marks)
    page.trimbox.lower_left = (bleed, bleed)
    page.trimbox.upper_right = (bleed + trim_w, bleed + trim_h)
    page.bleedbox.lower_left = (0, 0)
    page.bleedbox.upper_right = (outer_w, outer_h)
    page.cropbox.lower_left = (0, 0)
    page.cropbox.upper_right = (outer_w, outer_h)
writer.add_metadata({
    "/Title": "Festschrift RGZV Hagen 125 Jahre 1903-2028 - Druckfassung",
    "/Subject": "A4 mit 3 mm Außenformat und Schnittmarken; PDF/X-Status nicht zertifiziert",
    "/Author": "Rassegeflügelzuchtverein Hagen und Umgebung seit 1903 e.V.",
})
with OUT.open("wb") as f:
    writer.write(f)
print(OUT)
