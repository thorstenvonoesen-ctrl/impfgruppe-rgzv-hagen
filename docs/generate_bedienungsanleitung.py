from __future__ import annotations

from datetime import date
from pathlib import Path
from shutil import copy2
from xml.sax.saxutils import escape

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets" / "manual-v2"
OUTPUT = ROOT / "output" / "pdf"
PUBLIC = ROOT / "public"
PDF = OUTPUT / "Bedienungsanleitung-Impfgruppenmanager.pdf"
PUBLIC_PDF = PUBLIC / PDF.name
MD = OUTPUT / "Bedienungsanleitung-Impfgruppenmanager.md"
CREATED = date(2026, 7, 26)

DARK = colors.HexColor("#12382d")
DARKER = colors.HexColor("#0b2921")
ORANGE = colors.HexColor("#f58a1f")
TEXT = colors.HexColor("#24332f")
MUTED = colors.HexColor("#64756f")
LINE = colors.HexColor("#dce5e1")
PALE = colors.HexColor("#f3f8f6")
PALE_ORANGE = colors.HexColor("#fff5e9")
GREEN = colors.HexColor("#24865d")
RED = colors.HexColor("#a94442")


def register_fonts():
    regular = Path("C:/Windows/Fonts/arial.ttf")
    bold = Path("C:/Windows/Fonts/arialbd.ttf")
    italic = Path("C:/Windows/Fonts/ariali.ttf")
    pdfmetrics.registerFont(TTFont("Manual", str(regular)))
    pdfmetrics.registerFont(TTFont("Manual-Bold", str(bold)))
    pdfmetrics.registerFont(TTFont("Manual-Italic", str(italic)))


register_fonts()
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="BodyX", fontName="Manual", fontSize=9.4, leading=13.4,
                          textColor=TEXT, spaceAfter=6))
styles.add(ParagraphStyle(name="H1X", fontName="Manual-Bold", fontSize=22, leading=26,
                          textColor=DARK, spaceAfter=10))
styles.add(ParagraphStyle(name="H2X", fontName="Manual-Bold", fontSize=13, leading=16,
                          textColor=DARK, spaceBefore=7, spaceAfter=5))
styles.add(ParagraphStyle(name="SmallX", fontName="Manual", fontSize=7.5, leading=10,
                          textColor=MUTED))
styles.add(ParagraphStyle(name="CaptionX", fontName="Manual-Italic", fontSize=7.3,
                          leading=10, textColor=MUTED, alignment=TA_CENTER, spaceBefore=3))
styles.add(ParagraphStyle(name="CoverTitle", fontName="Manual-Bold", fontSize=31,
                          leading=35, textColor=colors.white, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="CoverSub", fontName="Manual", fontSize=13, leading=18,
                          textColor=colors.HexColor("#d9e8e2"), alignment=TA_CENTER))
styles.add(ParagraphStyle(name="TOCHeading", fontName="Manual-Bold", fontSize=9,
                          leading=12, textColor=DARK, leftIndent=0))
styles.add(ParagraphStyle(name="BulletX", parent=styles["BodyX"], leftIndent=12,
                          firstLineIndent=-8, bulletIndent=0, spaceAfter=3))


def P(text, style="BodyX"):
    return Paragraph(escape(text).replace("\n", "<br/>"), styles[style])


def rich(text, style="BodyX"):
    return Paragraph(text, styles[style])


def bullets(items):
    return [Paragraph("• " + escape(x), styles["BulletX"]) for x in items]


def tip(title, text, warning=False):
    bg = colors.HexColor("#fff1ec") if warning else PALE_ORANGE
    accent = RED if warning else ORANGE
    t = Table([[rich(f"<b>{escape(title)}</b><br/>{escape(text)}")]], colWidths=[166*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), .8, accent),
        ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t


def screenshot(name, caption, width=156*mm, max_height=96*mm):
    path = ASSETS / name
    with PILImage.open(path) as im:
        w, h = im.size
    scale = min(width / w, max_height / h)
    img = Image(str(path), width=w * scale, height=h * scale)
    return [Spacer(1, 4*mm), img, P(caption, "CaptionX"), Spacer(1, 3*mm)]


class ManualDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(filename, pagesize=A4, leftMargin=22*mm, rightMargin=22*mm,
                         topMargin=21*mm, bottomMargin=18*mm,
                         title="Bedienungsanleitung Impfgruppenmanager",
                         author="Impfgruppenmanager")
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="body")
        self.addPageTemplates(PageTemplate(id="normal", frames=[frame], onPage=self.decorate))

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == "H1X":
            text = flowable.getPlainText()
            key = "h1-%s" % self.seq.nextf("heading")
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=0, closed=False)
            self.notify("TOCEntry", (0, text, self.page, key))

    def decorate(self, canvas, doc):
        if doc.page == 1:
            return
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.line(22*mm, 282*mm, 188*mm, 282*mm)
        canvas.setFont("Manual", 7.3)
        canvas.setFillColor(MUTED)
        canvas.drawString(22*mm, 286*mm, "IMPFGRUPPENMANAGER · BEDIENUNGSANLEITUNG")
        canvas.drawRightString(188*mm, 11*mm, f"Seite {doc.page}")
        canvas.drawString(22*mm, 11*mm, f"Stand {CREATED.strftime('%d.%m.%Y')}")
        canvas.restoreState()


story = []
md_lines = ["# Bedienungsanleitung Impfgruppenmanager", "", f"Stand: {CREATED:%d.%m.%Y}", ""]


