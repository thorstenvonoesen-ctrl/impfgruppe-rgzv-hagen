from __future__ import annotations

from datetime import date
from hashlib import md5
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"
SCREENSHOT_DIR = ROOT / "docs" / "assets" / "manual"
PDF_PATH = OUTPUT_DIR / "Bedienungsanleitung-Impfgruppenmanager.pdf"
MD_PATH = OUTPUT_DIR / "Bedienungsanleitung-Impfgruppenmanager.md"
LOGO_PATH = ROOT / "public" / "Logoklein.jpg"
CREATED = date(2026, 7, 25)

DARK = colors.HexColor("#163a2f")
DARKER = colors.HexColor("#102b23")
ORANGE = colors.HexColor("#f28c28")
CREAM = colors.HexColor("#fff8f1")
TEXT = colors.HexColor("#263238")
MUTED = colors.HexColor("#64748b")
LINE = colors.HexColor("#d7e0dc")
GREEN = colors.HexColor("#2f855a")
YELLOW = colors.HexColor("#d69e2e")
RED = colors.HexColor("#c53030")
LIGHT_GREEN = colors.HexColor("#edf8f2")
LIGHT_YELLOW = colors.HexColor("#fff9e6")
LIGHT_RED = colors.HexColor("#fff1f1")


def register_fonts() -> None:
    candidates = [
        (
            Path("C:/Windows/Fonts/arial.ttf"),
            Path("C:/Windows/Fonts/arialbd.ttf"),
            Path("C:/Windows/Fonts/ariali.ttf"),
        ),
        (
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"),
        ),
    ]
    for regular, bold, italic in candidates:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont("Manual", str(regular)))
            pdfmetrics.registerFont(TTFont("Manual-Bold", str(bold)))
            pdfmetrics.registerFont(TTFont("Manual-Italic", str(italic if italic.exists() else regular)))
            return
    raise RuntimeError("Keine geeignete TrueType-Schrift gefunden.")


register_fonts()

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="ManualBody", fontName="Manual", fontSize=9.4, leading=13.6,
    textColor=TEXT, spaceAfter=7,
))
styles.add(ParagraphStyle(
    name="ManualSmall", fontName="Manual", fontSize=7.8, leading=10.5,
    textColor=MUTED, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="ManualH1", fontName="Manual-Bold", fontSize=21, leading=25,
    textColor=DARK, spaceBefore=4, spaceAfter=13, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="ManualH2", fontName="Manual-Bold", fontSize=13.5, leading=17,
    textColor=DARK, spaceBefore=11, spaceAfter=7, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="ManualH3", fontName="Manual-Bold", fontSize=10.5, leading=13.5,
    textColor=ORANGE, spaceBefore=7, spaceAfter=4, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="ManualBullet", parent=styles["ManualBody"], leftIndent=13,
    firstLineIndent=-7, bulletIndent=4, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="ManualStep", parent=styles["ManualBody"], leftIndent=20,
    firstLineIndent=-14, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="ManualCaption", fontName="Manual-Italic", fontSize=7.5, leading=10,
    textColor=MUTED, alignment=TA_CENTER, spaceBefore=4, spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="CoverTitle", fontName="Manual-Bold", fontSize=31, leading=35,
    textColor=colors.white, alignment=TA_LEFT, spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="CoverSubtitle", fontName="Manual", fontSize=16, leading=21,
    textColor=colors.HexColor("#fed7aa"), alignment=TA_LEFT, spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="CoverText", fontName="Manual", fontSize=10, leading=15,
    textColor=colors.HexColor("#e8f3ef"), alignment=TA_LEFT,
))
styles.add(ParagraphStyle(
    name="TOCHeading", fontName="Manual-Bold", fontSize=20, leading=24,
    textColor=DARK, spaceAfter=14,
))


class ManualDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=20 * mm,
            bottomMargin=18 * mm,
            title="Bedienungsanleitung Impfgruppenmanager",
            author="RGZV Hagen und Umgebung seit 1903 e.V.",
        )
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="normal",
        )
        self.addPageTemplates(PageTemplate(id="manual", frames=frame, onPage=self.draw_page))

    def draw_page(self, canvas, doc):
        if doc.page == 1:
            return
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(18 * mm, A4[1] - 13 * mm, A4[0] - 18 * mm, A4[1] - 13 * mm)
        canvas.setFont("Manual", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, A4[1] - 10 * mm, "Impfgruppenmanager - Bedienungsanleitung")
        canvas.drawRightString(A4[0] - 18 * mm, A4[1] - 10 * mm, "RGZV Hagen")
        canvas.line(18 * mm, 12 * mm, A4[0] - 18 * mm, 12 * mm)
        canvas.drawString(18 * mm, 8 * mm, f"Stand: {CREATED.strftime('%d.%m.%Y')}")
        canvas.drawRightString(A4[0] - 18 * mm, 8 * mm, f"Seite {doc.page}")
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == "ManualH1":
            text = flowable.getPlainText()
            key = f"chapter-{md5(text.encode('utf-8')).hexdigest()[:12]}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=0, closed=False)
            self.notify("TOCEntry", (0, text, self.page, key))


