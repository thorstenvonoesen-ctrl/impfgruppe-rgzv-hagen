from pathlib import Path
from PIL import Image
import hashlib
from reportlab.pdfgen import canvas
from reportlab.lib.colors import CMYKColor, Color, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp" / "pdfs" / "beachflag"
OUT = ROOT / "output" / "pdf"
FINAL = OUT / "RGZV_Hagen_Beachflag_Druckdatei.pdf"
CONTROL = OUT / "RGZV_Hagen_Beachflag_Kontrollansicht.pdf"
TEMPLATE = TMP / "GIGABANNER_Bowflag_unten_gerade_XL_Vorlage.pdf"
LOGO = ROOT / "public" / "LogoTransparent.png"
LOGO_CMYK = TMP / "logo_cmyk.jpg"

# Exact page size from the official GIGABANNER XL template (92.6 x 398.6 cm).
W, H = 2624.882, 11298.897
RED = CMYKColor(0, 0.93, 0.82, 0.08)
DARK = CMYKColor(0, 0, 0, 0.94)


def register_fonts():
    pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
    pdfmetrics.registerFont(TTFont("ArialBold", r"C:\Windows\Fonts\arialbd.ttf"))
    pdfmetrics.registerFont(TTFont("Brush", r"C:\Windows\Fonts\BRUSHSCI.TTF"))


def flag_path(c):
    # Manufacturer print contour, transcribed from the official template.
    p = c.beginPath()
    p.moveTo(0, 0)
    p.lineTo(0, 8780.176)
    p.curveTo(0, 9009.080, 32.306, 9230.204, 96.018, 9437.408)
    p.curveTo(154.499, 9627.605, 240.672, 9810.132, 352.140, 9979.916)
    p.curveTo(543.936, 10272.052, 812.099, 10531.157, 1149.180, 10750.036)
    p.curveTo(1474.057, 10960.993, 1794.760, 11089.719, 2006.590, 11160.557)
    p.curveTo(2124.611, 11200.027, 2248.700, 11234.476, 2365.441, 11260.179)
    p.curveTo(2469.623, 11283.115, 2560.993, 11297.228, 2616.121, 11298.895)
    p.lineTo(2624.882, 11298.897)
    p.lineTo(2624.882, 0)
    p.close()
    return p


def prepare_logo():
    im = Image.open(LOGO).convert("RGBA")
    bg = Image.new("RGB", im.size, "white")
    bg.paste(im, mask=im.getchannel("A"))
    bg.convert("CMYK").save(LOGO_CMYK, quality=95, subsampling=0)


def feather(c, cx, cy, s):
    c.saveState(); c.translate(cx, cy); c.scale(s, s)
    c.setFillColor(RED); c.setStrokeColor(RED); c.setLineWidth(4)
    p = c.beginPath(); p.moveTo(-45,-55); p.curveTo(-15,-20,15,15,46,64); p.curveTo(20,62,-5,52,-25,32); p.curveTo(-44,12,-50,-20,-45,-55); p.close(); c.drawPath(p,1,0)
    c.setStrokeColor(white); c.setLineWidth(3); c.line(-35,-38,34,50)
    for y in (-20,0,20,38): c.line(-22+y*.15,y,20+y*.18,y+14)
    c.restoreState()


def people(c, cx, cy, s):
    c.saveState(); c.translate(cx,cy); c.scale(s,s); c.setFillColor(RED)
    for x,y,r in [(-28,22,17),(0,35,20),(28,22,17)]: c.circle(x,y,r,0,1)
    for x,w,h in [(-31,33,48),(0,42,60),(31,33,48)]:
        p=c.beginPath(); p.moveTo(x-w/2,-42); p.lineTo(x-w/2,-5); p.curveTo(x-w/2,12,x+w/2,12,x+w/2,-5); p.lineTo(x+w/2,-42); p.close(); c.drawPath(p,0,1)
    c.restoreState()