def chapter(title, intro, sections, image=None, caption=None, note=None):
    story.extend([P(title, "H1X"), P(intro)])
    md_lines.extend([f"## {title}", "", intro, ""])
    if image:
        story.extend(screenshot(image, caption or "Abbildung zur Orientierung"))
    for heading, paragraphs, items in sections:
        story.append(P(heading, "H2X"))
        md_lines.extend([f"### {heading}", ""])
        for paragraph in paragraphs:
            story.append(P(paragraph))
            md_lines.extend([paragraph, ""])
        story.extend(bullets(items))
        md_lines.extend([f"- {x}" for x in items] + ([""] if items else []))
    if note:
        story.extend([Spacer(1, 2*mm), tip(note[0], note[1], note[2] if len(note) > 2 else False)])
    story.append(PageBreak())


# Neutral cover – deliberately no club logo.
story.extend([
    Spacer(1, 25*mm),
    Table([[""]], colWidths=[166*mm], rowHeights=[20*mm],
          style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), ORANGE),
                            ("BOX", (0, 0), (-1, -1), 0, ORANGE)])),
    Spacer(1, 12*mm),
    Table([[P("BEDIENUNGSANLEITUNG", "CoverTitle")],
           [P("Impfgruppenmanager", "CoverTitle")],
           [P("Von der Online-Anmeldung bis zur Sammelimpfbescheinigung", "CoverSub")]],
          colWidths=[166*mm], rowHeights=[22*mm, 38*mm, 30*mm],
          style=TableStyle([
              ("BACKGROUND", (0, 0), (-1, -1), DARK),
              ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
              ("BOX", (0, 0), (-1, -1), 0, DARK),
          ])),
    Spacer(1, 20*mm),
    P("Praxisleitfaden für Teilnehmende, Impfwarte, Vereinsadministratoren und Superadmins", "H2X"),
    Spacer(1, 3*mm),
    P(f"Ausgabe {CREATED:%d.%m.%Y} · DIN A4 · Deutsche Fassung", "SmallX"),
    Spacer(1, 40*mm),
    tip("Hinweis", "Die Bildschirmdarstellungen können je nach Endgerät und Datenstand leicht abweichen. Personenbezogene Beispieldaten sind rein fiktiv."),
    PageBreak(),
])

story += [P("Inhaltsverzeichnis", "H1X")]
toc = TableOfContents()
toc.levelStyles = [styles["TOCHeading"]]
story += [toc, PageBreak()]

chapter("1. Der Impfgruppenmanager im Überblick",
        "Der Impfgruppenmanager bündelt Anmeldung, Bezahlung, Organisation, Check-in und Dokumentation einer Newcastle-Sammelimpfung in einem durchgängigen digitalen Ablauf.",
        [
            ("Was die Anwendung leistet", [
                "Teilnehmende melden ihren Geflügelbestand online an. Der Verein sieht den aktuellen Stand zentral und kann den Impftag ohne parallele Papierlisten vorbereiten."
            ], ["Öffentliche Information und Anmeldung", "Online- oder Vor-Ort-Zahlung", "Persönlicher QR-Code", "Termin-, Teilnehmer- und Dokumentenverwaltung"]),
            ("Der typische Ablauf", [
                "Anmeldung, Zahlung, Bestätigung, Check-in und Nachbereitung greifen ineinander. Dadurch bleiben Teilnehmer- und Zahlungsstatus nachvollziehbar."
            ], ["Termin auswählen", "Daten erfassen", "Zahlungsart wählen", "Bestätigung erhalten", "QR-Code am Impftag vorzeigen"]),
        ],
        note=("Datenschutz", "Der QR-Code enthält ausschließlich den technischen Check-in-Token – keine Namen, E-Mail-Adressen oder Zahlungsdaten."))

chapter("2. Rollen und Berechtigungen",
        "Die Anwendung unterscheidet öffentliche Besucher und drei administrative Rollen. Welche Bereiche sichtbar und nutzbar sind, richtet sich nach der aktiven Vereinsmitgliedschaft.",
        [
            ("Teilnehmende", ["Öffentliche Besucher benötigen kein Benutzerkonto. Sie informieren sich, melden Tiere an und wählen die angebotene Zahlungsart."], []),
            ("Administrative Rollen", [], [
                "Superadmin: vollständige Vereins- und Administratorverwaltung",
                "Vereinsadmin: operative Verwaltung des zugeordneten Vereins",
                "Check-in-Admin: auf den Einsatz am Impftag ausgerichteter Zugang",
            ]),
            ("Vereinszuordnung", ["Administrative Daten werden über die aktive Mitgliedschaft einem Verein zugeordnet. Eine Rolle allein ersetzt diese Zuordnung nicht."], []),
        ],
        note=("Wichtig", "Zugangsdaten niemals weitergeben. Für jede administrierende Person sollte ein eigenes Konto verwendet werden.", True))

chapter("3. Öffentliche Startseite",
        "Die Startseite zeigt den nächsten Impftermin, den Live-Countdown, den Standort und die wichtigsten Vorteile der Online-Anmeldung.",
        [
            ("Orientierung", ["Über „Route starten“ lässt sich die Anfahrt öffnen. Die Wettervorhersage wird erst im vorgesehenen Zeitraum vor dem Termin angeboten."], []),
            ("Einstieg in die Anmeldung", ["Die Kachel „Zur Impfanmeldung“ führt zuerst zur Informationsseite und anschließend zum Formular."], []),
        ],
        image="startseite-aktuell.png",
        caption="Aktuelle öffentliche Startseite: oben Navigation und Hero, darunter Termin- und Informationsbereich.")

chapter("4. Informationsseiten nutzen",
        "Vier ausführliche Informationsbereiche erklären Tierschutz, Impfpflicht, Sammelimpfung und digitalen QR-Check-in.",
        [
            ("Navigation", ["Mit „Mehr erfahren“ wird der passende Themenbereich geöffnet. Überschriften dienen als eindeutige Orientierungspunkte."], []),
            ("Empfohlene Lektüre", ["Neue Teilnehmende sollten besonders die Abschnitte zu Ablauf, Kosten, Abholung und QR-Code lesen."], []),
        ],
        note=("Tipp", "Öffnen Sie Informationsseiten vor der Anmeldung, wenn Sie Ablauf oder Abholung mit einer anderen Person abstimmen möchten."))

