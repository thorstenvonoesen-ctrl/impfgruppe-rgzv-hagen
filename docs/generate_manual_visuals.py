from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets" / "manual-v2"

BG = "#102b23"
BG_2 = "#163a2f"
PANEL = "#203d34"
WHITE = "#fff8ed"
MUTED = "#bdd0c8"
ORANGE = "#f28c28"
GREEN = "#2fa66a"
LINE = "#416359"
LIGHT = "#f7faf8"
TEXT = "#263b33"


def font(size, bold=False):
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


F12 = font(12)
F14 = font(14)
F16 = font(16)
F16B = font(16, True)
F18B = font(18, True)
F22B = font(22, True)
F30B = font(30, True)
F40B = font(40, True)


def rounded(draw, xy, fill=PANEL, outline=LINE, radius=18, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, fill=WHITE, f=F16, anchor=None):
    draw.text(xy, value, fill=fill, font=f, anchor=anchor)


def wrap(draw, value, width, f=F16):
    words = value.split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=f) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def save_crop(source, target, box):
    image = Image.open(ASSETS / source).convert("RGB")
    image.crop(box).save(ASSETS / target, quality=94)


def dashboard_overview():
    image = Image.new("RGB", (1400, 900), BG)
    draw = ImageDraw.Draw(image)
    text(draw, (55, 38), "Adminbereich", f=F40B)
    rounded(draw, (1010, 30, 1345, 92), fill="#29483e")
    text(draw, (1040, 54), "Adminverwaltung     Abmelden", f=F16B)
    rounded(draw, (55, 115, 850, 225), fill="#1a4937")
    text(draw, (82, 142), "Administratorstatus", fill=MUTED, f=F14)
    text(draw, (82, 176), "● Thorsten - online       ○ Bernd - zuletzt online vor 12 Minuten", f=F16B)
    stats = [("Teilnehmer", "48"), ("Tiere", "326"), ("Einnahmen", "672,00 EUR")]
    for index, (label, value) in enumerate(stats):
        x = 55 + index * 440
        rounded(draw, (x, 250, x + 410, 370), fill="#f8fbf9", outline="#d6e5df")
        draw.ellipse((x + 24, 278, x + 70, 324), fill=ORANGE)
        text(draw, (x + 92, 274), label, fill="#667b72", f=F14)
        text(draw, (x + 92, 304), value, fill=TEXT, f=F30B)
    rounded(draw, (55, 398, 660, 585), fill="#15382e")
    text(draw, (82, 425), "INTELLIGENTE VEREINS-AMPEL", fill="#86efac", f=F12)
    text(draw, (82, 462), "Alles in Ordnung", f=F30B)
    text(draw, (82, 510), "Aktuell besteht kein Handlungsbedarf.", fill=MUTED, f=F16)
    rounded(draw, (690, 398, 1345, 585), fill="#243c35")
    text(draw, (720, 425), "AUTOMATISCHE AUSWERTUNG", fill="#fdba74", f=F12)
    text(draw, (720, 462), "Saisonkampagne 2026", f=F22B)
    for idx, (label, value) in enumerate([("Versendet", "84"), ("Rückkehrer", "51"), ("Offen", "33"), ("Quote", "61 %")]):
        x = 720 + idx * 150
        rounded(draw, (x, 505, x + 135, 560), fill="#304c43", outline="#4f6c62", radius=10)
        text(draw, (x + 10, 515), label, fill=MUTED, f=F12)
        text(draw, (x + 10, 535), value, f=F18B)
    rounded(draw, (55, 615, 920, 842), fill=LIGHT, outline="#d6e5df")
    text(draw, (82, 642), "Teilnehmer-Check-in am Impftermin", fill=TEXT, f=F22B)
    text(draw, (82, 685), "Impftermin auswählen", fill="#667b72", f=F14)
    rounded(draw, (82, 715, 510, 765), fill="white", outline="#c7d8d1", radius=10)
    text(draw, (100, 731), "Name, E-Mail, Telefon oder TSK suchen...", fill="#879990", f=F14)
    rounded(draw, (530, 715, 780, 765), fill=ORANGE, outline=ORANGE, radius=10)
    text(draw, (655, 740), "QR-Code scannen", f=F16B, anchor="mm")
    rounded(draw, (950, 615, 1345, 842), fill=LIGHT, outline="#d6e5df")
    text(draw, (978, 642), "Anmeldungen pro Impftermin", fill=TEXT, f=F18B)
    for idx, (name, count) in enumerate([("Frühjahrstermin", "28"), ("Sommertermin", "20")]):
        y = 690 + idx * 68
        rounded(draw, (978, y, 1318, y + 52), fill="white", outline="#dbe7e2", radius=10)
        text(draw, (994, y + 10), name, fill=TEXT, f=F14)
        text(draw, (1295, y + 26), count, fill=GREEN, f=F18B, anchor="rm")
    image.save(ASSETS / "admin-dashboard.png", quality=94)