def p(text: str, style: str = "ManualBody") -> Paragraph:
    return Paragraph(text, styles[style])


def heading(text: str, level: int = 1) -> Paragraph:
    return p(text, "ManualH1" if level == 1 else "ManualH2" if level == 2 else "ManualH3")


def bullet(text: str) -> Paragraph:
    return Paragraph(f"• {text}", styles["ManualBullet"])


def bullets(items: list[str]) -> list[Paragraph]:
    return [bullet(item) for item in items]


def steps(items: list[str]) -> list[Paragraph]:
    return [
        Paragraph(f"<b>{index}.</b> {item}", styles["ManualStep"])
        for index, item in enumerate(items, 1)
    ]


def note(title: str, text: str, kind: str = "info"):
    palette = {
        "info": (CREAM, ORANGE),
        "success": (LIGHT_GREEN, GREEN),
        "warning": (LIGHT_YELLOW, YELLOW),
        "danger": (LIGHT_RED, RED),
    }
    background, accent = palette[kind]
    table = Table(
        [[
            Paragraph(f"<b>{escape(title)}</b><br/>{text}", styles["ManualBody"])
        ]],
        colWidths=[166 * mm],
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.7, accent),
        ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return KeepTogether([table, Spacer(1, 6)])


def data_table(headers: list[str], rows: list[list[str]], widths=None):
    data = [[p(f"<b>{escape(str(value))}</b>", "ManualSmall") for value in headers]]
    for row in rows:
        data.append([p(str(value), "ManualSmall") for value in row])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7faf9")]),
    ]))
    return table


def screenshot(filename: str, caption: str, max_height: float = 105 * mm):
    path = SCREENSHOT_DIR / filename
    if not path.exists():
        return note("Screenshot nicht verfügbar", caption, "warning")
    with PILImage.open(path) as image:
        width, height = image.size
    max_width = 166 * mm
    scale = min(max_width / width, max_height / height)
    rendered = Image(str(path), width=width * scale, height=height * scale)
    rendered.hAlign = "CENTER"
    return KeepTogether([
        rendered,
        p(caption, "ManualCaption"),
    ])


def page_break():
    return PageBreak()


def cover_story():
    logo = Image(str(LOGO_PATH), width=39 * mm, height=39 * mm)
    logo.hAlign = "LEFT"
    content = Table(
        [[
            [
                logo,
                Spacer(1, 12 * mm),
                p("Impfgruppenmanager", "CoverTitle"),
                p("Bedienungsanleitung", "CoverSubtitle"),
                Spacer(1, 3 * mm),
                p("RGZV Hagen und Umgebung seit 1903 e.V.", "CoverText"),
                Spacer(1, 3 * mm),
                p(f"Erstellungsdatum: {CREATED.strftime('%d.%m.%Y')}", "CoverText"),
                p("Erstellt auf Grundlage des aktuellen Programmstands", "CoverText"),
                Spacer(1, 35 * mm),
                p("Für Vereinsadministratoren, Vorstand und Impfwart", "CoverText"),
            ]
        ]],
        colWidths=[166 * mm],
        rowHeights=[240 * mm],
    )
    content.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DARKER),
        ("LEFTPADDING", (0, 0), (-1, -1), 20 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 22 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 15 * mm),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 2, ORANGE),
    ]))
    return [content, PageBreak()]