chapter("5. Anmeldung vorbereiten",
        "Vor dem Ausfüllen sollten Kontaktdaten, Tierzahl und die gewünschte Zahlungsart feststehen.",
        [
            ("Benötigte Angaben", [], ["Vor- und Nachname", "vollständige Anschrift", "E-Mail-Adresse und Telefon", "Tierart und Anzahl", "gewünschter Impftermin"]),
            ("Zulässige Tierarten", ["Das Formular akzeptiert Hühner, Zwerghühner und Puten. Als Impfstoff ist die Newcastle-Impfung fest vorgegeben."], []),
            ("Wiederanmeldung", ["Frühere Stammdaten können nach einer zweistufigen sicheren Prüfung übernommen werden. Kontrollieren Sie alle Angaben vor dem Absenden."], []),
        ],
        image="anmeldung-stammdaten.png",
        caption="Öffentliches Anmeldeformular: Stammdaten und Tierangaben.")

chapter("6. Teilnehmerdaten erfassen",
        "Tragen Sie alle Felder sorgfältig ein. Die E-Mail-Adresse ist besonders wichtig, da Bestätigung und persönlicher QR-Code dorthin gesendet werden.",
        [
            ("Eingabe prüfen", ["Achten Sie auf Schreibfehler, eine erreichbare Telefonnummer und eine vollständige Adresse."], []),
            ("Mitgliedsstatus", ["Ein vorhandener Mitgliedscode wird serverseitig geprüft. Nur ein gültiger Code führt zum vorgesehenen Mitgliedspreis."], []),
            ("Verbindlichkeit", ["Mit der Anmeldung wird ein Teilnahmeplatz reserviert. Beachten Sie den eingeblendeten Hinweis zur Nichterstattung bei Absage oder Nichterscheinen."], []),
        ],
        note=("Hinweis", "Verwenden Sie keine fremde E-Mail-Adresse, außer der Empfänger hat dem ausdrücklich zugestimmt.", True))

chapter("7. Termin, Tierart und Tierzahl",
        "Die Terminwahl verbindet die Anmeldung eindeutig mit dem richtigen Impftermin. Tierart und Tierzahl werden in Listen, Auswertungen und Bescheinigungen weiterverwendet.",
        [
            ("Termin auswählen", ["Wählen Sie ausschließlich den Termin, an dem der Impfstoff abgeholt werden soll."], []),
            ("Tierzahl angeben", ["Geben Sie die tatsächlich zu impfende Anzahl an. Änderungen sollten rechtzeitig über den Veranstalter geklärt werden."], []),
            ("Technischer Impfstoffwert", ["Die sichtbare Bezeichnung lautet „Newcastle-Impfung“. Intern bleibt der bestehende, für PDFs und E-Mails erwartete Wert erhalten."], []),
        ],
        image="anmeldung-tiere-termin.png",
        caption="Aktuelles Formular: Mitgliedscode, die drei zugelassenen Tierarten, fester Impfstoff und Terminwahl.")

chapter("8. Zahlungsarten auswählen",
        "Je nach Angebot stehen PayPal, Kreditkarte beziehungsweise Wallet-Zahlung über Stripe und Barzahlung vor Ort zur Verfügung.",
        [
            ("PayPal", ["Nach der Registrierung führt die Anwendung zur PayPal-Zahlung. Erst eine serverseitig bestätigte Zahlung setzt den Status auf bezahlt."], []),
            ("Kreditkarte, Apple Pay oder Google Pay", ["Die Abwicklung erfolgt über Stripe. Verfügbare Wallets hängen von Gerät, Browser und Konfiguration ab."], []),
            ("Barzahlung vor Ort", ["Die Registrierung wird direkt gespeichert, ohne Weiterleitung zu PayPal oder Stripe. Der Zahlungsstatus bleibt offen, bis die Zahlung administrativ verbucht wurde."], []),
        ],
        image="anmeldung-zahlung-aktuell.png",
        caption="Aktueller Zahlungsbereich: PayPal, Kreditkarte/Wallet und Barzahlung vor Ort sowie Hinweis und Absende-Button.",
        note=("Sicherheit", "Schließen Sie das Zahlungsfenster nicht während der Verarbeitung und lösen Sie eine Zahlung nicht mehrfach aus.", True))

chapter("9. Anmeldung abschließen",
        "Prüfen Sie vor dem verbindlichen Absenden alle sichtbaren Angaben und den Gesamtbetrag.",
        [
            ("Absenden", ["Der Button benennt Tierarten und Newcastle-Impfung eindeutig. Nach dem Klick wird die Registrierung serverseitig validiert und gespeichert."], []),
            ("Bei Fehlermeldungen", ["Korrigieren Sie markierte Pflichtfelder. Bleibt der Fehler bestehen, notieren Sie Termin und Uhrzeit und informieren Sie den Veranstalter."], []),
            ("Keine Doppelanmeldung", ["Warten Sie nach dem Klick auf die Rückmeldung. Wiederholen Sie die Anmeldung nicht vorschnell."], []),
        ])

chapter("10. Bestätigungsmail und persönlicher QR-Code",
        "Nach erfolgreicher Zahlungsbestätigung wird die bisherige Bestätigungsmail einschließlich des persönlichen QR-Codes verschickt.",
        [
            ("E-Mail prüfen", ["Kontrollieren Sie Posteingang und Spamordner. Termin, Verein und Zahlungsinformation bleiben Bestandteil der Nachricht."], []),
            ("QR-Code", ["Das Bild ist direkt in die HTML-E-Mail eingebettet. Es muss nicht über einen externen Link nachgeladen werden."], []),
            ("Am Impftag", ["Zeigen Sie den QR-Code auf dem Smartphone oder als gut lesbaren Ausdruck. Eine andere Person kann ihn zusammen mit der Anmeldebestätigung zur Abholung verwenden."], []),
        ],
        note=("Datenschutz", "Im QR-Code steht nur der vorhandene Check-in-Token. Teilen Sie ihn trotzdem nicht öffentlich."))

