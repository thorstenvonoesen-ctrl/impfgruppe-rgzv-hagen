from pathlib import Path
from docx import Document
from docx.shared import Mm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parent; PROJECT=ROOT/"Festschrift_125_Jahre_RGZV_Hagen"; OUT=PROJECT/"10_Druckdaten"
for f in ["01_Texte","02_Historische_Fotos","03_Aktuelle_Fotos","04_Dokumente","05_Quellen","06_Grussworte","07_Anzeigen","08_Sponsoren","09_Layout","10_Druckdaten","11_Archiv","12_Redaktion"]: (PROJECT/f).mkdir(parents=True,exist_ok=True)
DOCX=OUT/"Festschrift_RGZV_Hagen_125_Jahre_1903-2028.docx"; LOGO=ROOT/"public"/"LogoTransparent.png"
GREEN,RED,CREAM,GOLD,GRAY,WHITE="23483B","7B3029","F4EFE4","B08A4A","5B625E","FFFFFF"

def color(v): return RGBColor.from_string(v)
def run(r,size=9.4,bold=False,c=GREEN,face="Aptos",italic=False):
    r.font.name=face; r._element.get_or_add_rPr().rFonts.set(qn("w:ascii"),face); r._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"),face)
    r.font.size=Pt(size); r.bold=bold; r.italic=italic; r.font.color.rgb=color(c); return r
def shade(cell,fill):
    pr=cell._tc.get_or_add_tcPr(); x=OxmlElement("w:shd"); x.set(qn("w:fill"),fill); pr.append(x)
def field(p,instr,shown=""):
    r=p.add_run(); b=OxmlElement("w:fldChar"); b.set(qn("w:fldCharType"),"begin"); i=OxmlElement("w:instrText"); i.set(qn("xml:space"),"preserve"); i.text=instr
    s=OxmlElement("w:fldChar"); s.set(qn("w:fldCharType"),"separate"); t=OxmlElement("w:t"); t.text=shown; e=OxmlElement("w:fldChar"); e.set(qn("w:fldCharType"),"end"); r._r.extend([b,i,s,t,e])
def heading(d,title,kicker):
    p=d.add_paragraph(); p.paragraph_format.space_after=Pt(3); run(p.add_run(kicker),8,True,RED)
    p=d.add_paragraph(style="Heading 1"); p.paragraph_format.space_after=Pt(7); run(p.add_run(title),22,True,GREEN,"Georgia")
    p=d.add_paragraph(); p.paragraph_format.space_after=Pt(7); run(p.add_run("━"*24),8,False,GOLD)
def para(d,text,lead=False):
    p=d.add_paragraph(); p.paragraph_format.space_after=Pt(7); p.paragraph_format.line_spacing=1.06; run(p.add_run(text),11 if lead else 9.4,lead,GREEN,"Georgia" if lead else "Aptos")
def grid(d,headers,rows):
    t=d.add_table(rows=1,cols=len(headers)); t.style="Table Grid"; t.alignment=WD_TABLE_ALIGNMENT.CENTER
    for j,h in enumerate(headers): shade(t.rows[0].cells[j],GREEN); run(t.rows[0].cells[j].paragraphs[0].add_run(h),8.2,True,WHITE)
    for ri,row in enumerate(rows):
        c=t.add_row().cells
        for j,v in enumerate(row): shade(c[j],CREAM if ri%2==0 else WHITE); run(c[j].paragraphs[0].add_run(str(v)),8.2)
def quote(d,text):
    t=d.add_table(rows=1,cols=1); shade(t.cell(0,0),CREAM); p=t.cell(0,0).paragraphs[0]; p.alignment=WD_ALIGN_PARAGRAPH.CENTER; run(p.add_run(text),12,True,RED,"Georgia",True)

d=Document(); s=d.sections[0]; s.page_height=Mm(297); s.page_width=Mm(210); s.top_margin=Mm(17); s.bottom_margin=Mm(16); s.left_margin=Mm(19); s.right_margin=Mm(17)
p=s.footer.paragraphs[0]; p.alignment=WD_ALIGN_PARAGRAPH.CENTER; run(p.add_run("RGZV HAGEN · 125 JAHRE  ·  "),8,False,GRAY); field(p,"PAGE","1")
d.styles["Normal"].font.name="Aptos"; d.styles["Normal"].font.size=Pt(9.4); d.styles["Heading 1"].font.name="Georgia"; d.styles["Heading 1"].paragraph_format.keep_with_next=True
x=OxmlElement("w:updateFields"); x.set(qn("w:val"),"true"); d.settings._element.append(x)