def cap(c, cx, cy, s):
    c.saveState(); c.translate(cx,cy); c.scale(s,s); c.setFillColor(RED); c.setStrokeColor(RED); c.setLineWidth(4)
    p=c.beginPath(); p.moveTo(-62,18); p.lineTo(0,50); p.lineTo(62,18); p.lineTo(0,-12); p.close(); c.drawPath(p,0,1)
    p=c.beginPath(); p.moveTo(-38,3); p.lineTo(-38,-27); p.curveTo(-15,-45,15,-45,38,-27); p.lineTo(38,3); p.lineTo(0,-16); p.close(); c.drawPath(p,0,1)
    c.line(58,17,58,-30); c.circle(58,-35,6,0,1); c.restoreState()


def handshake(c, cx, cy, s):
    c.saveState(); c.translate(cx,cy); c.scale(s,s); c.setFillColor(RED)
    p=c.beginPath(); p.moveTo(-68,20); p.lineTo(-38,50); p.lineTo(-8,30); p.lineTo(8,38); p.curveTo(20,45,31,38,42,28); p.lineTo(68,8); p.lineTo(28,-40); p.curveTo(19,-51,6,-52,-4,-42); p.lineTo(-21,-25); p.lineTo(-32,-34); p.curveTo(-42,-44,-54,-42,-62,-32); p.lineTo(-75,-18); p.lineTo(-52,8); p.close(); c.drawPath(p,0,1)
    c.setStrokeColor(white); c.setLineWidth(3); c.line(-4,-42,18,-18); c.line(-22,-27,2,-4); c.line(-39,-16,-14,8)
    c.restoreState()


def icon_circle(c, cy, fn):
    cx=440; r=185
    c.setStrokeColor(RED); c.setLineWidth(12); c.circle(cx,cy,r,1,0)
    fn(c,cx,cy,1.65)