def participant_view():
    image = Image.new("RGB", (1400, 760), BG)
    draw = ImageDraw.Draw(image)
    rounded(draw, (45, 38, 1355, 720), fill=LIGHT, outline="#d6e5df")
    text(draw, (75, 68), "Teilnehmerverwaltung", fill=TEXT, f=F30B)
    rounded(draw, (75, 125, 630, 178), fill="white", outline="#cbdad4", radius=11)
    text(draw, (95, 143), "Suchen...", fill="#82948c", f=F16)
    rounded(draw, (655, 125, 875, 178), fill="white", outline="#cbdad4", radius=11)
    text(draw, (675, 143), "Alle Zahlungen", fill=TEXT, f=F16)
    headers = ["Name", "Kontakt", "Tiere", "Termin", "Zahlung", "Aktionen"]
    widths = [190, 260, 180, 210, 155, 250]
    x = 75
    for header, width in zip(headers, widths):
        text(draw, (x + 8, 220), header.upper(), fill="#687b73", f=F12)
        x += width
    rows = [
        ["Anna Beispiel", "anna@example.de", "12 Hühner", "Frühjahr", "Bezahlt", "Offen  Bearbeiten  E-Mail"],
        ["Max Muster", "max@example.de", "8 Zwerghühner", "Frühjahr", "Offen · Bar", "Bezahlt  Bearbeiten  E-Mail"],
        ["Eva Demo", "eva@example.de", "4 Puten", "Sommer", "Bezahlt", "Offen  Bearbeiten  E-Mail"],
    ]
    y = 255
    for row in rows:
        draw.line((75, y, 1320, y), fill="#dbe7e2", width=1)
        x = 75
        for value, width in zip(row, widths):
            for line_index, line in enumerate(wrap(draw, value, width - 14, F14)[:2]):
                text(draw, (x + 8, y + 17 + line_index * 18), line, fill=TEXT, f=F14)
            x += width
        y += 115
    rounded(draw, (75, 625, 250, 677), fill=ORANGE, outline=ORANGE, radius=10)
    text(draw, (162, 651), "PDF / CSV Export", f=F14, anchor="mm")
    image.save(ASSETS / "admin-teilnehmer.png", quality=94)