chapter("11. Anwendung auf Android installieren",
        "Die Website kann in Chrome als Verknüpfung auf dem Startbildschirm abgelegt werden. Dadurch lässt sie sich ähnlich wie eine App öffnen.",
        [
            ("Schritte", [], ["Seite in Chrome öffnen", "Drei-Punkte-Menü öffnen", "„Zum Startbildschirm hinzufügen“ wählen", "Namen bestätigen und hinzufügen"]),
            ("Internetverbindung", ["Die Verknüpfung ist keine Offline-App. Für Anmeldung, Zahlungen und aktuelle Daten wird weiterhin Internet benötigt."], []),
        ],
        image="installation-android.png",
        caption="Schematische Schrittfolge für Android/Chrome.")

chapter("12. Anwendung auf iPhone und iPad installieren",
        "Unter iOS beziehungsweise iPadOS wird die Verknüpfung über Safari angelegt.",
        [
            ("Schritte", [], ["Seite in Safari öffnen", "Teilen-Symbol antippen", "„Zum Home-Bildschirm“ wählen", "Namen bestätigen und hinzufügen"]),
            ("Browserhinweis", ["Die Option befindet sich in Safari. In eingebetteten Browsern anderer Apps kann sie fehlen."], []),
        ],
        image="installation-ios.png",
        caption="Schematische Schrittfolge für iPhone und iPad.")

chapter("13. Admin-Login",
        "Administratoren melden sich mit ihrer individuellen E-Mail-Adresse und ihrem Supabase-Auth-Passwort an.",
        [
            ("Anmelden", ["Öffnen Sie „Admin-Login“, tragen Sie E-Mail-Adresse und Passwort ein und senden Sie das Formular ab."], []),
            ("Gültige Sitzung", ["Eine noch gültige Supabase-Sitzung wird automatisch wiederaufgenommen. Deshalb kann das Dashboard ohne erneute Abfrage erscheinen."], []),
            ("Sicher abmelden", ["Der Button „Abmelden“ beendet die Supabase-Sitzung. Erst nach erfolgreichem signOut wird das Loginformular wieder gezeigt."], []),
        ],
        image="admin-login.png",
        caption="Aktuelle Admin-Anmeldeseite.",
        note=("Wichtig", "Auf gemeinsam genutzten Geräten immer über „Abmelden“ beenden.", True))

chapter("14. Admin-Dashboard",
        "Das Dashboard bündelt Status, Kennzahlen, Aufgaben, Saisonkampagne, Check-in und Terminübersicht.",
        [
            ("Kennzahlen", ["Teilnehmer, Tiere und Einnahmen werden aus den vorhandenen Vereinsdaten berechnet."], []),
            ("Schneller Einstieg", ["Nutzen Sie die priorisierten Hinweise der Vereins-Ampel und springen Sie direkt in den passenden Arbeitsbereich."], []),
        ],
        image="admin-dashboard.png",
        caption="Schematische Darstellung des geschützten Dashboards; Beispieldaten sind fiktiv.")

chapter("15. Intelligente Vereins-Ampel",
        "Die Vereins-Ampel bewertet vorhandene Daten automatisch und zeigt nur offene Aufgaben.",
        [
            ("Prioritäten", [], ["Grün: kein aktueller Handlungsbedarf", "Gelb: normale Aufgabe oder Hinweis", "Rot: zeitkritischer oder grundlegender Handlungsbedarf"]),
            ("Typische Prüfungen", ["Dazu gehören offene Zahlungen, fehlende Vereinsdaten, anstehende Termine, Saisonkampagnen und Tierarztunterlagen."], []),
            ("Aktualisierung", ["Nach dem Erledigen verschwinden Aufgaben beim nächsten Datenabgleich aus der Liste."], []),
        ],
        image="admin-dashboard-ampel.png",
        caption="Vergrößerter Ausschnitt der schematischen Vereins-Ampel: Status und Handlungsbedarf stehen gemeinsam in einer Karte.")

chapter("16. Live-Online-Status",
        "Der Online-Status zeigt angemeldete Administratoren und den Zeitpunkt der letzten Aktivität, sofern die zugehörige Datenbankmigration verfügbar ist.",
        [
            ("Bedeutung", ["„Online“ kennzeichnet eine aktuelle Aktivität; ältere Einträge werden als zuletzt online dargestellt."], []),
            ("Aktualisierung", ["Heartbeat beziehungsweise Polling aktualisieren die Präsenz regelmäßig. Beim Abmelden wird der eigene Status beendet."], []),
            ("Nicht verfügbar", ["Erscheint „Online-Status nicht verfügbar“, prüfen Administratoren Migration, RPC-Funktion, RLS und die Supabase-Anfrage."], []),
        ],
        image="admin-dashboard-status.png",
        caption="Vergrößerter Ausschnitt des schematischen Administratorstatus: „online“ und „zuletzt online“ sind direkt erkennbar.",
        note=("Hinweis", "Der Präsenzstatus ersetzt keine Zugriffsprüfung. Berechtigungen werden weiterhin über Auth-Token und aktive Mitgliedschaft bestimmt."))