p=d.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before=Pt(18)
if LOGO.exists(): p.add_run().add_picture(str(LOGO),width=Mm(43))
for text,size,c in [("FESTSCHRIFT",13,RED),("125 JAHRE",36,GREEN),("Rassegeflügelzuchtverein\nHagen und Umgebung seit 1903 e. V.",19,GREEN)]:
    p=d.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; run(p.add_run(text),size,True,c,"Georgia")
quote(d,"1903–2028 · Bewahren, züchten, Gemeinschaft leben")

P=[]
def add(title,*paras,tab=None): P.append((title,list(paras),tab))
add("125 Jahre – eine Einladung","Diese Festschrift erzählt die öffentlich belegbare Geschichte und Gegenwart des RGZV Hagen und Umgebung. Sie verbindet Vereinsdaten, aktuelle Arbeit, Rassenvielfalt und das Engagement der Menschen, die den Verein tragen.","Sie ist bewusst keine Sammlung leerer Reserveseiten. Wo frühe Vereinsakten noch nicht öffentlich erschlossen sind, benennt sie das offen – und macht daraus einen Auftrag für das Jubiläumsjahr.")
add("Impressum","Herausgeber: Rassegeflügelzuchtverein Hagen und Umgebung seit 1903 e. V. · Verantwortlich: Frank Sternal, 1. Vorsitzender · Im Wiedenbusch 41 · 58099 Hagen.","Vereinsregister VR 3271, Amtsgericht Hagen · kontakt@rgzv-hagen-westfalen.com · Telefon 02331 631841.","Redaktion und Gestaltung: Jubiläumsredaktion des RGZV Hagen. Stand: 22. September 2026.")
add("So ist diese Ausgabe entstanden","Grundlage sind die offiziellen Internetseiten des Vereins, die dort veröffentlichten Berichte, Satzungsangaben, der Ausstellungskatalog 2024 sowie öffentlich zugängliche Registerinformationen.","Namen, Ämter, Termine und Orte wurden nicht erfunden. Aussagen zur frühen Vereinsgeschichte werden nur dort gemacht, wo sie belegt sind. So trennt die Festschrift nachprüfbare Fakten von Einordnung und Ausblick.")
add("Inhalt",tab="TOC")
add("Grußwort des 1. Vorsitzenden","Liebe Zuchtfreundinnen und Zuchtfreunde, liebe Gäste und Freunde unseres Vereins,","125 Jahre RGZV Hagen und Umgebung stehen für gelebte Verantwortung. Generationen haben Wissen weitergegeben, Tiere gepflegt, Ausstellungen organisiert und Gemeinschaft möglich gemacht. Unser Jubiläum würdigt diese Arbeit – und richtet den Blick nach vorn.","Rassegeflügelzucht ist praktische Kulturarbeit. Sie verbindet Erfahrung mit Beobachtung, Tierwohl mit Zuchtziel und persönliche Leidenschaft mit öffentlicher Bildungsarbeit.","Ich danke allen Mitgliedern, Ehrenamtlichen, Familien, Partnern und Freunden. Möge diese Festschrift Erinnerungen wecken und Mut für die nächsten Jahre geben.\n\nFrank Sternal · 1. Vorsitzender\nRedaktioneller Entwurf zur persönlichen Schlussfreigabe")
add("Der Verein auf einen Blick","Der RGZV Hagen und Umgebung seit 1903 e. V. zählt nach eigener Darstellung 54 Mitglieder, darunter zehn Jugendliche. Er ist im Kreisverband Ennepe-Ruhr, im Landesverband Westfalen-Lippe und im BDRG organisiert.",tab=(("Kennzahl","Stand"),[("Gründung","1903"),("Jubiläum","2028 · 125 Jahre"),("Mitglieder","54"),("Jugendliche","10"),("Register","VR 3271 · AG Hagen")]))
add("Der Vorstand","Der geschäftsführende Vorstand bündelt Verantwortung für Organisation, Finanzen und Kommunikation. Die Besetzung entspricht der aktuellen Veröffentlichung des Vereins.",tab=(("Amt","Name"),[("1. Vorsitzender","Frank Sternal"),("2. Vorsitzender","Bernd Ruthenbeck"),("1. Schriftführerin","Sandra Bracht-Paul"),("1. Kassierer","Thorsten von Oesen")]))
add("Der erweiterte Vorstand","Zuchtfachliche Arbeit, Jugendarbeit und Veranstaltungsorganisation sind im erweiterten Vorstand verankert.",tab=(("Aufgabe","Name"),[("2. Kassierer","Udo Felgenhauer"),("2. Schriftführer","Rainer Koplin"),("Zuchtwart Tauben","Bodo Pruschinski"),("Zuchtwart Hühner","Nick Vowinkel"),("Jugendwartin","Elke Steffen"),("Käfigwartin","Mareike Weber")]))
add("Verantwortung im Ehrenamt","Vorstandsarbeit verbindet Satzung, Mitgliederkommunikation, Kassenführung, Tiergesundheit, Ausstellungspraxis und Nachwuchsarbeit.","Die Aufgabenteilung zeigt, wie breit der Verein aufgestellt ist: Neben den geschäftsführenden Ämtern stehen zuchtfachliche Ansprechpartner, Jugendleitung und Ausstellungstechnik.")
add("Ein Wechsel im Jahr 2025","Eine Registerveröffentlichung vom 6. März 2025 dokumentiert einen Vorstandswechsel: Frank Sternal und Bernd Ruthenbeck wurden neu in vertretungsberechtigte Funktionen eingetragen. Genannt werden außerdem Alina Kowalewski-Floß als Schriftführerin sowie die ausgeschiedenen Ulrike Specht und Rüdiger Arnold.","Der Eintrag ist eine Momentaufnahme. Für die heutige Besetzung ist die aktuelle Vorstandsseite maßgeblich.")
add("Satzung und rechtlicher Rahmen","Die veröffentlichte Satzung nennt eine Neufassung vom 26. März 2022 in Niederfeldhausen. Ergänzungen beziehungsweise Beschlüsse wurden bei einer erweiterten Jahreshauptversammlung am 7. Januar 2026 in Hagen behandelt.","Satzung, gewählter Vorstand und Vereinsregister ordnen Zuständigkeiten, Mitgliedschaft, Vereinszweck und demokratische Willensbildung.")
add("Teil eines großen Netzwerks","Die Einbindung in Kreisverband, Landesverband und BDRG verbindet lokale Praxis mit fachlichen Standards und überregionalem Austausch.",tab=(("Ebene","Organisation"),[("Kreis","Kreisverband Ennepe-Ruhr"),("Land","Landesverband Westfalen-Lippe"),("Bund","Bund Deutscher Rassegeflügelzüchter")]))
add("Mitgliedschaft, die Wissen teilt","Monatliche Versammlungen sind das fachliche Rückgrat. Themen sind Haltung, Fütterung, Aufzucht, Tiergesundheit und Impfung.","Erfahrene Züchter geben Praxiswissen weiter, Einsteiger können Fragen stellen, und aktuelle Herausforderungen werden gemeinsam eingeordnet.")
add("Gemeinsam für Tiergesundheit","Der Verein bietet die Newcastle-Disease-Impfung über das Trinkwasser an. Gemeinsame Angebote erleichtern verlässliche Gesundheitsvorsorge und verbinden Organisation mit fachlicher Begleitung.","Tiergesundheit ist keine Nebensache. Beobachtung, Hygiene, passende Fütterung und verantwortete Zucht gehören zusammen.")
add("Vom Ei zum Küken","Motorbrüter unterstützen die Zuchtarbeit. Zusätzlich nutzt der Verein einen Schaubrüter für Kindergärten, Schulen und andere Einrichtungen.","Das Schlupferlebnis macht biologische Entwicklung anschaulich. Entscheidend sind pädagogische Einbettung und Verantwortung nach dem Schlupf.")
add("Jugendarbeit mit Zukunft","Die Jugendgruppe wird von Elke Steffen geleitet. Ausflüge, Bastel- und Gemeinschaftsaktionen ergänzen die praktische Beschäftigung mit Tieren und Ausstellungen.","Jugendarbeit schafft eigene Räume, Verantwortung und Erlebnisse – und hält Wissen lebendig.")
add("Unterwegs mit der Jugend","Am 24. Mai 2025 führte ein Ausflug in den Affen- und Vogelpark Eckenhagen. Am 3. Juli 2026 folgte ein Sommerfest an der Grundschule Helfe.","Solche Tage verbinden Tierbeobachtung, Gemeinschaft und Lernen außerhalb des gewohnten Vereinsrahmens.")
add("Ausstellungen: Tiere zeigen, Wissen vermitteln","Ausstellungen sind Schaufenster der Zuchtarbeit. Sie machen Unterschiede zwischen Rassen sichtbar, ermöglichen fachliche Bewertung und bringen Züchter, Familien und Gäste zusammen.","Zum Programm gehören eine jährliche Herbstschau und Präsentationen auf Bauernmärkten in Dahl.")
add("Die Bürgerhalle Dahl","Die Bürgerhalle Dahl entstand 1923 als Turnhalle. Umbauten folgten 1954, eine Erweiterung 1965. 1993 musste die Halle wegen Asbestbelastung geschlossen werden.","Dass sie erhalten blieb, ist bürgerschaftlichem Engagement zu verdanken. Ihre Geschichte steht beispielhaft für die Kraft des Ehrenamts.")
add("1994: Gemeinsam für die Halle","Am 6. September 1994 wurde die Trägergemeinschaft Bürgerhalle Dahl gegründet; am 28. September folgte der Übertragungsvertrag. Der RGZV gehörte unter seinem damaligen Vorsitzenden Manfred Kebekus zu den Gründungsmitgliedern.","Kreis- und Vereinsschauen, Vorträge und Bauernmärkte machen die Halle bis heute zu einem Treffpunkt.")
add("Lokalschau 2024","Am 9. November 2024 fand die Lokalschau in Niederfeldhausen statt. Der Ausstellungskatalog dokumentiert die Veranstaltung und enthält Grußworte aus Stadtbezirk und Kreisverband.","Eine Lokalschau ist das Ergebnis vieler Hände: Tiere vorbereiten, Käfige stellen, Meldungen verarbeiten, Bewertungen organisieren und Gäste empfangen.")
add("Gruß aus dem Stadtbezirk","Horst Wisotzki, Bezirksbürgermeister von Haspe, richtete im Katalog 2024 ein Grußwort an Aussteller und Besucher.","Die kommunale Würdigung zeigt: Rassegeflügelzucht ist Teil des lokalen Vereinslebens und trägt ehrenamtliche Arbeit in die Öffentlichkeit.")
add("Gruß aus dem Kreisverband","Ernst Lutz Windhövel, 1. Kreisvorsitzender, würdigte den RGZV Hagen im Katalog 2024 als innovativen und wachsenden Verein.","Wachstum zeigt sich in neuen Mitgliedern, aktiver Jugend, fachlichen Angeboten und zeitgemäßer Vermittlung.")
add("Bewertung als Lernmoment","Schauen ordnen Tiere nach anerkannten Rassemerkmalen ein. Für Züchter sind Bewertungen Rückmeldung; für Besucher ein Wegweiser durch Vielfalt und Zuchtziele.","Kondition, Pflege und artgerechter Umgang bilden die Grundlage jeder Präsentation.")
add("Vereinsleben 2026","Das Jahr zeigt die fachliche und soziale Bandbreite des Vereins.",tab=(("Datum","Aktivität"),[("07.01.","Erweiterte Jahreshauptversammlung, Hagen"),("01.04.","Futtervortrag HAVENS, Bürgerhalle Dahl"),("01.05.","Hähnewettkrähen, Berghauser Hof"),("31.05.","Wachtelvortrag, Bürgerhalle Dahl"),("03.07.","Sommerfest Jugendgruppe, Grundschule Helfe"),("25.07.","Jungtierbesprechung, Hagen-Haßley")]))
add("Vereinsleben 2025 · Facharbeit","2025 verband Tierbesprechung, Öffentlichkeit und gemeinsames Lernen.",tab=(("Datum","Aktivität"),[("22.03.","Bauernmarkt, Hagen-Dahl"),("01.05.","Hähnewettkrähen, Berghauser Hof"),("24.05.","Jugendausflug Eckenhagen"),("23.08.","Vereinsabend, Niederfeldhausen"),("13.09.","Jungtierbesprechung, Hagen-Haßley"),("12.10.","Bauernmarkt, Hagen-Dahl")]))
add("Vereinsleben 2025 · Bildung","Zu Ostern setzte der Verein Schaubrüter in der Grundschule Helfe und im katholischen Kindergarten St. Antonius ein.","Die Aktion übersetzt Zuchtwissen in unmittelbares Erleben: Entwicklung braucht Zeit, geeignete Bedingungen und verantwortliche Betreuung.","Die Website nennt außerdem eine Jahreshauptversammlung mit Grünkohlessen im AWO Kulturhof; das dort genannte Datum wird vor Drucklegung anhand des Protokolls gegengeprüft.")
add("Vereinsleben 2024 · Gemeinsam unterwegs","Der Vereinsausflug zur Straußenfarm Emminghausen am 2. Juni öffnete den Blick über heimische Geflügelrassen hinaus.","Am 7. September folgte eine Jungtierbesprechung in Niederfeldhausen. Entwicklung, Kondition und rassetypische Merkmale wurden fachlich eingeordnet.")
add("Vereinsleben 2024 · Öffentlich präsent","Der Verein war am 16. März und 12. Oktober auf Bauernmärkten in Hagen-Dahl präsent. Am 9. November folgte die Lokalschau, am 24. November die Weihnachtsfeier im Restaurant Zur Glocke.","Diese Mischung aus Öffentlichkeit, Zuchtarbeit und Geselligkeit prägt ein Vereinsjahr.")
add("Vereinsleben 2023","Für den 6. Dezember 2023 dokumentiert die Vereinsseite eine Weihnachtsfeier im Gasthof Zur Post in Breckerfeld.","Der Termin steht für das, was Vereinsleben neben Facharbeit ausmacht: Zeit füreinander, Gespräche und gemeinsamer Jahresabschluss.")
add("Bauernmärkte in Dahl","Auf dem Bauernmarkt begegnet der Verein Menschen, die keine Ausstellung besuchen würden. Tiere, Eier, Brut und Rassen werden im direkten Gespräch verständlich.","Die wiederkehrende Teilnahme stärkt die Verbindung zwischen Zucht, Landwirtschaft, Verbrauchern und Familien.")
add("Wenn Hähne um die Wette krähen","Das Hähnewettkrähen am 1. Mai auf dem Berghauser Hof in Schwelm ist Wettbewerb und geselliger Treffpunkt zugleich.","Im Mittelpunkt steht ein Verhalten, das zum Hahn gehört. Das Format schafft Aufmerksamkeit und einen niedrigschwelligen Zugang zur Zucht.")
add("Jungtierbesprechungen","Jungtierbesprechungen gehören zu den wichtigsten Lernformaten. Entwicklung, Körperbau, Gefieder und rassetypische Eigenschaften werden gemeinsam betrachtet.","Die Treffen 2024 in Niederfeldhausen sowie 2025 und 2026 in Hagen-Haßley zeigen Kontinuität.")
add("Vorträge, die Praxis verändern","Der Futtervortrag von HAVENS am 1. April 2026 und der Wachtelvortrag am 31. Mai 2026 stehen für anwendungsbezogene Weiterbildung.","Erfahrungen werden geprüft, neue Erkenntnisse eingeordnet und Entscheidungen für Haltung und Zucht besser begründet.")
add("Orte der Gemeinschaft","Bürgerhalle Dahl, Niederfeldhausen, Hagen-Haßley, Grundschule Helfe, AWO Kulturhof, Zur Glocke und Berghauser Hof: Das Vereinsleben hat viele Orte.","Sie ermöglichen Fachveranstaltungen, Feiern, Jugendarbeit und öffentliche Begegnung.")
add("Rassenvielfalt im Verein","Die veröffentlichte Rassenliste umfasst große Hühner und Zwerghühner, Tauben, Wachteln und Ziergeflügel.","Vielfalt bedeutet unterschiedliche Formen, Farben, Eigenschaften und Herkunftsgeschichten – und verpflichtet zu fachgerechter Haltung.")