def appointment_view():
    image = Image.new("RGB", (1400, 760), BG)
    draw = ImageDraw.Draw(image)
    rounded(draw, (45, 38, 1355, 720), fill=LIGHT, outline="#d6e5df")
    text(draw, (75, 68), "Impftermin anlegen und verwalten", fill=TEXT, f=F30B)
    fields = [("Titel des Impftermins", 75, 130, 620), ("Datum", 650, 130, 930), ("Hinweis (optional)", 960, 130, 1320)]
    for label, x1, y1, x2 in fields:
        text(draw, (x1, y1 - 24), label, fill="#60746b", f=F14)
        rounded(draw, (x1, y1, x2, y1 + 50), fill="white", outline="#cbdad4", radius=10)
    text(draw, (75, 225), "Adresse und öffentlicher Routenhinweis", fill=TEXT, f=F18B)
    rounded(draw, (75, 260, 1130, 312), fill="white", outline="#cbdad4", radius=10)
    rounded(draw, (1150, 260, 1320, 312), fill=ORANGE, outline=ORANGE, radius=10)
    text(draw, (1235, 286), "Speichern", f=F16B, anchor="mm")
    cards = [("ND-Impfung Frühjahr", "15.03.2027", "Saisonerinnerung: erfolgreich versendet"), ("ND-Impfung Sommer", "12.07.2027", "Saisonerinnerung: noch nicht versendet")]
    y = 355
    for title, date, status in cards:
        rounded(draw, (75, y, 1320, y + 135), fill="white", outline="#dbe7e2", radius=14)
        text(draw, (98, y + 22), title, fill=TEXT, f=F18B)
        text(draw, (98, y + 50), date, fill="#687b73", f=F14)
        text(draw, (98, y + 79), status, fill=GREEN, f=F12)
        buttons = ["Bearbeiten", "Route", "PDF", "Kassenbericht", "E-Mail", "Saisonmail", "Tierarzt", "Löschen"]
        bx = 490
        for button in buttons:
            width = max(78, int(draw.textlength(button, font=F12)) + 24)
            rounded(draw, (bx, y + 43, bx + width, y + 82), fill=BG_2, outline=BG_2, radius=8)
            text(draw, (bx + width / 2, y + 62), button, f=F12, anchor="mm")
            bx += width + 8
    image.save(ASSETS / "admin-termine.png", quality=94)


def admin_management_view():
    image = Image.new("RGB", (1400, 760), "#0c211a")
    draw = ImageDraw.Draw(image)
    rounded(draw, (95, 55, 1305, 705), fill=LIGHT, outline="#d6e5df", radius=24)
    text(draw, (130, 88), "Adminverwaltung", fill=TEXT, f=F30B)
    rounded(draw, (930, 78, 1160, 128), fill=ORANGE, outline=ORANGE, radius=10)
    text(draw, (1045, 103), "Neuen Administrator anlegen", f=F14, anchor="mm")
    rounded(draw, (1175, 78, 1270, 128), fill="white", outline="#cbdad4", radius=10)
    text(draw, (1222, 103), "Schließen", fill=TEXT, f=F14, anchor="mm")
    headers = ["E-Mail-Adresse", "Verein", "Rolle", "Status", "Erstellt", "Aktionen"]
    x_positions = [130, 360, 555, 700, 790, 920]
    for header, x in zip(headers, x_positions):
        text(draw, (x, 180), header.upper(), fill="#6a7c74", f=F12)
    rows = [
        ["admin@example.de", "Musterverein", "Superadmin", "Aktiv", "24.07.2026"],
        ["impfwart@example.de", "Musterverein", "Check-in-Admin", "Aktiv", "25.07.2026"],
        ["kasse@example.de", "Musterverein", "Vereinsadmin", "Gesperrt", "25.07.2026"],
    ]
    y = 215
    for row in rows:
        draw.line((130, y, 1270, y), fill="#dbe7e2")
        for value, x in zip(row, x_positions):
            text(draw, (x, y + 27), value, fill=TEXT, f=F14)
        buttons = ["Details", "Rolle", "Sperren", "Löschen"]
        bx = 920
        for button in buttons:
            rounded(draw, (bx, y + 12, bx + 78, y + 50), fill=BG_2, outline=BG_2, radius=8)
            text(draw, (bx + 39, y + 31), button, f=F12, anchor="mm")
            bx += 84
        y += 120
    rounded(draw, (130, 595, 760, 665), fill="#edf8f2", outline="#b7d9c8", radius=12)
    text(draw, (150, 612), "Online-Status", fill=TEXT, f=F16B)
    text(draw, (150, 640), "● Admin Beispiel - online    ○ Impfwart - zuletzt online vor 8 Minuten", fill="#376b51", f=F14)
    image.save(ASSETS / "adminverwaltung.png", quality=94)