chapter("17. Teilnehmer verwalten",
        "Die Teilnehmerverwaltung dient zum Suchen, Prüfen und Bearbeiten der Anmeldungen des ausgewählten Vereins.",
        [
            ("Suchen und filtern", ["Suchen Sie nach Name, E-Mail, Telefon oder TSK-Angaben. Statusfilter helfen bei offenen Zahlungen und Check-ins."], []),
            ("Datensatz prüfen", ["Öffnen Sie eine Person erst nach eindeutiger Zuordnung. Kontrollieren Sie Termin, Tierzahl und Zahlungsstatus gemeinsam."], []),
            ("Änderungen", ["Speichern Sie nur fachlich bestätigte Korrekturen. Löschaktionen sind besonders sorgfältig zu prüfen."], []),
        ],
        image="admin-teilnehmer.png",
        caption="Schematische Teilnehmerverwaltung; Namen und Werte sind fiktiv.")

chapter("18. Zahlungen verwalten",
        "Zahlungsstatus und Zahlungsart müssen konsistent bleiben. Onlinezahlungen werden serverseitig bestätigt; Barzahlungen werden im vorgesehenen Adminablauf verbucht.",
        [
            ("Offene Zahlung", ["Der Status bleibt offen, solange keine bestätigte Onlinezahlung oder administrative Barzahlungsverbuchung vorliegt."], []),
            ("Doppelverarbeitung vermeiden", ["Bestehende PayPal-, Stripe- oder Barzahlungsdaten dürfen nicht durch einen anderen Zahlungsweg überschrieben werden."], []),
            ("Kontrolle", ["Vergleichen Sie Betrag, Zahlungsart und Teilnehmer vor jeder manuellen Aktion."], []),
        ],
        image="admin-teilnehmer-liste.png",
        caption="Vergrößerter Ausschnitt der schematischen Teilnehmerliste: Zahlungsstatus und Aktionen stehen in derselben Tabellenzeile.",
        note=("Warnung", "Zahlungsstatus niemals allein aufgrund einer Kundenaussage ändern. Beleg oder tatsächlichen Zahlungseingang prüfen.", True))

chapter("19. Impftermine anlegen und bearbeiten",
        "Termine bilden die organisatorische Grundlage jeder Anmeldung und aller terminbezogenen Dokumente.",
        [
            ("Anlegen", ["Erfassen Sie Bezeichnung, Datum, Uhrzeit, Ort und die benötigten Vereinsangaben vollständig."], []),
            ("Bearbeiten", ["Terminänderungen können bestehende Teilnehmende betreffen. Prüfen Sie vor dem Speichern, ob Benachrichtigungen erforderlich sind."], []),
            ("Löschen", ["Entfernen Sie keinen Termin mit produktiven Anmeldungen, ohne Auswirkungen auf Zahlung, QR-Code und Dokumentation zu klären."], []),
        ],
        image="admin-termine.png",
        caption="Schematische Terminverwaltung mit fiktiven Beispieldaten.")

chapter("20. Terminänderungen und E-Mails",
        "Bei einer Terminänderung kann der bestehende Mailweg die betroffenen Teilnehmenden informieren.",
        [
            ("Vor dem Versand", ["Kontrollieren Sie geändertes Datum, Uhrzeit und Ort. Ermitteln Sie die tatsächlich betroffene Teilnehmergruppe."], []),
            ("Nach dem Versand", ["Prüfen Sie die Rückmeldung der Oberfläche und behandeln Sie Fehlermeldungen, bevor Sie erneut versenden."], []),
            ("Keine unnötigen Wiederholungen", ["Versenden Sie dieselbe Mitteilung nicht mehrfach ohne Grund."], []),
        ],
        image="admin-termine-aktionen.png",
        caption="Vergrößerter Ausschnitt der Terminaktionen: „Bearbeiten“ ändert den Termin; „E-Mail“ startet die Benachrichtigung.")

chapter("21. QR-Check-in am Impftag",
        "Im Live-Impftag-Modus werden Teilnehmende per persönlichem QR-Code schnell und eindeutig dem richtigen Termin zugeordnet.",
        [
            ("Scannen", ["Wählen Sie zuerst den richtigen Termin und starten Sie dann den Scanner. Nach Kamerafreigabe halten Sie den Code ruhig in den Erfassungsbereich."], []),
            ("Erfolgreicher Check-in", ["Die Anwendung speichert checked_in, checked_in_at und checked_in_by über den abgesicherten Ablauf."], []),
            ("Fehlerfälle", ["Ein zweiter Scan wird als bereits eingecheckt behandelt. Unbekannte, veränderte oder zum falschen Termin gehörende Tokens werden abgewiesen."], []),
        ],
        image="admin-dashboard-checkin.png",
        caption="Vergrößerter Check-in-Ausschnitt: zuerst Termin wählen, anschließend QR-Code scannen oder links manuell suchen.",
        note=("Datenschutz", "Der Scanner verarbeitet den Token zur Zuordnung. Im QR-Code selbst stehen keine personenbezogenen Daten."))

chapter("22. Manueller Check-in",
        "Falls ein QR-Code nicht vorliegt oder die Kamera nicht verfügbar ist, unterstützt die schnelle Teilnehmersuche den manuellen Check-in.",
        [
            ("Suchen", ["Nutzen Sie Name, E-Mail, Telefon oder TSK und gleichen Sie mindestens zwei Merkmale ab."], []),
            ("Hauptaktion", ["Die Ansicht bietet für offene Fälle eine eindeutige Hauptaktion. Bereits eingecheckte Personen dürfen nicht erneut verarbeitet werden."], []),
            ("Kameraprobleme", ["Bei verweigertem Zugriff Browserberechtigung prüfen oder die manuelle Suche verwenden."], []),
        ],
        image="admin-dashboard-checkin.png",
        caption="Vergrößerter Check-in-Ausschnitt: Die manuelle Suche steht unmittelbar links neben dem Scanner-Button.")