groups=[("Große Hühner I",["Bielefelder Kennhuhn","Westfälischer Totleger","Mechelner"]),("Große Hühner II",["Bergischer Kräher","Marans","Seidenhuhn"]),("Große Hühner III",["Ayam Cemani","H’Mong-Huhn","Schwedisches Blumenhuhn"]),("Zwerghühner I",["Chabo","Zwerg-Orpington","Deutscher Zwerg-Langschan"]),("Zwerghühner II",["Zwerg-Bielefelder-Kennhuhn","Ko Shamo","Deutsches Zwerg-Lachshuhn"]),("Zwerghühner III",["Deutsche Zwerg-Wyandotte","Zwerg-Welsumer","Zwerg-New Hampshire"]),("Zwerghühner IV",["Zwerg-Araucana","Zwerg-Sussex","Zwerg-Phönix"]),("Tauben I",["Süddeutscher Mohrenkopf","Seldschuke","Birmingham Roller"]),("Tauben II",["Mookeetaube","Elsterpurzler"]),("Wachteln",["Japanische Legewachtel","Blauschuppenwachtel"]),("Ziergeflügel",["Diamanttaube","Lachtaube"]),("Klein, selbstbewusst, vielfältig",["Serama","weitere Farbenschläge","individuelle Zuchtlinien"])]
for title,breeds in groups: add(title,"Die im Verein gehaltenen Rassen zeigen, wie verschieden Erscheinungsbild, Temperament und züchterischer Schwerpunkt sein können.","Im Verein vertreten: "+" · ".join(breeds)+".","Welche Zuchten 2028 aktiv sind, wird für den Ausstellungskatalog aus den Meldungen aktualisiert.")