def mobile_install_view(platform):
    image = Image.new("RGB", (1000, 720), "#eef3f1")
    draw = ImageDraw.Draw(image)
    title = "Android - Chrome" if platform == "android" else "iPhone / iPad - Safari"
    text(draw, (55, 42), title, fill=TEXT, f=F30B)
    phone = (85, 105, 430, 665)
    rounded(draw, phone, fill="#101d19", outline="#3b4b45", radius=38, width=3)
    rounded(draw, (105, 150, 410, 625), fill="white", outline="white", radius=12)
    text(draw, (125, 175), "Impfgruppenmanager", fill=TEXT, f=F16B)
    if platform == "android":
        text(draw, (375, 175), "⋮", fill=TEXT, f=F30B, anchor="mm")
        items = ["Neuer Tab", "Teilen...", "Zum Startbildschirm hinzufügen", "Desktopwebsite"]
        y = 235
        for item in items:
            if "Startbildschirm" in item:
                rounded(draw, (120, y - 8, 395, y + 35), fill="#fff0df", outline="#fac48d", radius=8)
            text(draw, (135, y), item, fill=TEXT, f=F14)
            y += 62
    else:
        text(draw, (258, 580), "□↑", fill="#2563eb", f=F22B, anchor="mm")
        rounded(draw, (120, 225, 395, 520), fill="#f7f8fa", outline="#d7dce0", radius=18)
        items = ["Kopieren", "Zu Leseliste", "Zum Home-Bildschirm", "Seite suchen"]
        y = 260
        for item in items:
            if "Home" in item:
                rounded(draw, (132, y - 8, 383, y + 34), fill="#e8f1ff", outline="#b7d1fa", radius=8)
            text(draw, (150, y), item, fill=TEXT, f=F14)
            y += 62
    steps = [
        "1. Browser öffnen und Webseite aufrufen.",
        "2. Browsermenü beziehungsweise Teilen öffnen.",
        "3. Markierten Eintrag auswählen.",
        "4. Namen prüfen und Hinzufügen bestätigen.",
        "5. Symbol anschließend vom Startbildschirm öffnen.",
    ]
    text(draw, (500, 135), "Schritt für Schritt", fill=TEXT, f=F22B)
    y = 190
    for step in steps:
        rounded(draw, (500, y, 930, y + 62), fill="white", outline="#d5e1dc", radius=12)
        text(draw, (520, y + 21), step, fill=TEXT, f=F14)
        y += 82
    text(draw, (500, 620), "Hinweis: Für die Nutzung wird weiterhin eine Internetverbindung benötigt.", fill="#a05518", f=F14)
    image.save(ASSETS / f"installation-{platform}.png", quality=94)


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    save_crop("anmeldung.png", "anmeldung-stammdaten.png", (100, 300, 1165, 1510))
    save_crop("anmeldung.png", "anmeldung-zahlung.png", (100, 1450, 1165, 2630))
    save_crop("informationsseite.png", "informationsseite-kompakt.png", (40, 100, 1225, 1400))
    dashboard_overview()
    participant_view()
    appointment_view()
    admin_management_view()
    mobile_install_view("android")
    mobile_install_view("ios")
    save_crop("admin-dashboard.png", "admin-dashboard-status.png", (45, 25, 1355, 235))
    save_crop("admin-dashboard.png", "admin-dashboard-ampel.png", (45, 380, 675, 600))
    save_crop("admin-dashboard.png", "admin-dashboard-saison.png", (680, 380, 1355, 600))
    save_crop("admin-dashboard.png", "admin-dashboard-checkin.png", (45, 600, 930, 900))
    save_crop("admin-termine.png", "admin-termine-aktionen.png", (60, 330, 1340, 640))
    save_crop("adminverwaltung.png", "adminverwaltung-kopf.png", (80, 40, 1315, 210))
    save_crop("adminverwaltung.png", "adminverwaltung-aktionen.png", (100, 175, 1290, 590))
    save_crop("admin-teilnehmer.png", "admin-teilnehmer-liste.png", (55, 105, 1335, 620))
    print(f"Visual assets written to {ASSETS}")


if __name__ == "__main__":
    main()