chapter("23. Teilnehmerlisten und Termin-PDF",
        "Die vorhandene PDF-Funktion erstellt die terminbezogenen Teilnehmerunterlagen im einheitlichen Stil.",
        [
            ("Vorbereitung", ["Wählen Sie den korrekten Termin und prüfen Sie die zugrunde liegenden Teilnehmerdaten."], []),
            ("Datenschutz", ["PDFs können personenbezogene Daten enthalten. Speichern, versenden und archivieren Sie diese nur für den vorgesehenen Vereinszweck."], []),
            ("Kontrolle", ["Öffnen Sie die erzeugte PDF und prüfen Sie Seiten, Summen und Sonderzeichen vor der Weitergabe."], []),
        ],
        image="admin-teilnehmer.png",
        caption="Schematische Teilnehmerverwaltung: Der PDF-/CSV-Export befindet sich unterhalb der gefilterten Liste.")

chapter("24. Kassenbericht",
        "Der Kassenbericht dokumentiert Einnahmen eines einzelnen Impftermins für Vereinsbuchhaltung und Archivierung.",
        [
            ("Enthaltene Statistik", [], ["Teilnehmende gesamt, bezahlt und offen", "Gesamteinnahmen", "Summen nach Barzahlung, PayPal und Stripe"]),
            ("Tabelle", ["Die Liste enthält laufende Nummer, Person, Mitgliedsstatus, Tierdaten, Impfstoff, Zahlungsart, Betrag, Status und Zahlungsdatum."], []),
            ("Abschluss", ["Die Gesamteinnahmen sind hervorgehoben; darunter stehen Felder für Erstellung und Unterschrift."], []),
        ],
        image="admin-termine-aktionen.png",
        caption="Vergrößerter Ausschnitt: „Kassenbericht“ befindet sich direkt in der Aktionsleiste des jeweiligen Impftermins.")

chapter("25. Sammelimpfbescheinigung",
        "Die Sammelimpfbescheinigung wird für den ausgewählten Termin und die dafür vorgesehenen Teilnehmenden erzeugt.",
        [
            ("Auswahl", ["Prüfen Sie Termin und Teilnehmerauswahl vor der Erstellung. Unzutreffende oder unvollständige Datensätze müssen vorher geklärt werden."], []),
            ("PDF prüfen", ["Kontrollieren Sie Tierarten, Tierzahlen, Impfstoffangabe, Vereins- und Tierarztdaten."], []),
            ("Archivierung", ["Legen Sie die finale Fassung nach Vereinsvorgabe ab. Vermeiden Sie parallele, widersprüchliche Versionen."], []),
        ],
        image="admin-termine-aktionen.png",
        caption="Vergrößerter Ausschnitt: PDF- und Tierarztaktion stehen direkt beim ausgewählten Impftermin.")

chapter("26. Tierarztversand",
        "Die Sammelimpfbescheinigung kann über den vorhandenen zentralen Mailweg an die vorgesehene Tierarztadresse versendet werden.",
        [
            ("Vor dem Versand", ["Öffnen Sie das Dokument und prüfen Sie Termin, Empfänger, Betreff und Inhalt."], []),
            ("Nach dem Versand", ["Beachten Sie die Erfolgs- oder Fehlermeldung. Bei Unsicherheit nicht unkontrolliert mehrfach senden."], []),
            ("Mailtext", ["Die bestehende persönliche Anrede und der freigegebene Wortlaut bleiben Teil des Versandablaufs."], []),
        ],
        image="admin-termine-aktionen.png",
        caption="Vergrößerter Ausschnitt: „Tierarzt“ öffnet den vorhandenen Ablauf für Bescheinigung und Versand.",
        note=("Vertraulich", "Tierarztunterlagen nur an den vorgesehenen Empfänger versenden.", True))

chapter("27. Saisonerinnerungen",
        "Saisonerinnerungen sprechen frühere Teilnehmende des aktuellen Vereins für eine neue Impfsaison an.",
        [
            ("Zielgruppe", ["Die Auswahl berücksichtigt frühere Anmeldungen und die Vereinszuordnung. Testtermine dürfen den produktiven Versand nicht beeinflussen."], []),
            ("Vorbereitung", ["Prüfen Sie neuen Termin, Empfängerkreis und Mailinhalt, bevor die Kampagne startet."], []),
            ("Rücklauf", ["Neue Anmeldungen fließen in die Auswertung ein und zeigen, wie viele angeschriebene Personen zurückgekehrt sind."], []),
        ],
        image="admin-termine-aktionen.png",
        caption="Vergrößerter Ausschnitt: „Saisonmail“ gehört zur Aktionsleiste des konkreten Impftermins.")

chapter("28. Saisonkampagne auswerten",
        "Das Dashboard stellt Versand, Rückkehrer, offene Kontakte und Rücklaufquote kompakt dar.",
        [
            ("Kennzahlen lesen", ["„Versendet“ beschreibt den Empfängerkreis, „Rückkehrer“ die erneuten Anmeldungen und „Offen“ die noch fehlenden Rückmeldungen."], []),
            ("Niedrige Quote", ["Eine niedrige Rücklaufquote ist ein Hinweis, kein automatischer Fehler. Berücksichtigen Sie Versandzeitpunkt und Abstand zum Termin."], []),
            ("Datenschutz", ["Verwenden Sie die Kontaktdaten nur für den vorgesehenen Vereins- und Impfzweck."], []),
        ],
        image="admin-dashboard-saison.png",
        caption="Vergrößerter Kampagnenausschnitt: Versendet, Rückkehrer, Offen und Quote stehen nebeneinander.")

chapter("29. Adminverwaltung öffnen",
        "Nur Superadmins sehen die Adminverwaltung. Übersicht und Detailansicht werden zusätzlich serverseitig über Bearer-Token, aktive Mitgliedschaft und Rolle abgesichert.",
        [
            ("Übersicht", ["Die Tabelle zeigt E-Mail-Adresse, Verein, verständliche Rolle, Status und Erstellungsdatum ohne interne IDs."], []),
            ("Details", ["„Details anzeigen“ öffnet Vorname, Nachname, E-Mail, Rolle, Verein, Status, Erstellungsdatum und letzte Anmeldung. Fehlende Angaben erscheinen als „Nicht hinterlegt“."], []),
        ],
        image="adminverwaltung.png",
        caption="Schematische Adminverwaltung; alle Konten und Angaben sind fiktiv.")