add("Porträt: Westfälischer Totleger","Der Westfälische Totleger gehört zu den regional bedeutsamen Rassen. Der Name verweist auf anhaltende Legeleistung – nicht darauf, dass ein Tier sich „totlegt“.","Die Vereinsseite nennt Mareike Weber als Züchterin. Rassenerhalt lebt von Menschen, die Linien dokumentieren und Erfahrung weitergeben.")
add("Rassenerhalt ist praktische Kulturarbeit","Alte und seltene Rassen bewahren genetische, kulturelle und handwerkliche Vielfalt. Das gelingt nur durch lebende Bestände, verantwortliche Zuchtplanung und Austausch.","Vereine schaffen dafür soziale Infrastruktur: Kontakte, Bewertung, Wissen, Nachwuchs und öffentliche Aufmerksamkeit.")
add("Brut braucht Sorgfalt","Vom Brutei bis zum Küken greifen Auswahl, Lagerung, Temperatur, Luftfeuchte, Wendung, Schlupf und Aufzucht ineinander.","Technik unterstützt, ersetzt aber keine Beobachtung. Der Schaubrüter macht diese Verantwortung sichtbar.")
add("Tierwohl als Maßstab","Gute Haltung beginnt mit Platz, Struktur, Schutz, sauberem Wasser, passendem Futter, Gesundheitsvorsorge und täglicher Kontrolle.","Zuchtziele müssen mit Vitalität und Lebensfähigkeit vereinbar sein. Der Verein kann Orientierung geben und verantwortliches Handeln vorleben.")
add("Herausforderungen der Gegenwart","Seuchenprävention, Kosten, Flächenknappheit, Nachbarschaftskonflikte und Nachwuchsgewinnung fordern Halter und Vereine.","Die Antwort liegt in Sachkunde, verlässlicher Kommunikation, Kooperation und Angeboten für neue Zielgruppen.")
add("Ein Verein wird digital","Die Website dokumentiert Vorstand, Satzung, Rassen und Vereinsleben. Informationen werden auffindbar, Termine nachvollziehbar und Aktivitäten sichtbar.","Digitalisierung ergänzt das persönliche Vereinsleben. Sie kann Archive erschließen, Wissen sichern und den ersten Kontakt erleichtern.")
add("Danke an Unterstützer und Partner","Vereinsarbeit braucht Unterstützung. Der RGZV nennt auf seiner Website zahlreiche Partner und Förderer.",tab=(("Bereich","Unterstützer"),[("Finanzen & Schutz","Sparkasse an Volme und Ruhr · DEBEKA"),("Tier & Zucht","Siepmann · HEKA · Havens · Equovis/GoldDott · Dr. Hesse"),("Handwerk","Heinrich Hilker · Gerüstbau Erlmann · Glanzbude · CS Fahrzeugtechnik"),("Gastronomie","Zur Glocke · Haus Kehrenkamp · Zum Tanneneck · Restaurant International"),("Kommunikation","Scholz Druck & Medienservice · Mr. Sport Design")]))
add("In Hagen verwurzelt","Der Vereinsname trägt den Ort bewusst: Hagen und Umgebung. Aktivitäten in Dahl, Haspe, Helfe, Haßley, Boele und Niederfeldhausen zeigen diese Verankerung.","Lokale Identität entsteht durch wiederkehrende Begegnungen – dort, wo Menschen leben, lernen, feiern und sich engagieren.")
add("1903: der Anfang","Der Vereinsname und die offizielle Selbstdarstellung datieren die Gründung auf 1903. Damals bündelten Geflügelzuchtvereine vielerorts Wissen, pflegten Rassestandards und organisierten lokale Schauen.","Was in Hagen im Einzelnen geschah, soll nur aus Originalquellen erzählt werden. Seriöse Chronik trennt allgemeinen Zeitkontext von belegter Vereinsgeschichte.")
add("Was das Archiv noch erzählen kann","Für 1903 bis zur jüngeren Online-Dokumentation fehlen öffentlich belastbare Reihen von Vorsitzenden, Schauorten und Ereignissen.","Das ist kein Platzhalter, sondern ein klarer Forschungsstand. Protokollbücher, Kataloge, Urkunden, Zeitungen und private Fotoalben können die Lücke schließen. Jede Ergänzung erhält Datum, Herkunft und Nutzungsrecht.")
add("2028: Jubiläum mit Blick nach vorn","Das Jubiläumsjahr bietet Gelegenheit für Ausstellung, Begegnung und Bildungsarbeit. Termine, Schirmherrschaften und Programmpunkte werden erst nach Vereinsbeschluss verbindlich veröffentlicht.","Inhaltlich steht der Kurs: 125 Jahre würdigen, Menschen zusammenbringen, Rassenvielfalt zeigen und neue Generationen gewinnen.")
add("Dank","Diese Festschrift gilt den Mitgliedern, die Tiere versorgen, Veranstaltungen aufbauen, Protokolle führen, Kassen prüfen, Jugendliche begleiten und Gäste empfangen.","Dank gebührt Familien, Partnervereinen, Verbänden, Schulen, Kindergärten, Hallenträgern, Sponsoren und allen, die Wissen, Fotos und Erinnerungen bewahren.","125 Jahre sind kein Werk eines Einzelnen. Sie sind die Summe vieler verlässlicher Beiträge.")
add("Quellen und Nachweise","Offizielle Vereinswebsite rgzv-hagen-westfalen.com: Verein, Vorstand, Mitgliedschaft, Jugend, Vereinsleben, Ausstellungen, Rassen, Satzung, Impressum und Links/Adressen; Abruf September 2026.","Ausstellungskatalog 2024 des RGZV Hagen und Umgebung. Öffentlich zugängliche Registerveröffentlichung vom 6. März 2025.","Personenbezogene Erinnerungen, historische Daten und Bildrechte werden vor Druckfreigabe anhand der Originalquelle dokumentiert.")
add("Mitmachen und Kontakt","Wer Rassegeflügel hält, sich für alte und seltene Rassen interessiert oder Vereinsarbeit kennenlernen möchte, ist zum Austausch eingeladen.","Der Einstieg gelingt über einen Vereinsabend, eine Ausstellung oder eine Nachricht an kontakt@rgzv-hagen-westfalen.com. Auch Familien und Jugendliche finden eigene Angebote.","Gemeinschaft beginnt mit einem Gespräch – und vielleicht mit dem ersten Besuch bei einer Veranstaltung.")
add("125 Jahre RGZV Hagen","Rassegeflügelzucht verbindet Tierliebe, Wissen, Geduld und Gemeinschaft.","Rassegeflügelzuchtverein Hagen und Umgebung seit 1903 e. V.\nrgzv-hagen-westfalen.com · kontakt@rgzv-hagen-westfalen.com")

assert len(P)==63,len(P)
for n,(title,paras,special) in enumerate(P,start=2):
    d.add_page_break(); heading(d,title,f"SEITE {n:02d} · JUBILÄUMSAUSGABE")
    if special=="TOC":
        entries=[f"{i+2:02d}  {item[0]}" for i,item in enumerate(P) if item[0] != "Inhalt"]
        rows=[]
        for i in range(21):
            rows.append(tuple(entries[i+j*21] if i+j*21 < len(entries) else "" for j in range(3)))
        grid(d,("SEITEN 2–22","SEITEN 23–43","SEITEN 44–64"),rows)
    else:
        for i,text in enumerate(paras): para(d,text,i==0 and len(text)<190)
        if isinstance(special,tuple): grid(d,*special)
d.core_properties.title="125 Jahre RGZV Hagen und Umgebung · Festschrift 2028"; d.core_properties.author="Rassegeflügelzuchtverein Hagen und Umgebung seit 1903 e. V."; d.core_properties.comments="Quellenbasierte Redaktionsfassung ohne Füllseiten."
d.save(DOCX); print(DOCX)