def build_story():
    story = cover_story()
    story.append(p("Inhaltsverzeichnis", "TOCHeading"))
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle(
            name="TOCLevel1", fontName="Manual", fontSize=9.5, leading=15,
            leftIndent=0, firstLineIndent=0, textColor=TEXT,
            spaceBefore=2,
        )
    ]
    story.extend([toc, PageBreak()])

    story.extend([
        heading("1. Einführung"),
        p("Der Impfgruppenmanager unterstützt den RGZV Hagen bei der Organisation von Newcastle-Sammelimpfungen. Teilnehmer melden ihren Bestand online an, wählen Termin und Impfstoff, bezahlen digital und erhalten nach erfolgreicher Zahlung einen persönlichen QR-Code für den Check-in."),
        p("Der geschützte Adminbereich bündelt Termine, Teilnehmer, Zahlungen, Check-in, PDF-Berichte, Tierarztunterlagen und saisonale Erinnerungen. Die Anleitung richtet sich an Teilnehmer, Vereinsadministratoren, Vorstand und Impfwart."),
        heading("Grundlegender Ablauf", 2),
        *steps([
            "Der Verein veröffentlicht einen regulären Impftermin.",
            "Der Teilnehmer öffnet die Anmeldung, erfasst seine Daten und wählt Tierart, Tierzahl, Impfstoff und Termin.",
            "Nach dem Absenden wird die Anmeldung gespeichert und zur gewählten Onlinezahlung weitergeleitet.",
            "Nach bestätigter Zahlung wird der Datensatz als bezahlt markiert und die Zahlungsbestätigung mit eingebettetem QR-Code versendet.",
            "Am Impftag scannt ein berechtigter Administrator den QR-Code und bestätigt den Check-in.",
            "Der Verein erstellt Teilnehmerlisten, Kassenbericht und Sammelimpfbescheinigung.",
        ]),
        heading("Teilnehmerbereich und Adminbereich", 2),
        data_table(
            ["Bereich", "Zweck", "Zugriff"],
            [
                ["Öffentlicher Bereich", "Information, Anmeldung, Zahlung und rechtliche Seiten", "Ohne Admin-Anmeldung"],
                ["Adminbereich", "Verwaltung, Auswertung, Check-in und Exporte", "PIN, Supabase-Anmeldung und aktive Vereinsrolle"],
            ],
            [37 * mm, 82 * mm, 47 * mm],
        ),
        note("Onlinebetrieb erforderlich", "Die produktive Anwendung benötigt eine konfigurierte Datenbank- und Serververbindung. Ein nutzbarer Offline-Modus ist im aktuellen Programmstand nicht vorhanden.", "warning"),
        page_break(),

        heading("2. Rollen und Berechtigungen"),
        data_table(
            ["Rolle", "Sicht und Aufgaben", "Zugriff auf Daten"],
            [
                ["Teilnehmer", "Öffentliche Informationen, eigene Anmeldung und Zahlung", "Nur selbst eingegebene Daten und eigene Zahlungsrückkehr"],
                ["Clubadmin", "Dashboard, Teilnehmer, Termine, Zahlungen, PDFs, Check-in, Saison- und Tierarztfunktionen", "Nur Daten des zugeordneten Vereins"],
                ["Superadmin", "Serverseitig für vereinsübergreifende Berechtigungen vorgesehen", "Nur nach gültiger Rollenprüfung; die aktuelle Oberfläche besitzt keinen produktiven Vereinswechsler"],
            ],
            [31 * mm, 81 * mm, 54 * mm],
        ),
        heading("Anmeldung und Schutz", 2),
        p("Der Admin-Login besteht aus einer zusätzlichen Admin-PIN, E-Mail und Passwort. Nach erfolgreicher Supabase-Anmeldung muss für das Konto eine aktive Rolle in der Vereinszuordnung hinterlegt sein. Ohne gültige Rolle wird das Dashboard nicht geöffnet."),
        *bullets([
            "Teilnehmerdaten sind durch vereinsbezogene Datenbankregeln geschützt.",
            "Zahlungsstatus, QR-Check-in und sensible Mailvorgänge werden serverseitig verarbeitet.",
            "QR-Codes werden nur gegen den ausgewählten Termin und den zugehörigen Verein geprüft.",
        ]),
        note("Rollenhinweis", "Die Rolle „checkin_admin“ ist technisch vorbereitet. Eine eigenständige, auf Check-in reduzierte Oberfläche ist im aktuellen Stand nicht umgesetzt und wird daher nicht als eigener Bedienablauf beschrieben.", "warning"),

        heading("3. Öffentliche Startseite"),
        p("Die Startseite zeigt den Zweck der Anwendung, den nächsten Impftermin, den Countdown, öffentlich freigegebene Ortsinformationen, Anmeldestatistiken und Vorteile der digitalen Anmeldung."),
        *steps([
            "Öffnen Sie die Vereinsadresse beziehungsweise wählen Sie den gewünschten Verein auf der öffentlichen Seite.",
            "Prüfen Sie den nächsten Termin und gegebenenfalls Route und Wettervorschau.",
            "Öffnen Sie „Zur Impfanmeldung“, um zur Informations- beziehungsweise Anmeldeseite zu gelangen.",
            "Administratoren wählen oben „Admin-Login“.",
        ]),
        screenshot("startseite.jpg", "Abbildung 1: Öffentliche Startseite. Die lokale Dokumentationsumgebung zeigt keine echten Teilnehmer- oder Termindaten.", 100 * mm),
        heading("Informationsseite", 2),
        p("Die vorgeschaltete Informationsseite erklärt den Ablauf Anmeldung, Zahlung, QR-Code, Check-in und Impfung. Vier Informationskarten führen zu Hintergründen über Tiergesundheit, Impfpflicht, Sammelimpfung und digitalen Check-in."),
        screenshot("informationsseite.jpg", "Abbildung 2: Informationsseite mit dem digitalen Ablauf.", 98 * mm),
        page_break(),

        heading("4. Anmeldung zu einem Impftermin"),
        p("Die Anmeldung ist verbindlich. Pflichtfelder sind in der Oberfläche gekennzeichnet; ohne Datenschutzbestätigung wird das Formular nicht abgesendet."),
        heading("Schritt für Schritt", 2),
        *steps([
            "<b>Persönliche Daten:</b> Vorname, Nachname, Anschrift, E-Mail und optional Telefonnummer eingeben.",
            "<b>Tierhalterdaten:</b> TSK-Betriebsnummer und optional den Mitgliedscode eintragen.",
            "<b>Bestand:</b> Tierart, Tierzahl und Impfstoff auswählen.",
            "<b>Termin:</b> einen veröffentlichten Impftermin wählen.",
            "<b>Datenschutz:</b> Datenschutzerklärung lesen und Kontrollkästchen aktivieren.",
            "<b>Zahlung:</b> PayPal oder Stripe-basierte Kartenzahlung auswählen.",
            "<b>Absenden:</b> „Anmelden & bezahlen“ wählen und die Zahlung beim Zahlungsanbieter abschließen.",
        ]),
        screenshot("anmeldung.jpg", "Abbildung 3: Beginn des öffentlichen Anmeldeformulars. Es wurden keine personenbezogenen Daten eingetragen.", 96 * mm),
        heading("Feldübersicht", 2),
        data_table(
            ["Feldgruppe", "Angaben", "Hinweis"],
            [
                ["Kontakt", "Name, Anschrift, E-Mail, Telefon", "E-Mail ist für Zahlung und QR-Code wichtig"],
                ["Tierhalter", "TSK-Betriebsnummer, Mitgliedscode", "Mitgliedscode steuert den vergünstigten Preis"],
                ["Impfung", "Tierart, Anzahl, Impfstoff, Termin", "Diese Werte müssen bei jeder Anmeldung neu gewählt werden"],
                ["Rechtliches", "Datenschutzbestätigung", "Ohne Zustimmung kein Absenden"],
            ],
            [32 * mm, 77 * mm, 57 * mm],
        ),
        note("Teilnahmegebühr", "Mit der verbindlichen Anmeldung wird der Teilnahmeplatz reserviert. Der in der Anwendung angezeigte Hinweis zur möglichen Nichterstattung ist vor dem Absenden zu beachten.", "warning"),

        heading("5. Wiederkehrende Teilnehmer"),
        p("Beim Verlassen des E-Mail-Felds prüft die Anwendung in einem ersten Schritt, ob für dieselbe normalisierte E-Mail-Adresse beim gleichen Verein eine frühere Anmeldung vorhanden ist. Es werden zu diesem Zeitpunkt noch keine Stammdaten ausgegeben."),
        p("Wird ein Treffer gefunden, entscheidet der Teilnehmer ausdrücklich, ob die zuletzt verwendeten Stammdaten übernommen werden sollen. Der zweite Abruf ist zeitlich begrenzt und signiert."),
        heading("Übernommene Angaben", 2),
        *bullets([
            "Vorname und Nachname",
            "Straße, Hausnummer, Postleitzahl und Ort",
            "Telefonnummer",
            "TSK-Betriebsnummer",
            "Tierart, sofern sie weiterhin auswählbar ist",
        ]),
        heading("Bewusst nicht übernommen", 2),
        *bullets([
            "Tierzahl",
            "Impfstoff",
            "Impftermin",
            "Mitgliedscode und Mitgliedsstatus",
            "Zahlungsart, Zahlungsstatus und Zahlungsdaten",
            "QR-Code und interne Kennungen",
        ]),
        note("Prüfen bleibt Pflicht", "Auch übernommene Stammdaten müssen vor dem Absenden kontrolliert werden. Tierzahl, Impfstoff und Termin werden immer neu festgelegt.", "info"),

        heading("6. Zahlung"),
        p("Nach dem Speichern der Anmeldung wird abhängig von der Auswahl ein PayPal-Auftrag oder eine Stripe-Checkout-Sitzung erzeugt. Die Anwendung übergibt nur die für den Bezahlvorgang notwendigen Angaben."),
        heading("PayPal", 2),
        *steps([
            "PayPal auswählen und Anmeldung absenden.",
            "Im PayPal-Fenster anmelden oder die angebotene Zahlungsart verwenden.",
            "Zahlung bestätigen.",
            "Nach der Rückkehr erfasst die App die PayPal-Bestätigung und markiert den Teilnehmer als bezahlt.",
        ]),
        heading("Stripe: Karte, Apple Pay oder Google Pay", 2),
        *steps([
            "„Kreditkarte / Apple Pay / Google Pay“ auswählen.",
            "Im Stripe-Checkout die angebotene Zahlungsart abschließen.",
            "Nach der Rückkehr prüft die App die Checkout-Sitzung.",
            "Bei erfolgreicher Prüfung wird der Zahlungsstatus gespeichert.",
        ]),
        screenshot("zahlung.jpg", "Abbildung 4: Zahlungsauswahl, Datenschutzbestätigung und Gebührenhinweis.", 100 * mm),
        heading("Abgebrochene oder unklare Zahlung", 2),
        p("Wird die Zahlung abgebrochen, bleibt die Anmeldung grundsätzlich mit offenem Zahlungsstatus bestehen. Ein Administrator kann den Status nach Prüfung manuell auf bezahlt setzen. Dabei wird die Zahlungsbestätigung ausgelöst."),
        note("Keine Kartendaten in der App", "Vollständige Karten- oder PayPal-Zugangsdaten werden nicht in der Teilnehmerverwaltung gespeichert. Die eigentliche Zahlung erfolgt beim jeweiligen Zahlungsanbieter.", "success"),
        page_break(),

        heading("7. E-Mails"),
        data_table(
            ["Mail", "Auslöser", "Inhalt / Einschränkung"],
            [
                ["Zahlungsbestätigung", "Bestätigte PayPal-/Stripe-Zahlung oder Admin setzt bezahlt", "Zahlungsbestätigung mit eingebettetem persönlichen QR-Code"],
                ["Terminänderung", "Admin wählt E-Mail beim Termin", "Uhrzeit oder Treffpunkt; Versand an bezahlte Teilnehmer des Termins"],
                ["Direkte Teilnehmermail", "Admin klickt E-Mail in Teilnehmerzeile", "Öffnet das lokale Standard-Mailprogramm mit vorbereitetem Text"],
                ["Saisonerinnerung", "Admin bestätigt beim ersten regulären Saisontermin", "Einladung früherer Teilnehmer mit Abmeldelink"],
                ["Tierarzt-Mail", "Admin bestätigt Tierarztversand", "Sammelimpfbescheinigung als PDF-Anhang"],
            ],
            [35 * mm, 53 * mm, 78 * mm],
        ),
        note("Nicht vorhanden", "Eine automatische E-Mail 24 Stunden vor dem Impftermin ist im aktuellen Programmstand nicht funktionsfähig und wird daher nicht als Bedienfunktion beschrieben. Eine eigenständige Anmeldebestätigung vor der Zahlung wird ebenfalls nicht automatisch versendet.", "warning"),
        heading("QR-Code in der Zahlungsbestätigung", 2),
        p("Der QR-Code ist als eingebettetes Bild in der E-Mail enthalten. Codiert wird ausschließlich der zufällige Check-in-Token des Teilnehmers. Namen, E-Mail-Adressen, Zahlungsdaten und andere personenbezogene Inhalte sind nicht Bestandteil des QR-Codes."),

        heading("8. Adminbereich"),
        heading("Anmelden", 2),
        *steps([
            "Auf der Startseite „Admin-Login“ öffnen.",
            "Admin-PIN eingeben.",
            "E-Mail und Passwort des Supabase-Administratorkontos eingeben.",
            "„Einloggen“ wählen. Die aktive Vereinsrolle wird anschließend geprüft.",
        ]),
        screenshot("admin-login.jpg", "Abbildung 5: Admin-Anmeldung in der lokalen Dokumentationsumgebung. Der sichtbare Konfigurationshinweis gehört zur unkonfigurierten lokalen Umgebung.", 92 * mm),
        heading("Dashboard", 2),
        p("Das Dashboard zeigt Teilnehmerzahl, Tierzahl, Einnahmen und nächsten Termin. Die intelligente Vereins-Ampel priorisiert offene Aufgaben aus Teilnehmern, Terminen, Saisonkampagne, Tierarztstatus und Systemkonfiguration."),
        *bullets([
            "Rot: sofortiger oder kritischer Handlungsbedarf",
            "Gelb: normale offene Aufgaben",
            "Grün: keine automatisch erkannten offenen Aufgaben",
            "Ein Klick öffnet die sortierte Aufgabenliste und führt zu passenden Bereichen.",
        ]),
        heading("QR-Check-in", 2),
        *steps([
            "Im Check-in-Bereich den richtigen Impftermin auswählen.",
            "Kamera starten oder QR-Code als Bilddatei einlesen.",
            "Gefundenen Teilnehmer und Status prüfen.",
            "Check-in bestätigen. Zeitpunkt und ausführender Administrator werden gespeichert.",
            "Ein bereits eingecheckter Teilnehmer wird kenntlich gemacht; der Status kann zurückgesetzt werden.",
        ]),
        note("Terminbindung", "Ein QR-Code wird abgewiesen, wenn er unbekannt ist, verändert wurde oder zu einem anderen Verein beziehungsweise Termin gehört.", "success"),
        page_break(),

        heading("Teilnehmerverwaltung", 2),
        p("Die Tabelle zeigt Name, Adresse, Kontakt, TSK-Betriebsnummer, Mitgliedsstatus, Tierzahl, Impfstoff, Termin und Zahlungsstatus."),
        *bullets([
            "Suche nach Name, Ort oder E-Mail",
            "Filter „Alle Zahlungen“, „Bezahlt“ und „Offen“",
            "Zahlungsstatus zwischen offen und bezahlt wechseln",
            "Stammdaten und Tierangaben bearbeiten",
            "Datensatz nach Bestätigung löschen",
            "Vorbereitete E-Mail im Standard-Mailprogramm öffnen",
        ]),
        note("Folge beim Status „Bezahlt“", "Wird ein Teilnehmer über die Adminfunktion als bezahlt markiert und besitzt er eine E-Mail-Adresse, wird die Zahlungsbestätigung mit QR-Code ausgelöst.", "info"),

        heading("9. Terminverwaltung"),
        heading("Termin anlegen", 2),
        *steps([
            "Titel des Termins eintragen; eine Uhrzeit kann Bestandteil des Titels sein.",
            "Datum wählen.",
            "Optional Hinweis oder Beschreibung eintragen.",
            "Veranstaltungsort, Straße, Hausnummer, Postleitzahl und Ort ergänzen.",
            "Falls gewünscht, die Adresse für die öffentliche Route freigeben.",
            "„Impftermin speichern“ wählen.",
        ]),
        heading("Vorhandene Termine", 2),
        p("Je Termin stehen Bearbeiten, Route prüfen, PDF, Kassenbericht, E-Mail, gegebenenfalls Saisonmail, Tierarzt und Löschen zur Verfügung. Die Zahl der Anmeldungen je Termin wird zusätzlich im Dashboard angezeigt."),
        heading("Testtermine", 2),
        p("Enthält irgendein Textfeld eines Termins den Bestandteil „test“ - unabhängig von Groß- und Kleinschreibung - bleibt der Termin normal gespeichert und sichtbar, wird aber vollständig aus Saisonmail, Saisonkampagne, Rücklaufquote und Vereins-Ampel-Auswertungen für reguläre Termine ausgeschlossen."),
        note("Wichtig", "Ein Testtermin erzeugt keinen Saisonstatus und verhindert nicht, dass ein später angelegter echter Termin als erster regulärer Saisontermin erkannt wird.", "success"),

        heading("10. PDF- und Exportfunktionen"),
        data_table(
            ["Export", "Inhalt", "Bedienung"],
            [
                ["Teilnehmerliste je Termin", "Kontaktdaten, Tiere, Impfstoff, Zahlung", "PDF-Schaltfläche an der Terminkarte"],
                ["Kassenbericht", "Statistik, Zahlungsarten, Beträge, Status und Unterschriftsfelder", "Kassenbericht an der Terminkarte"],
                ["Gefilterte Teilnehmerliste", "Aktuell gefilterte Tabelle als PDF oder CSV", "Export oberhalb der Teilnehmerliste"],
                ["Sammelimpfbescheinigung", "Bestände, Impfstoff, Charge, Verwendbarkeit und Tierarzt-Unterschrift", "Bescheinigung beziehungsweise Tierarztfunktion"],
                ["Kampagnenbericht", "Versand, Rückkehrer, Quote und Empfängerlisten", "Detailansicht der Saisonkampagne"],
            ],
            [39 * mm, 75 * mm, 52 * mm],
        ),
        heading("Kassenbericht", 2),
        p("Der Kassenbericht wird für einen einzelnen Impftermin erzeugt. Er enthält Teilnehmer gesamt, bezahlte und offene Teilnehmer, Gesamteinnahmen sowie Summen für Barzahlung, PayPal und Stripe. Die Tabelle führt Mitgliedsstatus, Tierdaten, Impfstoff, Zahlungsart, Betrag, Status und Zahlungsdatum auf."),
        heading("Sammelimpfbescheinigung", 2),
        p("Die Bescheinigung enthält den fest hinterlegten Impfstoff „Nobilis ND Clone 30“, Leerfelder für Charge und Verwendbarkeit, die Teilnehmerbestände sowie Felder für Ort, Datum, Tierarztstempel und Unterschrift."),
        page_break(),

        heading("11. Tierarztversand"),
        *steps([
            "In der Terminverwaltung den gewünschten Termin prüfen.",
            "Die Tierarzt-Schaltfläche ist ab dem Tag des Impftermins freigeschaltet.",
            "Schaltfläche „Tierarzt“ wählen.",
            "Datum und Versanddialog prüfen.",
            "„Jetzt senden“ bestätigen.",
            "Die App erzeugt die Sammelimpfbescheinigung, hängt sie als PDF an und versendet die vorhandene Tierarzt-Mail.",
        ]),
        p("Der Versandstatus wird am Termin gespeichert. Die intelligente Vereins-Ampel kann dadurch erkennen, ob Unterlagen erstellt beziehungsweise versendet wurden."),
        note("Voraussetzungen", "SMTP-Konfiguration, Empfängeradresse des Tierarztes, gültige Admin-Sitzung, ausgeführte Datenbankmigration und ein Termin am aktuellen oder einem vergangenen Datum müssen vorhanden sein.", "warning"),

        heading("12. Saisonerinnerungen"),
        p("Nach dem Speichern des ersten regulären Termins einer Saison prüft die App, ob frühere Teilnehmer des Vorjahres vorhanden sind und ob für den Verein und das Kalenderjahr noch keine Entscheidung gespeichert wurde."),
        heading("Versanddialog", 2),
        p("Der Dialog zeigt Saison, Teilnehmer des Vorjahres, versendbare eindeutige E-Mail-Adressen und Teilnehmer ohne gültige E-Mail. Der Administrator entscheidet ausdrücklich:"),
        *bullets([
            "Einladungen jetzt versenden",
            "Später entscheiden",
            "Für diese Saison nicht versenden",
        ]),
        heading("Empfängerauswahl und Schutz", 2),
        *bullets([
            "Nur Teilnehmer desselben Vereins aus dem Vorjahr",
            "Nur gültige, normalisierte E-Mail-Adressen",
            "Abgemeldete Empfänger werden ausgeschlossen",
            "Eine E-Mail-Adresse wird pro Saison nur einmal angeschrieben",
            "Doppelklicks und parallele Aufrufe werden serverseitig abgefangen",
            "Testtermine werden unmittelbar vor dem Versand erneut abgewiesen",
        ]),
        p("Die Mail enthält einen direkten Anmeldelink, die gemeinsam mit der Tierarzt-Mail verwendete Signatur und einen individuellen Abmeldelink. Eine Abmeldung wird dauerhaft und vereinsbezogen gespeichert."),

        heading("13. Saisonkampagne"),
        p("Nach abgeschlossenem Saisonversand wertet die Dashboard-Karte automatisch aus, wie viele eindeutig angeschriebene Empfänger sich in derselben Saison mit derselben normalisierten E-Mail-Adresse erneut angemeldet haben."),
        data_table(
            ["Kennzahl", "Berechnung"],
            [
                ["Erinnerungen versendet", "Nur erfolgreich versendete eindeutige Empfänger"],
                ["Bereits wieder angemeldet", "Eindeutige E-Mail-Adressen mit neuer Anmeldung im selben Verein und Jahr"],
                ["Noch ohne Anmeldung", "Versendet minus Rückkehrer"],
                ["Rücklaufquote", "Rückkehrer / erfolgreich versendete Empfänger × 100"],
            ],
            [55 * mm, 111 * mm],
        ),
        heading("Farbskala", 2),
        *bullets([
            "Rot: 0 bis unter 25 Prozent",
            "Orange: 25 bis unter 50 Prozent",
            "Gelb: 50 bis unter 75 Prozent",
            "Grün: 75 bis 100 Prozent",
        ]),
        p("Ein Klick öffnet die geschützte Detailansicht. Dort kann nach Vorname, Nachname oder E-Mail gesucht und zwischen allen, bereits angemeldeten und noch offenen Empfängern gefiltert werden. Der Kampagnenbericht wird als PDF exportiert. Eine Historie zeigt vergangene Saisonwerte."),
        note("Voraussetzung", "Saisonkampagne und Rücklaufquote benötigen die zugehörigen Datenbankmigrationen. Wenn die Karte nicht geladen werden kann, bleiben die übrigen Dashboardfunktionen nutzbar.", "warning"),
        page_break(),

        heading("14. Clubverwaltung"),
        p("Die öffentliche Startseite kann Vereine aus der Datenbank anzeigen und über den Vereins-Slug auf den passenden öffentlichen Bereich führen. Der produktive Adminbereich arbeitet vereinsbezogen über die hinterlegte Rollen-Zuordnung."),
        note("Aktueller Funktionsstatus", "Die sichtbaren Bereiche „Verein registrieren“, „Vereins-Login“ und „Vereins-Dashboard“ sind im aktuellen Code nur Test- beziehungsweise Informationsstände. Eine produktive Self-Service-Registrierung, ein vollständiges Vereinsprofil mit Logo-/Rechtstextverwaltung und ein UI-Wechsel zwischen Vereinen sind nicht fertiggestellt und werden nicht als Bedienfunktion angeboten.", "warning"),
        p("Neue Auth-Benutzer, Clubadmin-Zuordnungen und zentrale Vereinsdaten werden derzeit administrativ in Supabase eingerichtet. Änderungen daran sollten nur durch technisch verantwortliche Personen erfolgen."),

        heading("15. Datenschutz und Sicherheit"),
        *bullets([
            "Teilnehmerdaten werden zur Organisation, Durchführung und Dokumentation der Sammelimpfung verarbeitet.",
            "Der Adminzugriff erfordert Anmeldung und aktive Vereinsrolle.",
            "Datenbankregeln und serverseitige Prüfungen begrenzen Zugriffe auf den zugeordneten Verein.",
            "Zahlungsanbieter verarbeiten die eigentlichen Zahlungsinformationen; die App speichert Status, Betrag, Methode und Referenz.",
            "Der QR-Code enthält ausschließlich den zufälligen Check-in-Token.",
            "Saisonmails besitzen einen individuellen Abmeldelink; die Abmeldung wird dauerhaft gespeichert.",
            "Impressum und Datenschutzerklärung sind öffentlich über den Footer erreichbar.",
        ]),
        note("Keine Rechtsberatung", "Diese Anleitung beschreibt die technische Funktionsweise. Sie ersetzt keine rechtliche oder datenschutzrechtliche Beratung.", "info"),

        heading("16. Häufige Fragen und typische Probleme"),
        data_table(
            ["Problem", "Prüfschritte"],
            [
                ["E-Mail oder Passwort falsch", "Schreibweise prüfen, bestätigtes Konto verwenden, aktive Vereinsrolle kontrollieren."],
                ["Admin-PIN wird abgewiesen", "Aktuelle PIN verwenden; bei fehlender Konfiguration Betreiber informieren."],
                ["Zahlung abgebrochen", "Teilnehmerdatensatz bleibt offen. Zahlung klären oder Adminstatus nach Prüfung setzen."],
                ["Teilnehmer nicht bezahlt", "Zahlungsanbieter-Rückkehr prüfen; danach Webhook beziehungsweise Adminstatus kontrollieren."],
                ["Mail nicht empfangen", "E-Mail-Adresse und Spamordner prüfen; Mailanbieter- und Resend-/SMTP-Konfiguration kontrollieren."],
                ["Termin nicht auswählbar", "Prüfen, ob ein Termin für den richtigen Verein angelegt und öffentlich lesbar ist."],
                ["PDF wird nicht erstellt", "Browserdownloads erlauben, Filter prüfen und erneut ausführen."],
                ["Tierarzt-Mail gesperrt", "Versand ist erst am Tag des Termins möglich; SMTP und Empfängeradresse prüfen."],
                ["QR-Code wird abgewiesen", "Richtigen Termin wählen und unveränderten QR-Code der Zahlungsbestätigung verwenden."],
                ["Saisonkampagne lädt nicht", "Migrationen und Serverkonfiguration prüfen; übrige Dashboardbereiche bleiben nutzbar."],
            ],
            [52 * mm, 114 * mm],
        ),
        heading("Fehlermeldungen sinnvoll weitergeben", 2),
        p("Notieren Sie betroffene Funktion, Zeitpunkt, Verein, Termin und sichtbare Meldung. Keine Passwörter, Zahlungsdaten, QR-Tokens oder Service-Schlüssel per E-Mail versenden."),
        page_break(),

        heading("17. Kurzanleitung"),
        heading("Für Teilnehmer", 2),
        *steps([
            "Verein beziehungsweise Vereinsseite öffnen.",
            "Informationen lesen und Anmeldung starten.",
            "Persönliche Daten und TSK-Betriebsnummer eingeben.",
            "Tierart, Tierzahl, Impfstoff und Termin wählen.",
            "Datenschutz bestätigen und Zahlungsart auswählen.",
            "Anmeldung absenden und Zahlung vollständig abschließen.",
            "Zahlungsbestätigung mit QR-Code aufbewahren.",
            "QR-Code am Impftag vorzeigen.",
        ]),
        heading("Für Administratoren", 2),
        *steps([
            "Adminbereich öffnen und mit PIN, E-Mail und Passwort anmelden.",
            "Vereins-Ampel und nächsten Termin prüfen.",
            "Teilnehmer, offene Zahlungen und Anmeldungen je Termin kontrollieren.",
            "Terminangaben, Veranstaltungsort und Hinweise prüfen.",
            "Bei Saisonstart bewusst über Saisonerinnerungen entscheiden.",
            "Am Impftag QR-Check-in verwenden.",
            "Teilnehmerliste, Kassenbericht und Sammelimpfbescheinigung erstellen.",
            "Tierarztversand durchführen und Status kontrollieren.",
        ]),
        note("Dokumentationsstand", f"Diese Anleitung wurde am {CREATED.strftime('%d.%m.%Y')} aus dem aktuellen Quellcode erstellt. Spätere Programmänderungen können eine Aktualisierung erforderlich machen.", "info"),
    ])
    return story