chapter("30. Administrator einladen",
        "Superadmins können neue Administratoren über den bestehenden Adminprozess anlegen und eine Einladungs-E-Mail über den zentralen Mailweg versenden.",
        [
            ("Anlegen", ["Erfassen Sie die korrekte E-Mail-Adresse, Rolle und Vereinszuordnung. Prüfen Sie die Auswahl vor dem Absenden."], []),
            ("Einladung", ["Der Empfänger öffnet den Link auf /admin-invite. Die Supabase-Sitzung aus dem Einladungslink muss übernommen sein, bevor updateUser das neue Passwort setzt."], []),
            ("Erster Login", ["Nach erfolgreicher Passwortvergabe erfolgt die Anmeldung über den normalen Admin-Login mit der neuen E-Mail-Adresse."], []),
        ],
        image="adminverwaltung-kopf.png",
        caption="Vergrößerter Kopf der Adminverwaltung: „Neuen Administrator anlegen“ steht rechts über der Liste.",
        note=("Sicherheit", "Einladungslinks nicht weiterleiten und Rollen nach dem Minimalprinzip vergeben.", True))

chapter("31. Rollen ändern, sperren und löschen",
        "Die vier Aktionen Details, Rolle ändern, Sperren und Löschen bleiben eindeutig dem jeweiligen Administrator zugeordnet.",
        [
            ("Rolle ändern", ["Wählen Sie nur die Berechtigung, die für die Aufgabe benötigt wird. Superadmin-Rechte sind besonders restriktiv zu vergeben."], []),
            ("Sperren", ["Ein gesperrter Mitgliedschaftseintrag darf keine aktive Adminberechtigung mehr vermitteln."], []),
            ("Löschen", ["Vor einer endgültigen Löschung prüfen Sie Auswirkungen auf Nachvollziehbarkeit und Vereinsbetrieb."], []),
        ],
        image="adminverwaltung-aktionen.png",
        caption="Vergrößerter Listenausschnitt: Details, Rolle, Sperren und Löschen stehen in derselben Administratorzeile.",
        note=("Vier-Augen-Prinzip", "Kritische Rollen- oder Löschaktionen möglichst mit einer zweiten verantwortlichen Person abstimmen.", True))

chapter("32. Geflügel-Quiz",
        "Das öffentliche Geflügel-Quiz vermittelt Wissen spielerisch. Pro Runde werden zehn Fragen aus dem vorhandenen Themenbestand zusammengestellt.",
        [
            ("Quiz starten", ["Öffnen Sie „Geflügel-Quiz“ in der Navigation und beantworten Sie die Fragen nacheinander."], []),
            ("Auswertung", ["Nach jeder Antwort erhalten Sie eine Rückmeldung; am Ende zeigt die Anwendung das Rundenergebnis."], []),
            ("Neustart", ["Eine neue Runde kann andere Fragen enthalten und eignet sich zum Wiederholen."], []),
        ],
        image="quiz.png",
        caption="Öffentliches Geflügel-Quiz mit Themenübersicht.")

chapter("33. Fehlerbehebung",
        "Viele Probleme lassen sich durch eine strukturierte Prüfung eingrenzen, ohne Daten zu verändern.",
        [
            ("Anmeldung lässt sich nicht speichern", ["Pflichtfelder, Termin und Netzwerkantwort prüfen. Bei einem Datenbankfehler technischen Fehlertext aus sicheren Logs verwenden, niemals Secrets veröffentlichen."], []),
            ("E-Mail fehlt", ["Spamordner, Schreibweise der Adresse und Versandmeldung prüfen. Keine Zahlung oder Registrierung vorschnell doppelt auslösen."], []),
            ("QR-Code scannt nicht", ["Displayhelligkeit erhöhen, Kamera reinigen, Abstand verändern oder manuelle Suche verwenden."], []),
            ("Adminbereich öffnet direkt", ["Eine gültige Supabase-Sitzung kann automatisch fortgesetzt werden. Zum vollständigen Wechsel zuerst abmelden."], []),
        ])

chapter("34. Datenschutz und sichere Arbeitsweise",
        "Die Anwendung verarbeitet Kontaktdaten, Zahlungsstatus und organisatorische Angaben. Ein sorgfältiger Umgang ist deshalb Bestandteil jeder Rolle.",
        [
            ("Grundregeln", [], ["Nur erforderliche Daten anzeigen und weitergeben", "PDFs und Exportdateien geschützt speichern", "Keine Screenshots mit Echtdaten veröffentlichen", "Eigene Konten verwenden und Sitzungen abmelden"]),
            ("Mehrvereinsfähigkeit", ["Vereinsfilter und Mitgliedschaften müssen bei jeder administrativen Aktion berücksichtigt werden. Daten eines anderen Vereins dürfen nicht sichtbar oder veränderbar sein."], []),
            ("Secrets", ["Service-Role-Key, API-Schlüssel, Tokens und Passwörter gehören niemals in Browserausgaben, Screenshots oder Supportnachrichten."], []),
        ])

chapter("35. Checklisten für den Praxiseinsatz",
        "Die folgenden Kurzlisten helfen, die wichtigsten Schritte vor, während und nach dem Impftermin zuverlässig abzuarbeiten.",
        [
            ("Vor dem Termin", [], ["Vereins- und Tierarztdaten prüfen", "Termin und Anmeldungen kontrollieren", "offene Zahlungen klären", "Sammelimpfbescheinigung vorbereiten", "Check-in-Gerät laden und Internetzugang testen"]),
            ("Am Impftag", [], ["richtigen Termin auswählen", "QR-Scanner testen", "Identität bei manueller Suche sorgfältig abgleichen", "Barzahlungen korrekt verbuchen", "Doppel-Check-ins beachten"]),
            ("Nach dem Termin", [], ["Check-in-Stand prüfen", "Zahlungen abstimmen", "Kassenbericht erzeugen", "Dokumente finalisieren und sicher archivieren", "offene Fehlermeldungen dokumentieren"]),
        ],
        note=("Abschluss", "Bei Unsicherheit keine kritische Aktion erzwingen. Erst Datensatz, Rolle, Verein und Termin eindeutig prüfen."))