def qr_vector(c, x, y, size):
    # Deliberately non-scannable vector placeholder. It must be replaced with a
    # genuine QR matrix as soon as the club supplies the definitive target URL.
    n=29; cell=size/n
    c.setFillColor(white); c.roundRect(x-22,y-22,size+44,size+44,18,0,1)
    c.setFillColor(DARK)
    digest=hashlib.sha256(b"RGZV-QR-PLATZHALTER").digest()
    def finder(r,c0):
        for rr in range(7):
            for cc in range(7):
                on=rr in (0,6) or cc in (0,6) or (2<=rr<=4 and 2<=cc<=4)
                if on: c.rect(x+(c0+cc)*cell,y+(n-(r+rr)-1)*cell,cell+.2,cell+.2,0,1)
    finder(0,0); finder(0,n-7); finder(n-7,0)
    for row in range(n):
        for col in range(n):
            if (row<8 and col<8) or (row<8 and col>=n-8) or (row>=n-8 and col<8): continue
            bit=(digest[(row*n+col)//8 % len(digest)] >> ((row*n+col)%8)) & 1
            if bit: c.rect(x+col*cell,y+(n-row-1)*cell,cell+.2,cell+.2,0,1)


def draw_design(path):
    c=canvas.Canvas(str(path), pagesize=(W,H), pageCompression=1)
    c.saveState(); c.clipPath(flag_path(c),0,0)
    c.setFillColor(white); c.rect(0,0,W,H,0,1)

    # Upper red head and white/red accent sweep.
    c.setFillColor(RED)
    p=c.beginPath(); p.moveTo(0,11299); p.lineTo(W,11299); p.lineTo(W,10560); p.curveTo(1800,10610,1050,10320,280,9650); p.curveTo(130,9500,55,9360,0,9230); p.close(); c.drawPath(p,0,1)
    c.setStrokeColor(white); c.setLineWidth(58)
    p=c.beginPath(); p.moveTo(45,9300); p.curveTo(580,10000,1450,10535,2620,10720); c.drawPath(p,1,0)
    c.setStrokeColor(RED); c.setLineWidth(28)
    p=c.beginPath(); p.moveTo(80,9240); p.curveTo(650,9930,1430,10390,2590,10600); c.drawPath(p,1,0)

    # Club logo in the highest available original quality.
    c.drawImage(ImageReader(str(LOGO_CMYK)), 275, 7780, width=2075, height=876, preserveAspectRatio=True, mask=None)
    c.setStrokeColor(RED); c.setLineWidth(11); c.line(310,7680,2315,7680)

    rows=[
        (7180,"Zucht","Erhalt der Rassenvielfalt",feather),
        (6580,"Ausstellungen","Begegnung und Erfahrung",people),
        (5980,"Jugendarbeit","Wissen weitergeben",cap),
        (5380,"Gemeinschaft","Generationen verbinden",handshake),
    ]
    for cy,title,sub,fn in rows:
        icon_circle(c,cy,fn)
        c.setFillColor(DARK); c.setFont("ArialBold",138); c.drawString(720,cy+35,title)
        c.setFont("Arial",88); c.drawString(720,cy-105,sub)

    # Lower wave, white separator and red base.
    c.setFillColor(RED)
    p=c.beginPath(); p.moveTo(0,0); p.lineTo(W,0); p.lineTo(W,4300); p.curveTo(2200,3750,1570,3380,650,3190); p.curveTo(360,3130,160,3050,0,2960); p.close(); c.drawPath(p,0,1)
    c.setStrokeColor(white); c.setLineWidth(65)
    p=c.beginPath(); p.moveTo(-40,3160); p.curveTo(700,3480,1680,3540,2660,4510); c.drawPath(p,1,0)

    c.setFillColor(white); c.setFont("Brush",190); c.drawCentredString(760,2450,"Mitglied")
    c.drawCentredString(820,2205,"werden!")
    c.setStrokeColor(white); c.setLineWidth(18)
    p=c.beginPath(); p.moveTo(720,1960); p.curveTo(820,1800,1040,1770,1190,1890); c.drawPath(p,1,0)
    c.line(1190,1890,1115,1910); c.line(1190,1890,1170,1815)

    qr_vector(c,1510,1745,610)
    c.setFillColor(white)
    c.setFont("ArialBold",62); c.drawCentredString(1815,1640,"QR-PLATZHALTER")
    c.setFont("Arial",76); c.drawCentredString(1815,1500,"Zum Aufnahmeantrag")

    c.setLineWidth(18); c.line(825,810,1800,810)
    c.setFont("ArialBold",100); c.drawCentredString(1312,500,"www.rgzv-hagen-westfalen.com")
    c.restoreState(); c.showPage(); c.save()


def make_control():
    guide_pdf=TMP / "control-guides.pdf"
    g=canvas.Canvas(str(guide_pdf),pagesize=(W,H),pageCompression=1)
    # Cut contour in magenta.
    g.setStrokeColor(CMYKColor(0,1,0,0)); g.setLineWidth(7)
    g.drawPath(flag_path(g),1,0)
    # Approximate inner manufacturer safety boundary (6.3 cm inset).
    g.setStrokeColor(CMYKColor(.55,0,0,0)); g.setLineWidth(7); g.setDash(28,18)
    p=g.beginPath(); p.moveTo(178.583,178.583); p.lineTo(178.583,8620)
    p.curveTo(178.583,9000,310,9360,550,9690)
    p.curveTo(920,10200,1540,10720,2446.299,11080)
    p.lineTo(2446.299,178.583); p.close(); g.drawPath(p,1,0)
    g.setDash(); g.setFillColor(CMYKColor(0,0,0,0.85)); g.setFont("ArialBold",44)
    g.drawString(260,235,"MAGENTA = Schnittkontur   BLAU = Sicherheitsbereich")
    g.showPage(); g.save()
    design=PdfReader(str(FINAL)).pages[0]
    guide=PdfReader(str(guide_pdf)).pages[0]
    design.merge_page(guide)
    writer=PdfWriter(); writer.add_page(design)
    writer.add_metadata({"/Title":"RGZV Hagen Beachflag - Kontrollansicht mit Herstellerkontur"})
    with CONTROL.open("wb") as f: writer.write(f)


def main():
    TMP.mkdir(parents=True,exist_ok=True); OUT.mkdir(parents=True,exist_ok=True)
    register_fonts(); prepare_logo(); draw_design(FINAL); make_control()
    print(FINAL); print(CONTROL)


if __name__ == "__main__": main()