def markdown_source() -> str:
    return f"""# Impfgruppenmanager - Bedienungsanleitung

**Verein:** RGZV Hagen und Umgebung seit 1903 e.V.  
**Stand:** {CREATED.strftime('%d.%m.%Y')}  
**Hinweis:** Erstellt auf Grundlage des aktuellen Programmstands.

## Enthaltene Kapitel

1. Einführung
2. Rollen und Berechtigungen
3. Öffentliche Startseite
4. Anmeldung zu einem Impftermin
5. Wiederkehrende Teilnehmer
6. Zahlung
7. E-Mails
8. Adminbereich
9. Terminverwaltung
10. PDF- und Exportfunktionen
11. Tierarztversand
12. Saisonerinnerungen
13. Saisonkampagne
14. Clubverwaltung
15. Datenschutz und Sicherheit
16. Häufige Fragen und typische Probleme
17. Kurzanleitung

Die verbindliche, vollständig gestaltete Fassung befindet sich in
`Bedienungsanleitung-Impfgruppenmanager.pdf`.

## Dokumentationsgrenzen

- Der separate Vereins-Login und das Vereins-Dashboard sind nur vorbereitet.
- Die Self-Service-Vereinsregistrierung ist nicht produktionsreif.
- Es gibt keine funktionsfähige automatische 24-Stunden-Erinnerungsmail.
- Es gibt keinen nutzbaren Offline-Modus.
- Die Superadmin-Rolle wird serverseitig erkannt; ein produktiver Vereinswechsler
  ist in der aktuellen Oberfläche nicht vorhanden.

## Verwendete Screenshots

- Öffentliche Startseite
- Informationsseite
- Öffentliches Anmeldeformular
- Zahlungsauswahl und Datenschutz
- Admin-Login

Alle Screenshots stammen aus einer lokalen, unkonfigurierten Umgebung und
enthalten keine Teilnehmer-, Kontakt- oder Zahlungsdaten.
"""


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = ManualDocTemplate(str(PDF_PATH))
    doc.multiBuild(build_story())
    MD_PATH.write_text(markdown_source(), encoding="utf-8")
    print(PDF_PATH)
    print(MD_PATH)


if __name__ == "__main__":
    main()