chapter("36. Vorteile und Voraussetzungen",
        "Der größte Nutzen entsteht, wenn Verein und Teilnehmende denselben digitalen Ablauf verwenden und die organisatorischen Grundlagen vor dem Start vollständig eingerichtet sind.",
        [
            ("Vorteile für Vereine", [], ["zentrale, aktuelle Teilnehmerliste statt paralleler Papierstände", "klarer Überblick über Tierzahlen und Zahlungen", "schneller Check-in über QR-Code", "automatisierte Bestätigungen und wiederverwendbare Dokumente", "nachvollziehbare Rollen und Vereinszuordnung"]),
            ("Vorteile für Teilnehmende", [], ["Anmeldung unabhängig von Öffnungszeiten", "transparente Termin- und Zahlungsinformationen", "persönlicher QR-Code automatisch per E-Mail", "schneller Ablauf am Impftag", "weniger Papier und Rückfragen"]),
            ("Technische Voraussetzungen", [], ["aktueller Browser mit aktiviertem JavaScript", "stabile Internetverbindung", "erreichbare E-Mail-Adresse", "für QR-Scans: Gerät mit Kamera und erteilter Kameraberechtigung", "für Admins: persönliches Konto mit aktiver Vereinsmitgliedschaft"]),
        ])

chapter("37. Häufige Fragen",
        "Die folgenden Antworten fassen typische Rückfragen aus dem Vereins- und Impfbetrieb zusammen.",
        [
            ("Kann eine andere Person die Impfung für mich abholen?", ["Ja. Voraussetzung ist, dass die Anmeldung eindeutig zugeordnet werden kann und QR-Code beziehungsweise Anmeldebestätigung vorliegt. Bei besonderen Fällen den Veranstalter vorher informieren."], []),
            ("Warum ist meine Barzahlung noch offen?", ["Barzahlung vor Ort wird bei der Registrierung nicht automatisch als bezahlt markiert. Der Status ändert sich erst nach der tatsächlichen Verbuchung im Adminbereich."], []),
            ("Kann ich denselben QR-Code zweimal verwenden?", ["Nein. Nach erfolgreichem Check-in ist die Person als eingecheckt gespeichert. Ein erneuter Scan wird entsprechend als bereits verarbeitet behandelt."], []),
            ("Warum sehe ich die Adminverwaltung nicht?", ["Sie ist ausschließlich für eine aktive Superadmin-Mitgliedschaft sichtbar und serverseitig geschützt."], []),
            ("Funktioniert die Startbildschirm-Verknüpfung offline?", ["Nein. Sie erleichtert den Start, benötigt für aktuelle Daten, Anmeldung, Check-in und Zahlungen jedoch Internet."], []),
            ("Was tun bei einer falschen E-Mail-Adresse?", ["Den Veranstalter zeitnah informieren. Änderungen nur nach eindeutiger Zuordnung im vorhandenen Verwaltungsablauf durchführen."], []),
        ])

chapter("38. Schritt-für-Schritt-Kurzreferenz",
        "Diese Kurzreferenz bündelt die häufigsten Arbeitsabläufe in einer festen Reihenfolge.",
        [
            ("Neuen Administrator einladen", [], ["1. Als Superadmin die Adminverwaltung öffnen.", "2. „Neuen Administrator anlegen“ wählen.", "3. E-Mail, Rolle und Verein sorgfältig eintragen.", "4. Angaben prüfen und Einladung auslösen.", "5. Empfänger öffnet den Link und legt ein Passwort fest.", "6. Erstanmeldung im normalen Admin-Login prüfen."]),
            ("Impftermin vorbereiten", [], ["1. Termin mit Datum, Uhrzeit und Ort anlegen.", "2. Öffentliche Darstellung kontrollieren.", "3. Anmeldungen und Tierzahlen beobachten.", "4. Offene Zahlungen rechtzeitig prüfen.", "5. Sammelimpfbescheinigung erzeugen und kontrollieren.", "6. Check-in-Gerät und Internetzugang testen."]),
            ("Teilnehmer einchecken", [], ["1. Richtigen Impftermin auswählen.", "2. QR-Scanner öffnen und Kamerazugriff erlauben.", "3. QR-Code vollständig erfassen.", "4. Erfolgsmeldung und richtige Person kontrollieren.", "5. Bei Scanproblemen manuelle Suche verwenden.", "6. Doppel- oder Fehlermeldungen nicht übergehen."]),
            ("Kassenbericht erstellen", [], ["1. Gewünschten Einzeltermin öffnen.", "2. Zahlungsstände auf Vollständigkeit prüfen.", "3. „Kassenbericht“ wählen.", "4. erzeugte PDF und Summen kontrollieren.", "5. Erstellung und Unterschrift ergänzen.", "6. Dokument nach Vereinsvorgabe archivieren."]),
        ],
        note=("Praxisregel", "Jede kritische Aktion beginnt mit derselben Prüfung: richtiger Verein, richtiger Termin, richtiger Datensatz."))


OUTPUT.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)
doc = ManualDoc(str(PDF))
doc.multiBuild(story)
copy2(PDF, PUBLIC_PDF)
MD.write_text("\n".join(md_lines), encoding="utf-8")
print(f"PDF: {PDF}")
print(f"Public copy: {PUBLIC_PDF}")
