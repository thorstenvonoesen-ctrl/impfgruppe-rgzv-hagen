from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Flowable)
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.legends import Legend
from reportlab.graphics.widgets.markers import makeMarker
from reportlab.graphics.charts.textlabels import Label
from reportlab.graphics.charts.lineplots import LinePlot
import os, math, textwrap

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'output', 'pdf', 'Steuerliche_Analyse_RGZV_Hagen_2026.pdf')
os.makedirs(os.path.dirname(OUT), exist_ok=True)

NAVY = colors.HexColor('#17324D'); BLUE = colors.HexColor('#246B8E')
TEAL = colors.HexColor('#2A9D8F'); GREEN = colors.HexColor('#3A7D44')
AMBER = colors.HexColor('#E9A23B'); RED = colors.HexColor('#C84B4B')
CREAM = colors.HexColor('#F5F1E8'); LIGHT = colors.HexColor('#EDF3F6')
MID = colors.HexColor('#D5E1E7'); DARK = colors.HexColor('#22313A')
GRAY = colors.HexColor('#647581'); WHITE = colors.white

fonts = [
    ('Inter', r'C:\Windows\Fonts\arial.ttf'),
    ('InterB', r'C:\Windows\Fonts\arialbd.ttf'),
    ('InterI', r'C:\Windows\Fonts\ariali.ttf'),
]
for n,p in fonts:
    if os.path.exists(p): pdfmetrics.registerFont(TTFont(n,p))

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleX', fontName='InterB', fontSize=27, leading=31, textColor=WHITE, spaceAfter=10))
styles.add(ParagraphStyle(name='SubTitleX', fontName='Inter', fontSize=13, leading=18, textColor=colors.HexColor('#D8E8EF')))
styles.add(ParagraphStyle(name='H1X', fontName='InterB', fontSize=20, leading=24, textColor=NAVY, spaceAfter=8))
styles.add(ParagraphStyle(name='H2X', fontName='InterB', fontSize=12.5, leading=16, textColor=BLUE, spaceBefore=7, spaceAfter=4))
styles.add(ParagraphStyle(name='BodyX', fontName='Inter', fontSize=9.1, leading=12.4, textColor=DARK, spaceAfter=5))
styles.add(ParagraphStyle(name='SmallX', fontName='Inter', fontSize=7.4, leading=9.5, textColor=GRAY))
styles.add(ParagraphStyle(name='TinyX', fontName='Inter', fontSize=6.6, leading=8, textColor=GRAY))
styles.add(ParagraphStyle(name='QuoteX', fontName='InterI', fontSize=9, leading=12, leftIndent=8, rightIndent=8, textColor=NAVY))
styles.add(ParagraphStyle(name='BoxTitle', fontName='InterB', fontSize=10, leading=12, textColor=NAVY, spaceAfter=3))
styles.add(ParagraphStyle(name='BoxBody', fontName='Inter', fontSize=8.3, leading=11, textColor=DARK))
styles.add(ParagraphStyle(name='TableHead', fontName='InterB', fontSize=7.4, leading=9, textColor=WHITE))
styles.add(ParagraphStyle(name='TableCell', fontName='Inter', fontSize=7.2, leading=9, textColor=DARK))
styles.add(ParagraphStyle(name='TableCellB', fontName='InterB', fontSize=7.2, leading=9, textColor=DARK))
styles.add(ParagraphStyle(name='KPI', fontName='InterB', fontSize=18, leading=20, textColor=NAVY, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='KPILabel', fontName='Inter', fontSize=7.2, leading=9, textColor=GRAY, alignment=TA_CENTER))

def P(txt, style='BodyX'):
    return Paragraph(txt, styles[style])

def money(v):
    return f"{v:,.2f} €".replace(',', 'X').replace('.', ',').replace('X','.')

def bullets(items, size='BodyX'):
    return [P('• '+x, size) for x in items]

class Ampel(Flowable):
    def __init__(self, status, label, width=170*mm):
        super().__init__(); self.status=status; self.label=label; self.width=width; self.height=12*mm
    def draw(self):
        c=self.canv; cols={'rot':RED,'gelb':AMBER,'grün':GREEN}; col=cols[self.status]
        c.setFillColor(colors.Color(col.red,col.green,col.blue,alpha=.13)); c.roundRect(0,0,self.width,self.height,3*mm,fill=1,stroke=0)
        c.setFillColor(col); c.circle(6*mm,6*mm,2.2*mm,fill=1,stroke=0)
        c.setFont('InterB',9); c.drawString(12*mm,4.2*mm,self.label)

def box(title, body, color=TEAL):
    t=Table([[P(title,'BoxTitle')],[P(body,'BoxBody')]], colWidths=[170*mm])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.Color(color.red,color.green,color.blue,alpha=.08)),
        ('BOX',(0,0),(-1,-1),0.8,color),('LINEBEFORE',(0,0),(0,-1),4,color),
        ('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    return t

def table(data, widths, header=True, font=7.2):
    cooked=[]
    for ri,row in enumerate(data):
        cooked.append([P(str(x),'TableHead' if ri==0 and header else 'TableCell') for x in row])
    t=Table(cooked,colWidths=widths,repeatRows=1 if header else 0,hAlign='LEFT')
    cmd=[('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.35,MID),
         ('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]
    if header: cmd += [('BACKGROUND',(0,0),(-1,0),NAVY)]
    for r in range(1 if header else 0,len(data)):
        if r%2==0: cmd.append(('BACKGROUND',(0,r),(-1,r),colors.HexColor('#F7FAFB')))
    t.setStyle(TableStyle(cmd)); return t

def kpis(items):
    cells=[]
    for val,label in items:
        cells.append([[P(val,'KPI')],[P(label,'KPILabel')]])
    nested=[Table(c,colWidths=[40*mm],style=[('BACKGROUND',(0,0),(-1,-1),LIGHT),('BOX',(0,0),(-1,-1),.5,MID),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),5)]) for c in cells]
    return Table([nested],colWidths=[42.5*mm]*len(nested),hAlign='LEFT')

def pie_chart():
    vals=[905,427,578.73,559.95,25,416.5,5]
    labs=['Beiträge','Spenden','Impfen intern','Impfen extern','Werbung','Veranstaltungen','Pfand']
    d=Drawing(480,220); p=Pie(); p.x=35;p.y=25;p.width=155;p.height=155;p.data=vals;p.labels=None
    palette=[NAVY,TEAL,BLUE,AMBER,RED,colors.HexColor('#8C6BB1'),GRAY]
    for i,c in enumerate(palette): p.slices[i].fillColor=c; p.slices[i].strokeColor=WHITE
    d.add(p); leg=Legend();leg.x=235;leg.y=175;leg.dx=7;leg.dy=7;leg.deltay=17;leg.fontName='Inter';leg.fontSize=8
    leg.colorNamePairs=[(palette[i],f'{labs[i]}  {money(vals[i])}') for i in range(len(vals))]; d.add(leg); return d

def bar_chart():
    vals=[301.59,400.87,41.19,46,15,345.58,66.67,187,253.5,119.99,41,110,249.16]
    labs=['Veranst.','Impfen','Büro','Verfügung','Gutscheine','Werbemittel','Gericht','Internet','Kreisverb.','Notar','Porto','Trägerver.','Verpflegung']
    d=Drawing(490,245); bc=VerticalBarChart();bc.x=35;bc.y=55;bc.height=150;bc.width=420;bc.data=[vals]
    bc.categoryAxis.categoryNames=labs;bc.categoryAxis.labels.angle=45;bc.categoryAxis.labels.fontName='Inter';bc.categoryAxis.labels.fontSize=6;bc.categoryAxis.labels.dy=-8;bc.valueAxis.valueMin=0;bc.valueAxis.valueMax=450;bc.valueAxis.valueStep=100;bc.bars[0].fillColor=BLUE;bc.bars[0].strokeColor=BLUE; d.add(bc);return d

class NumberedCanvas(canvas.Canvas):
    def __init__(self,*args,**kwargs): canvas.Canvas.__init__(self,*args,**kwargs); self._saved=[]
    def showPage(self): self._saved.append(dict(self.__dict__)); self._startPage()
    def save(self):
        total=len(self._saved)
        for state in self._saved:
            self.__dict__.update(state); self.draw_footer(total); canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)
    def draw_footer(self,total):
        n=self._pageNumber
        if n==1:return
        self.setStrokeColor(MID);self.setLineWidth(.4);self.line(20*mm,14*mm,190*mm,14*mm)
        self.setFont('Inter',7);self.setFillColor(GRAY);self.drawString(20*mm,9*mm,'RGZV Hagen · Steuerliche Analyse · Stand 02.08.2026')
        self.drawRightString(190*mm,9*mm,f'{n} / {total}')

story=[]
def newpage(title, kicker=None):
    if story: story.append(PageBreak())
    if kicker: story.append(P(kicker.upper(),'SmallX')); story.append(Spacer(1,2*mm))
    story.append(P(title,'H1X')); story.append(HRFlowable(width='100%',thickness=1,color=TEAL,spaceAfter=7))

def source_line(txt): story.append(Spacer(1,2*mm)); story.append(P(txt,'TinyX'))

# 1 Titel
story += [Spacer(1,30*mm)]
titlebox=Table([[P('STEUERLICHES VEREINSGUTACHTEN','SmallX')],[P('Gemeinnützigkeit<br/>oder Steuerpflicht?','TitleX')],[P('Steuerliche Analyse des RGZV Hagen und Umgebung seit 1903 e.V.','SubTitleX')]],colWidths=[170*mm])
titlebox.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),NAVY),('LEFTPADDING',(0,0),(-1,-1),14*mm),('RIGHTPADDING',(0,0),(-1,-1),14*mm),('TOPPADDING',(0,0),(-1,0),12*mm),('BOTTOMPADDING',(0,-1),(-1,-1),14*mm)]));story.append(titlebox)
story += [Spacer(1,12*mm), kpis([('1903','Gründungsbezug'),('2026','Prüfungsstand'),('2.917 €','Erträge 1–7/2026'),('31','Gutachtenseiten')]), Spacer(1,18*mm), P('Verbindliche Arbeitsgrundlagen','H2X'), P('Satzung vom 7. Januar 2026 · Finanzbericht 1. Januar bis 31. Juli 2026 · deutsches Vereins- und Steuerrecht in der am 2. August 2026 abrufbaren Fassung.','BodyX'), Spacer(1,8*mm), box('Adressaten','Vorstand, Kassierer, steuerliche Beratung und Finanzverwaltung. Dieses Dokument bereitet Entscheidungen vor, ersetzt aber keine verbindliche Auskunft des Finanzamts oder individuelle Steuerberatung.',AMBER)]

# 2
newpage('Auftrag, Ergebnis und Belastbarkeit','Management Summary')
story += [Ampel('gelb','GESAMTBEWERTUNG: Gemeinnützigkeit sinnvoll – Satzung zuvor zwingend nachbessern'),Spacer(1,6*mm)]
story += bullets([
    '<b>Zwecke passen:</b> Tierzucht (§ 52 Abs. 2 Nr. 23 AO), Tierschutz (Nr. 14), Tierseuchenbekämpfung als Teil des öffentlichen Gesundheitswesens (Nr. 3) und ggf. Umweltschutz (Nr. 8) sind gesetzlich anerkannte Zwecke.',
    '<b>Satzung passt noch nicht:</b> Es fehlen die Kernaussagen der Mustersatzung zu Ausschließlichkeit/Unmittelbarkeit, Selbstlosigkeit, Mittelbindung, Begünstigungsverbot und vollständiger Vermögensbindung.',
    '<b>Aktuell geringe Steuerlast:</b> Selbst bei vorsichtiger Vollzurechnung liegt das Periodenergebnis von 728,07 € weit unter dem Körperschaftsteuer-Freibetrag von 5.000 €. Steuerbare Umsätze liegen weit unter den Kleinunternehmergrenzen.',
    '<b>Größtes Sachrisiko:</b> Impfbeiträge und Veranstaltungserlöse sind nur anhand Leistungsinhalt, Teilnehmerkreis und Kostenrechnung sicher einzuordnen. Werbung ist regelmäßig steuerpflichtiger wirtschaftlicher Geschäftsbetrieb.',
    '<b>Empfehlung:</b> Satzung mit dem Finanzamt vorab abstimmen, beschließen und eintragen; danach Feststellung nach § 60a AO beantragen und die Buchhaltung dauerhaft in vier Bereiche trennen.'
    ])
story.append(Spacer(1,4*mm));story.append(box('Klare Stellungnahme','Ja, die Gemeinnützigkeit lohnt sich für den RGZV. Der kurzfristige Steuervorteil ist klein, der strukturelle Nutzen für Spenden, Zuschüsse, Glaubwürdigkeit und rechtssichere Zweckarbeit ist dagegen erheblich. Voraussetzung ist eine belastbare Organisation der Nachweise.',GREEN))

# 3 TOC
newpage('Inhaltsübersicht')
toc=[('1','Verein und tatsächliche Tätigkeit','4–6'),('2','Vier steuerliche Tätigkeitsbereiche','7–11'),('3','Satzungsprüfung und Änderung','12–14'),('4','Einnahmenanalyse','15–18'),('5','Ausgabenanalyse','19–20'),('6','Steuerarten und Risiken','21–24'),('7','Nutzen, Pflichten und Vergleich','25–28'),('8','Empfehlung, Maßnahmen und Fazit','29–31')]
story.append(table([['Kapitel','Gegenstand','Seiten']]+toc,[20*mm,120*mm,30*mm]));story.append(Spacer(1,9*mm))
story.append(P('Leseschlüssel','H2X'));story += bullets(['<font color="#3A7D44"><b>Grün</b></font>: gut begründbar oder unmittelbar umsetzbar.','<font color="#E9A23B"><b>Gelb</b></font>: plausibel, aber Nachweis/Einzelfallprüfung nötig.','<font color="#C84B4B"><b>Rot</b></font>: Satzungs- oder Steuerrisiko; vor Anerkennung beheben.'])
story.append(Spacer(1,5*mm));story.append(box('Methodik','Die Zuordnung folgt dem wirtschaftlichen Gehalt der einzelnen Zahlung. Kontenbezeichnungen allein entscheiden nicht. Wo der Finanzbericht Sammelkonten enthält, zeigt das Gutachten die notwendige Aufteilung und nennt die fehlenden Belege.',BLUE))

#4
newpage('Vereinsprofil aus der Satzung','1 · Verein')
data=[['Merkmal','Feststellung','Steuerliche Bedeutung'],['Name/Sitz','Rassegeflügelzuchtverein Hagen und Umgebung seit 1903 e.V.; Sitz Hagen','Inländischer eingetragener Verein; grundsätzlich körperschaftsteuerfähig.'],['Geschäftsjahr','Kalenderjahr','Steuer- und Tätigkeitszeitraum grundsätzlich 1.1.–31.12.'],['Verbände','Kreisverband Ennepe-Ruhr; Landesverband Westfalen-Lippe; BDRG','Verbandsbeiträge können zweckbezogene Ausgaben sein.'],['Zwecke','Tierschutz, Tierseuchenbekämpfung, Rasse- und Ziergeflügelzucht, Umwelt-/Naturschutz','Mehrere anerkannte Zwecke nach § 52 Abs. 2 AO sind erreichbar.'],['Mitglieder','Natürliche Personen ab 6, juristische Personen, Förder- und Ehrenmitglieder; Jugendgruppe','Offener Personenkreis spricht grundsätzlich für Förderung der Allgemeinheit.'],['Organe','Mitgliederversammlung und Vorstand','Vorstand verantwortet tatsächliche Geschäftsführung und Steuern.']]
story.append(table(data,[30*mm,57*mm,83*mm]));story.append(Spacer(1,6*mm));story.append(box('Satzungsbefund','Die Zweckbeschreibung ist materiell stark. Der steuerrechtliche Mangel liegt nicht primär im „Was“, sondern im fehlenden verbindlichen „Wie“ der Selbstlosigkeit und Vermögensbindung.',AMBER))
source_line('Quelle: Satzung §§ 1–6, 9–13; AO § 52.')

#5
newpage('Welche Tätigkeiten der Verein ausübt','1 · Verein')
story.append(P('Aus Satzung und Konten lassen sich folgende Tätigkeitsstränge ableiten:','BodyX'))
acts=[['Tätigkeitsstrang','Satzungsbezug','Finanzindiz','Erste Einordnung'],['Zuchtberatung/Aufklärung','§ 5 Beratung, Haltung, Tierschutz','Internet, Porto, Büro','Ideeller Bereich'],['Tierseuchenbekämpfung','§ 4; Maßnahmen/Impfung','1.138,68 € Impfbeiträge; 400,87 € Impfausgaben','Zweckbetrieb möglich; gelb'],['Ausstellungen/Veranstaltungen','§ 5 Ausstellungen, Vorträge','416,50 € Ertrag; 550,75 € direkte Aufwendungen','Aufteilung Zweckbetrieb / Geschäftsbetrieb'],['Öffentlichkeitsarbeit','§ 5 Werbung in der Öffentlichkeit','345,58 € Werbemittel','Ideell, soweit ohne Gegenleistung'],['Werbeleistung für Dritte','nicht ausdrücklich, Mittelbeschaffung','25,00 € Werbung','Wirtschaftlicher Geschäftsbetrieb'],['Jugendarbeit','§§ 5, 6','kein eigenes Konto sichtbar','Ideell; Nachweis ausbaufähig'],['Verbandsarbeit','§ 3','363,50 € Verbands-/Trägerverein','Ideell bzw. zweckbezogen']]
story.append(table(acts,[38*mm,42*mm,42*mm,48*mm]));story.append(Spacer(1,5*mm));story.append(Ampel('gelb','DOKUMENTATION: Tätigkeitsberichte fehlen – Konten allein belegen die Zweckverwirklichung nicht'))

#6
newpage('Finanzielle Momentaufnahme 2026','1 · Verein')
story.append(kpis([(money(2917.18),'Erträge'),(money(2177.55),'Aufwand'),(money(728.07),'Periodenergebnis'),('7 Monate','Berichtszeitraum')]))
story.append(Spacer(1,4*mm));story.append(pie_chart());story.append(P('<b>Lesart:</b> Beiträge und Spenden machen 45,7 % der Erträge aus. Impfbeiträge stellen mit 39,0 % den größten leistungsbezogenen Block. Der Bericht ist eine Saldenliste; Doppelzeilen „Ertrag/Aufwand“ sind Summen und werden nicht nochmals addiert.','BodyX'))
story.append(box('Datenbegrenzung','Es fehlen Vorjahreswerte, Belegtexte, Teilnehmerlisten, Vertragsunterlagen und eine Trennung der Veranstaltungen nach Eintritt, Standgeld, Speisen/Getränken und Spenden. Deshalb sind einige Einordnungen konditional.',AMBER))

#7
newpage('Das Vier-Bereiche-Modell','2 · Steuerliche Grundlagen')
grid=[['Bereich','Typische Vereinsposition','Ertragsteuer','Umsatzsteuer'],['Ideeller Bereich','Beiträge, echte Spenden, unentgeltliche Zweckarbeit','bei Gemeinnützigkeit steuerfrei','meist nicht steuerbar mangels Leistung'],['Vermögensverwaltung','Zinsen, langfristige Vermietung','bei Gemeinnützigkeit steuerfrei','abhängig vom Umsatz; Vermietung häufig befreit'],['Zweckbetrieb','entgeltliche, notwendige Zweckverwirklichung','bei Gemeinnützigkeit steuerfrei','Befreiung/7 % nur nach konkreter Norm'],['Wirtschaftlicher Geschäftsbetrieb','Werbung, Verkauf, Bewirtung','Gewinn ggf. KSt/GewSt','regelmäßig steuerbar; ggf. § 19 UStG']]
story.append(table(grid,[37*mm,53*mm,40*mm,40*mm]));story.append(Spacer(1,7*mm));story.append(box('Wichtig für den RGZV','Diese Vierfachtrennung entfaltet ihre volle Rechtswirkung erst bei anerkannter Gemeinnützigkeit. Ohne Anerkennung bleibt sie dennoch das beste interne Steuerungsmodell.',BLUE))
source_line('Rechtsgrundlagen: AO §§ 14, 51–68; KStG § 5 Abs. 1 Nr. 9; GewStG § 3 Nr. 6; UStG §§ 1, 12, 19.')

#8
newpage('Ideeller Bereich – beim RGZV','2 · Steuerliche Grundlagen')
story += [P('Der ideelle Bereich umfasst Tätigkeiten ohne konkreten Leistungsaustausch, die unmittelbar dem Satzungszweck dienen. Für den RGZV sind dies insbesondere Mitgliederorganisation, Beratung, allgemeine Aufklärung, Jugend- und Verbandsarbeit sowie aus freien Stücken geleistete Spenden.','BodyX')]
story.append(table([['Position','Einordnung','Bedingung'],['Mitgliedsbeiträge 905,00 €','grün: ideell','allgemeiner Beitrag ohne individuell zurechenbare Sonderleistung'],['Spenden 427,00 €','grün/gelb: ideell','freiwillig, keine Werbung/Eintritt/Impfleistung als Gegenleistung'],['Internet, Porto, Büro','ideelle Kosten','soweit allgemeine Verwaltung oder Aufklärung'],['Werbemittel-Einkauf','ideell oder gemischt','Flyer/Öffentlichkeitsarbeit vs. Verkaufsware/Partnerwerbung'],['Geburtstagsgutschein','kritisch','Mitgliederzuwendung; Angemessenheit und Anlass dokumentieren']],[45*mm,55*mm,70*mm]));story.append(Spacer(1,5*mm));story.append(box('Abgrenzungsregel','Eine Zahlung wird nicht dadurch zur Spende, dass sie freiwillig heißt. Erhält der Zahlende eine Gegenleistung, liegt regelmäßig Entgelt vor.',RED))

#9
newpage('Vermögensverwaltung – derzeit kaum sichtbar','2 · Steuerliche Grundlagen')
story += [P('Vermögensverwaltung liegt vor, wenn vorhandenes Vermögen genutzt wird, etwa durch Zinsen oder langfristige Vermietung. Der Finanzbericht weist keine Zinsen, Mieten oder Kapitalerträge aus. Das Bankkonto allein ist kein eigener Tätigkeitsbereich.','BodyX')]
story.append(Ampel('grün','AKTUELL: Kein wesentlicher vermögensverwaltender Ertrag erkennbar'))
story += [Spacer(1,6*mm),P('Künftige Prüffälle','H2X')]
story += bullets(['Zinsen auf Tages-/Festgeld: grundsätzlich Vermögensverwaltung.','Dauerhafte Überlassung eigener Räume oder Käfige ohne Zusatzleistungen: häufig Vermögensverwaltung; Vertragsgestaltung prüfen.','Kurzfristige, organisatorisch intensive Vermietung oder Paketleistungen: kann wirtschaftlicher Geschäftsbetrieb sein.','Sponsoring mit bloßer neutraler Namensnennung kann je nach Ausgestaltung Vermögensverwaltung sein; aktive Werbung ist regelmäßig Geschäftsbetrieb.'])
story.append(box('Praxis','Für Sponsorenverträge stets festhalten: bloße Duldung/Namensnennung oder aktive Werbeleistung? Diese eine Vertragsfrage kann die steuerliche Sphäre verändern.',AMBER))

#10
newpage('Zweckbetrieb – Chance für Impf- und Zuchtarbeit','2 · Steuerliche Grundlagen')
story.append(P('Ein allgemeiner Zweckbetrieb nach § 65 AO verlangt kumulativ: (1) unmittelbare Verwirklichung der steuerbegünstigten Zwecke, (2) Unentbehrlichkeit des Betriebs zur Zweckverwirklichung und (3) nur unvermeidbaren Wettbewerb zu nicht begünstigten Betrieben.','BodyX'))
story.append(table([['Prüfkriterium','Impforganisation RGZV','Bewertung'],['Zwecknähe','Tierseuchenbekämpfung steht ausdrücklich in § 4','grün'],['Unentbehrlichkeit','Gemeinschaftliche Beschaffung/Organisation kann erforderlich sein','gelb – Ablauf belegen'],['Wettbewerb','Tierarzt-/Dienstleistungsmarkt kann berührt sein','gelb – Leistungsrolle klären'],['Begünstigtenkreis','intern und extern; Allgemeinheit darf nicht auf Mitglieder verengt sein','extern kann positiv sein'],['Kostendeckung','1.138,68 € Beiträge vs. 400,87 € Konto „Ausgaben Impfen“','Differenz 737,81 € aufklären; weitere Kosten möglich']],[38*mm,95*mm,37*mm]));story.append(Spacer(1,4*mm));story.append(box('Kein Automatismus','Die externe Impfung ist nicht allein wegen ihres Zwecks ein Zweckbetrieb. Entscheidend sind tatsächliche Leistung, Verantwortlichkeit, Preisbildung, Wettbewerb und Dokumentation. Steuerberater/Finanzamt sollten das konkrete Modell prüfen.',AMBER))
source_line('Rechtsgrundlage: AO § 65; UStG § 12 Abs. 2 Nr. 8 a nur unter zusätzlichen Voraussetzungen.')

#11
newpage('Wirtschaftlicher Geschäftsbetrieb','2 · Steuerliche Grundlagen')
story.append(P('Eine selbständige nachhaltige Tätigkeit, durch die Einnahmen oder andere wirtschaftliche Vorteile erzielt werden und die über reine Vermögensverwaltung hinausgeht, ist wirtschaftlicher Geschäftsbetrieb (§ 14 AO). Gewinnerzielungsabsicht ist nicht erforderlich.','BodyX'))
story.append(table([['RGZV-Fall','Regelbeurteilung','Hinweis'],['Werbeeinnahmen 25,00 €','steuerpflichtiger wirtschaftlicher Geschäftsbetrieb','aktive Werbeleistung unterstellt'],['Bewirtung bei Veranstaltungen','steuerpflichtiger wirtschaftlicher Geschäftsbetrieb','Erlöse im Bericht nicht getrennt'],['Verkauf von Werbeartikeln','steuerpflichtiger wirtschaftlicher Geschäftsbetrieb','Einkauf Werbemittel kann auch ideell sein'],['Ausstellung/Eintritt','Zweckbetrieb möglich','nur wenn Zweck unmittelbar verwirklicht und § 65 AO erfüllt'],['Impfleistung','Zweckbetrieb möglich, sonst Geschäftsbetrieb','Einzelfall offen']],[48*mm,58*mm,64*mm]));story.append(Spacer(1,5*mm));story.append(box('50.000-€-Grenze','Bei anerkannter Gemeinnützigkeit bleiben nach § 64 Abs. 3 AO die Besteuerungsgrundlagen nicht begünstigter Geschäftsbetriebe körperschaft- und gewerbesteuerfrei, wenn deren Jahreseinnahmen einschließlich Umsatzsteuer insgesamt höchstens 50.000 € betragen. Umsatzsteuer wird dadurch nicht beseitigt.',GREEN))

#12
newpage('Satzungsprüfung – Scorecard','3 · Satzung')
score=[['Anforderung','Fundstelle heute','Status'],['Anerkannter Zweck und konkrete Verwirklichung','§§ 4–5','grün'],['Förderung der Allgemeinheit','offene Mitgliedschaft, aber nicht ausdrücklich steuerlich gefasst','gelb'],['Ausschließlich und unmittelbar steuerbegünstigte Zwecke','fehlt','rot'],['Selbstlosigkeit / keine eigenwirtschaftlichen Zwecke','fehlt','rot'],['Mittel nur für Satzungszwecke; keine Mitgliederzuwendungen','fehlt','rot'],['Keine zweckfremden/unverhältnismäßigen Begünstigungen','fehlt','rot'],['Vermögensbindung inkl. Wegfall steuerbegünstigter Zwecke','§ 13 unvollständig','rot'],['Genauigkeit der Zweckverwirklichung','§ 5 brauchbar, sprachlich teils unklar','gelb']]
story.append(table(score,[67*mm,75*mm,28*mm]));story.append(Spacer(1,5*mm));story.append(Ampel('rot','ERGEBNIS: Satzungsmäßige Voraussetzungen nach §§ 59–61 AO derzeit nicht erfüllt'))
story.append(P('Die Anerkennung kann nicht durch gute tatsächliche Arbeit ersetzt werden. § 60 AO verlangt die Festlegungen der Mustersatzung in der Satzung selbst.','BodyX'))

#13
newpage('Fehlende Klauseln – rechtliche Begründung','3 · Satzung')
miss=[['Fehlender Inhalt','Warum erforderlich','Folge'],['Ausschließlichkeit/Unmittelbarkeit','§§ 56, 57, 60 AO; Anlage 1','keine eindeutige Bindung an steuerbegünstigte Zwecke'],['Selbstlosigkeit','§ 55 AO; Anlage 1 § 2','Eigenwirtschaftliche Zielsetzung nicht ausgeschlossen'],['Mittelverwendung/Mitgliederbegünstigung','§ 55 AO; Anlage 1 § 3','Schutz des Vereinsvermögens fehlt'],['Begünstigungsverbot','Anlage 1 § 4','zweckfremde Ausgaben/unangemessene Vergütung nicht ausgeschlossen'],['Vermögensbindung','§ 61 AO; Anlage 1 § 5','Empfänger allein genügt nicht; steuerbegünstigte Verwendung und Wegfall-Fall fehlen']]
story.append(table(miss,[47*mm,65*mm,58*mm]));story.append(Spacer(1,5*mm));story.append(box('Zusatzproblem § 13','Der Kreis- oder Landesverband ist nur dann geeigneter Empfänger, wenn er im Übertragungszeitpunkt steuerbegünstigt ist und das Vermögen unmittelbar und ausschließlich für einen konkret genannten steuerbegünstigten Zweck verwendet. Die aktuelle Formulierung sichert beides nicht.',RED))
source_line('Rechtsgrundlagen: AO §§ 55–61; Mustersatzung in Anlage 1 zu § 60 AO.')

#14
newpage('Empfohlener Satzungsbaustein','3 · Satzung')
story.append(P('Vor Beschluss wortlautgetreu mit dem zuständigen Finanzamt und anschließend registerrechtlich prüfen. Die folgende Arbeitsfassung orientiert sich an Anlage 1 zu § 60 AO:','BodyX'))
draft='''<b>§ X Steuerbegünstigte Zwecke</b><br/>Der Verein verfolgt ausschließlich und unmittelbar gemeinnützige Zwecke im Sinne des Abschnitts „Steuerbegünstigte Zwecke“ der Abgabenordnung. Zwecke sind insbesondere die Förderung der Tierzucht (§ 52 Abs. 2 Nr. 23 AO), des Tierschutzes (Nr. 14), des öffentlichen Gesundheitswesens durch Verhütung und Bekämpfung von Tierseuchen (Nr. 3) sowie des Naturschutzes und Umweltschutzes (Nr. 8). Die Zwecke werden insbesondere durch die in § 5 genannten Maßnahmen verwirklicht.<br/><br/><b>§ Y Selbstlosigkeit und Mittel</b><br/>Der Verein ist selbstlos tätig; er verfolgt nicht in erster Linie eigenwirtschaftliche Zwecke. Mittel dürfen nur für die satzungsmäßigen Zwecke verwendet werden. Die Mitglieder erhalten keine Zuwendungen aus Mitteln des Vereins. Es darf keine Person durch Ausgaben, die dem Zweck des Vereins fremd sind, oder durch unverhältnismäßig hohe Vergütungen begünstigt werden.<br/><br/><b>§ Z Vermögensbindung</b><br/>Bei Auflösung oder Aufhebung des Vereins oder bei Wegfall steuerbegünstigter Zwecke fällt das Vermögen an [genau bezeichneter steuerbegünstigter Empfänger], der es unmittelbar und ausschließlich für die Förderung der Tierzucht, des Tierschutzes und/oder der Bekämpfung von Tierseuchen zu verwenden hat.'''
story.append(box('Arbeitsfassung – kein ungeprüfter Beschlusstext',draft,BLUE));story.append(Spacer(1,5*mm));story.append(P('Auch § 4/§ 5 sprachlich konsolidieren: „Förderung und Verbreitung der Zucht“ sollte ausdrücklich als Förderung der Tierzucht gefasst; öffentliche Bildungs-, Jugend- und Tierschutzmaßnahmen sollten konkret beschrieben werden.','BodyX'))

#15
newpage('Gesamtmatrix der Einnahmen','4 · Einnahmen')
income=[['Einnahme','Betrag','Primärzuordnung bei Anerkennung','Sicherheit'],['Mitgliedsbeiträge','905,00 €','Ideeller Bereich','hoch'],['Spenden','427,00 €','Ideell, sofern ohne Gegenleistung','mittel/hoch'],['Impfen intern','578,73 €','Zweckbetrieb möglich','mittel'],['Impfen extern','559,95 €','Zweckbetrieb möglich; sonst Geschäftsbetrieb','niedrig/mittel'],['Werbung','25,00 €','wirtschaftlicher Geschäftsbetrieb','hoch'],['Veranstaltungen','416,50 €','aufteilen: Zweckbetrieb / Geschäftsbetrieb / ggf. Spende','niedrig'],['Pfandrückgabe','5,00 €','Ausgabenminderung statt eigener Ertrag','hoch'],['Summe','2.917,18 €','Kontrollsumme Finanzbericht','hoch']]
story.append(table(income,[42*mm,25*mm,73*mm,30*mm]));story.append(Spacer(1,4*mm));story.append(box('Ohne Gemeinnützigkeit','Mitgliedsbeiträge können als echte Mitgliederbeiträge körperschaftsteuerlich außerhalb des Einkommens bleiben (§ 8 Abs. 5 KStG). Die steuerbegünstigte Vier-Bereiche-Wirkung und Spendenberechtigung bestehen aber nicht.',AMBER))

#16
newpage('Mitgliedsbeiträge und Spenden','4 · Einnahmen')
story.append(P('<b>Mitgliedsbeiträge 905,00 €:</b> Der Beitrag wird nach § 9 der Satzung allgemein von der Mitgliederversammlung festgesetzt. Solange er nicht der Bezahlung individuell zurechenbarer Leistungen dient, gehört er zum ideellen Bereich. Sonderentgelte (z. B. konkretes Impfen) bleiben getrennt.','BodyX'))
story.append(P('<b>Spenden 427,00 €:</b> Ideell nur, wenn freiwillig und ohne Gegenleistung. Namensnennung, Banner, Eintritt oder Waren können eine Gegenleistung sein. Bis zur Anerkennung dürfen keine Zuwendungsbestätigungen ausgestellt werden.','BodyX'))
story.append(table([['Prüfschritt','Beitrag','Spende'],['Rechtsgrund','Mitgliedschaft/Satzung','freiwillige Zuwendung'],['Gegenleistung','allgemeine Vereinsvorteile unschädlich; Sonderleistung abtrennen','keine Gegenleistung'],['Bescheinigung nach Anerkennung','für Tierzucht-Zweck regelmäßig nicht abzugsfähig (§ 10b Abs. 1 S. 8 Nr. 4 EStG)','grundsätzlich abzugsfähig nach Maßgabe § 10b EStG'],['Buchungsbeleg','Beitragsbeschluss + Mitgliederliste','Zahlungsbeleg + Zweck/Gegenleistungsprüfung']],[39*mm,61*mm,70*mm]));story.append(Spacer(1,5*mm));story.append(box('Wichtige Einschränkung','Wird der Verein primär wegen Tierzucht nach § 52 Abs. 2 Nr. 23 AO anerkannt, sind Mitgliedsbeiträge steuerlich nicht abzugsfähig. Echte Spenden können gleichwohl abzugsfähig sein.',AMBER))

#17
newpage('Impfbeiträge – interne und externe Fälle','4 · Einnahmen')
story.append(kpis([(money(578.73),'intern'),(money(559.95),'extern'),(money(1138.68),'gesamt'),(money(400.87),'Impfausgaben')]))
story.append(Spacer(1,5*mm));story.append(table([['Frage','Intern','Extern'],['Leistungsempfänger','Mitglieder','Nichtmitglieder / Öffentlichkeit'],['Zwecknähe','hoch, wenn Tierseuchenbekämpfung','ebenfalls hoch; Allgemeinheitsbezug sogar stärker'],['Risiko Sondervorteil','Mitgliederförderung darf nicht Selbstzweck werden','geringer, wenn offen und sachlich'],['Wettbewerb','Rolle des Tierarztes und Vereins klären','besonders sorgfältig prüfen'],['Empfehlung','Kosten je Vorgang, Tierarztbeleg, Teilnehmer-/Tierliste','zusätzlich Preisvergleich, Teilnahmebedingungen, offene Ausschreibung']],[34*mm,68*mm,68*mm]));story.append(Spacer(1,4*mm));story.append(Ampel('gelb','EINORDNUNG: Zweckbetrieb gut vertretbar, aber anhand des Finanzberichts nicht abschließend'))
story.append(P('Die rechnerische Marge von 737,81 € ist kein belastbarer Gewinn: Impfstoff, Tierarzt, Fahrt, Material, Verwaltung oder zeitliche Abgrenzungen können auf anderen Konten stehen. Eine vollständige Kostenstellenrechnung ist erforderlich.','BodyX'))

#18
newpage('Werbung, Veranstaltungen und Sonstiges','4 · Einnahmen')
story.append(table([['Position','Analyse','Buchungsempfehlung'],['Werbung 25,00 €','aktive Gegenleistung regelmäßig wirtschaftlicher Geschäftsbetrieb; § 64 Abs. 6 AO erlaubt ggf. 15-%-Gewinnschätzung bei Werbung im Zusammenhang mit begünstigter Tätigkeit','eigenes Konto „Werbung steuerpflichtig“; Vertrag ablegen'],['Veranstaltungen 416,50 €','Sammelkonto unzureichend: Eintritt zur Zuchtausstellung kann Zweckbetrieb sein; Speisen/Getränke, Verkaufsstände und gesellige Feste regelmäßig Geschäftsbetrieb; echte Spenden ideell','je Veranstaltung und Erlösart trennen'],['Pfandrückgabe 5,00 €','wirtschaftlich Rückfluss einer zuvor gezahlten Pfandposition, grundsätzlich Kostenminderung','gegen ursprüngliches Aufwandskonto buchen'],['Sonstige Einnahmen','im Bericht außer Pfand nicht ausgewiesen','künftig mit Belegtext und Sphäre erfassen']],[40*mm,83*mm,47*mm]));story.append(Spacer(1,5*mm));story.append(box('Veranstaltungsregel','Ein einheitlicher Abend kann mehrere Steuerbereiche enthalten. Eintritt zur fachlichen Ausstellung, Spende, Tombola, Essen und Sponsorengeld dürfen nicht pauschal auf ein Konto gebucht werden.',RED))

#19
newpage('Analyse sämtlicher wesentlicher Ausgaben','5 · Ausgaben')
story.append(bar_chart());story.append(table([['Block','Betrag','Zuordnung / Begründung'],['Impfung','400,87 €','zum Impf-Zweckbetrieb, soweit direkt zurechenbar'],['Veranstaltungen + Verpflegung','550,75 €','nach fachlichem Zweckteil und Bewirtung/Geselligkeit aufteilen'],['Werbemittel','345,58 €','ideelle Öffentlichkeitsarbeit oder Wareneinsatz/Partnerwerbung'],['Verbände','363,50 €','ideell, wenn Zweck-/Verbandsarbeit; Nachweis Mitgliedschaft'],['Verwaltung (Büro, Internet, Porto)','269,19 €','nach sachgerechtem Schlüssel auf Bereiche verteilen'],['Recht/Notar','186,66 €','Anlass entscheidet; Satzung/Registration meist ideell'],['Sonstiges','61,00 €','Gutschein 15 € + „eigenmächtige Verfügung Sternal“ 46 €: Anlass klären']],[48*mm,25*mm,97*mm]));

#20
newpage('Ausgabenzuordnung und Kontrollpunkte','5 · Ausgaben')
story.append(P('Direkt zurechenbare Kosten werden unmittelbar dem Bereich zugeordnet. Gemeinkosten sind nach einem dokumentierten, stetigen und sachgerechten Schlüssel zu verteilen (z. B. Belegzahl, Zeitanteil, Nutzung). Eine nachträgliche Ergebnissteuerung ist unzulässig.','BodyX'))
story.append(table([['Konto','Ampel','Erforderlicher Nachweis'],['Eigenmächtige Verfügung Sternal 46,00 €','rot','Empfänger, Rechtsgrund, Genehmigung, Rückforderung/Erstattung prüfen'],['Geburtstagsgutschein 15,00 €','gelb','Anlass, Empfänger, Angemessenheit; keine unangemessene Mitgliederbegünstigung'],['Verpflegung 249,16 €','gelb','Teilnehmer, Anlass, fachlicher Zusammenhang; geselligen Anteil abtrennen'],['Werbemittel 345,58 €','gelb','Stückliste, Ausgabezweck, kostenlose Verteilung oder Verkauf'],['Bank 6,44 € Einnahmen / 18,00 € Ausgaben','gelb','Kontenabstimmung; „Aktiva 11,56 €“ nicht mit Periodenergebnis verwechseln']],[62*mm,20*mm,88*mm]));story.append(Spacer(1,5*mm));story.append(box('Vorstandsmaßnahme','Die Position „Eigenmächtige Verfügung Sternal“ ist nicht steuerlich klassifizierbar und governance-seitig auffällig. Beleg, Beschlusslage und Berechtigung unverzüglich dokumentieren.',RED))

#21
newpage('Körperschaftsteuer','6 · Steuerarten')
story.append(P('Der e.V. ist grundsätzlich körperschaftsteuerpflichtig. Bei Anerkennung befreit § 5 Abs. 1 Nr. 9 KStG die begünstigten Bereiche; steuerpflichtig bleibt grundsätzlich der wirtschaftliche Geschäftsbetrieb. Ohne Anerkennung gilt der allgemeine Besteuerungsrahmen, wobei echte Mitgliederbeiträge nach § 8 Abs. 5 KStG nicht zum Einkommen gehören können.','BodyX'))
story.append(kpis([(money(728.07),'Ergebnis 1–7/26'),('5.000 €','Freibetrag § 24 KStG'),('15 %','KSt-Satz'),('0 €','voraussichtliche Zahlung')]))
story.append(Spacer(1,5*mm));story.append(box('Beurteilung 2026','Auf Basis der vorliegenden Salden ist eine Körperschaftsteuerzahlung äußerst unwahrscheinlich. Selbst das gesamte Periodenergebnis liegt deutlich unter 5.000 €. Das ist keine Steuerfestsetzung: Jahresabschluss, Abgrenzungen und Vorjahre fehlen.',GREEN))
story.append(P('Bei Gemeinnützigkeit kommt zusätzlich die 50.000-€-Einnahmengrenze des § 64 Abs. 3 AO für nicht begünstigte Geschäftsbetriebe hinzu. Sie ist keine Umsatzsteuergrenze und kein allgemeiner Freibetrag.','BodyX'))

#22
newpage('Gewerbesteuer','6 · Steuerarten')
story.append(P('Gewerbesteuer setzt einen Gewerbebetrieb voraus. Der ideelle Kern des Vereins ist kein Gewerbebetrieb. Aktive Werbung, Verkauf/Bewirtung und ggf. entgeltliche Dienstleistungen können gewerblich sein. Bei Gemeinnützigkeit befreit § 3 Nr. 6 GewStG die begünstigten Bereiche.','BodyX'))
story.append(table([['Prüfung','RGZV 2026','Ergebnis'],['Gewerbliche Einnahmen sicher','Werbung 25,00 €','sehr gering'],['Weitere mögliche gewerbliche Einnahmen','Teile Veranstaltungen/Impfung','Aufteilung offen'],['Gewinn statt Umsatz maßgeblich','Gesamtergebnis 728,07 €','deutlich niedrig'],['Freibetrag bei begünstigten Körperschaften','5.000 € nach § 11 Abs. 1 Nr. 2 GewStG','nicht annähernd erreicht'],['§ 64 Abs. 3 AO','bis 50.000 € Einnahmen des steuerpflichtigen Geschäftsbetriebs','bei Anerkennung klar unterschritten']],[62*mm,65*mm,43*mm]));story.append(Spacer(1,5*mm));story.append(Ampel('grün','GEWERBESTEUERZAHLUNG: Nach Datenlage 2026 nicht zu erwarten'))
story.append(P('Ohne Gemeinnützigkeit ist die genaue Freibetrags- und Gewerblichkeitsprüfung anhand der tatsächlichen Tätigkeit vorzunehmen; aus dem Vereinsstatus allein folgt keine pauschale Gewerbesteuerbefreiung.','SmallX'))

#23
newpage('Umsatzsteuer','6 · Steuerarten')
story.append(P('Umsatzsteuer folgt dem Leistungsaustausch, nicht den ertragsteuerlichen vier Bereichen. Mitgliedsbeiträge und echte Spenden sind typischerweise nicht steuerbar, sofern keine konkrete Gegenleistung vorliegt. Impfleistungen, Werbung, Eintritt, Speisen oder Waren können steuerbar sein.','BodyX'))
story.append(table([['Position','USt-Risiko','Vorläufig'],['Beiträge/Spenden','keine konkrete Gegenleistung','nicht steuerbar'],['Impfbeiträge','konkrete Leistung möglich','steuerbar; Leistungserbringer klären'],['Werbung','Gegenleistung','steuerbar 19 %, sofern keine Kleinunternehmerbefreiung'],['Veranstaltung','je Erlösart','0/7/19 % oder nicht steuerbar möglich'],['Pfand','Neben-/Rückabwicklung','zur Ursprungsleistung']],[52*mm,63*mm,55*mm]));story.append(Spacer(1,5*mm));story.append(box('Kleinunternehmer 2026','§ 19 UStG befreit inländische Umsätze, wenn der Gesamtumsatz des Vorjahres 25.000 € nicht überschritten hat und im laufenden Jahr 100.000 € nicht überschreitet. Nach den vorliegenden Beträgen ist die Größenordnung klar unterschritten, sofern kein Verzicht oder unbekannte weitere Umsätze vorliegen.',GREEN))
story.append(P('Der ermäßigte Satz für gemeinnützige Körperschaften nach § 12 Abs. 2 Nr. 8 a UStG gilt nicht pauschal und gerade nicht für gewöhnliche wirtschaftliche Geschäftsbetriebe.','BodyX'))

#24
newpage('Weitere Steuern, Haftung und Risikoregister','6 · Steuerarten')
risks=[['Risiko','Wahrscheinlichkeit','Wirkung','Maßnahme'],['Unberechtigte Spendenbescheinigung','mittel, falls voreilig','Haftung; § 10b Abs. 4 EStG','erst nach Anerkennung, amtliches Muster'],['Lohnsteuer/Ehrenamt','derzeit unbekannt','bei Vergütung/Arbeitnehmerstatus','Verträge und Zahlungen prüfen'],['Lotterie/Tombola','unbekannt','Genehmigungs- und Steuerfragen','vor Veranstaltung gesondert prüfen'],['Grundsteuer','kein Grundbesitz ersichtlich','nur bei Eigentum/Nutzung relevant','Bestandsaufnahme'],['Kapitalertragsteuer','keine Erträge ersichtlich','Bank kann einbehalten','Freistellungsunterlagen nach Anerkennung'],['Vorstandshaftung','bei Pflichtverletzung','persönliche Inanspruchnahme möglich','Vier-Augen-Prinzip, Fristenkalender']]
story.append(table(risks,[47*mm,33*mm,42*mm,48*mm]));story.append(Spacer(1,5*mm));story.append(box('Keine Rechtsbehauptung ohne Sachverhalt','Beschäftigte, Aufwandsentschädigungen, Grundstücke, Tombolen und Fahrzeugnutzung sind im Finanzbericht nicht erkennbar. Sie werden daher nicht abschließend bewertet.',AMBER))

#25
newpage('Vorteile einer Gemeinnützigkeit','7 · Entscheidung')
story.append(table([['Vorteil','Konkreter Nutzen für den RGZV','Gewicht'],['KSt/GewSt-Befreiung','ideeller Bereich, Vermögensverwaltung und Zweckbetrieb geschützt','mittel heute, hoch bei Wachstum'],['Spendenbescheinigungen','echte Spenden werden für Förderer attraktiver','hoch'],['Zuschüsse/Förderprogramme','Gemeinnützigkeit ist häufig Zugangsvoraussetzung','hoch'],['Reputation','nachprüfbare Mittelbindung und öffentliche Zweckorientierung','hoch'],['Umsatzsteueroptionen','punktuell Befreiung/ermäßigter Satz möglich','niedrig/mittel'],['Kooperationen','bessere Anschlussfähigkeit zu Kommunen, Verbänden, Stiftungen','hoch'],['Vermögensschutz','satzungsmäßige Bindung verhindert private Ausschüttung','mittel']],[43*mm,97*mm,30*mm]));story.append(Spacer(1,5*mm));story.append(box('Vereinsspezifisch','Der RGZV erfüllt mit Tierzucht, Tierschutz und Tierseuchenbekämpfung Aufgaben, die § 52 AO ausdrücklich nennt. Dadurch ist die Gemeinnützigkeit kein Etikett, sondern eine passende rechtliche Form für die tatsächliche Zweckarbeit.',GREEN))

#26
newpage('Nachteile und Belastungen','7 · Entscheidung')
story.append(table([['Nachteil','Konkrete Folge','Beherrschung'],['Strenge Mittelbindung','Ausgaben müssen Satzungszweck dienen','Budget-/Belegprüfung'],['Mehr Buchhaltung','vier Bereiche, Kostenstellen, USt-Prüfung','Kontenplan + monatliche Zuordnung'],['Zeitnahe Mittelverwendung','Rücklagen nur nach Regeln','Rücklagenspiegel/Beschlüsse'],['Tatsächliche Geschäftsführung','Satzung muss gelebt und belegt werden','jährlicher Tätigkeitsbericht'],['Spendenhaftung','falsche Bestätigungen können Haftung auslösen','nur geschulte Freigabe'],['Änderungs-/Prüfaufwand','Finanzamt, Mitgliederversammlung, Register','einmaliger Projektplan'],['Risiko Aberkennung','bei schweren/verstetigten Verstößen','interne Jahresprüfung']],[45*mm,72*mm,53*mm]));story.append(Spacer(1,5*mm));story.append(box('Bewertung','Diese Nachteile sind real, aber bei einem Verein mit 2.917 € Ertrag in sieben Monaten organisatorisch beherrschbar. Sie rechtfertigen keinen Verzicht, wohl aber klare Zuständigkeiten.',AMBER))

#27
newpage('Pflichten für Vorstand und Kassierer','7 · Governance')
duties=[['Pflicht','Rhythmus','Verantwortung'],['Belege mit Zweck/Sphäre kontieren','laufend','Kassierer, Vier-Augen-Freigabe'],['Bank/Kasse abstimmen','monatlich','Kassierer'],['Tätigkeitsnachweise, Teilnehmer, Programme','je Maßnahme','Fachverantwortlicher + Schriftführer'],['Mittelverwendungs-/Rücklagenprüfung','jährlich','Vorstand'],['Steuererklärungen/Gem 1 und Anlagen','nach Aufforderung/Turnus des Finanzamts','Vorstand/Steuerberatung'],['Zuwendungsbestätigungen','nur nach Berechtigung','benannte, geschulte Person'],['Satzungs-/Geschäftsführungscheck','jährlich vor Mitgliederversammlung','Gesamtvorstand'],['Aufbewahrung','nach steuer-/handelsrechtlichen Fristen','Kassierer/Archiv']]
story.append(table(duties,[78*mm,37*mm,55*mm]));story.append(Spacer(1,5*mm));story.append(box('Fristenhinweis','Konkrete Abgabefristen hängen von Aufforderung, Beratungsfall und Steuerart ab. Der Vorstand sollte ELSTER-Mitteilungen und Bescheide zentral erfassen; dieses Gutachten setzt keine individuelle Finanzamtsfrist.',AMBER))

#28
newpage('Förderung und wirtschaftlicher Vergleich','7 · Entscheidung')
story.append(table([['Kriterium','Mit Gemeinnützigkeit','Ohne Gemeinnützigkeit'],['Aktuelle Steuerzahlung','voraussichtlich ebenfalls 0 €','voraussichtlich 0 € bei Datenlage'],['Spenden','Bestätigungen für echte Spenden möglich','keine steuerbegünstigte Bestätigung'],['Mitgliedsbeiträge','für Tierzucht regelmäßig nicht abzugsfähig','nicht abzugsfähig'],['Förderprogramme','häufig zugangsberechtigt','häufig ausgeschlossen/schwächer'],['Sponsoring','saubere Trennung nötig','ebenfalls steuerlich zu prüfen'],['Buchhaltung','höherer Trennungs-/Nachweisaufwand','einfacher, aber Steuerpflicht breiter'],['Wachstumsschutz','Begünstigte Sphären bleiben geschützt','steigende Gewinne schneller steuerrelevant'],['Außenwirkung','öffentlich bestätigte Zweckbindung','keine steuerliche Anerkennung']],[43*mm,63*mm,64*mm]));story.append(Spacer(1,5*mm));story.append(P('<b>Wirtschaftliches Urteil:</b> Bei den aktuellen Zahlen entsteht kaum unmittelbare Steuerersparnis. Bereits moderate zusätzliche Spenden oder ein Förderzuschuss können den einmaligen Satzungs- und Einrichtungsaufwand jedoch überwiegen. Förderprogramme sind jeweils einzeln zu prüfen; Gemeinnützigkeit garantiert keinen Zuschuss.','BodyX'))
story.append(Ampel('grün','NUTZENÜBERHANG: langfristig deutlich zugunsten der Gemeinnützigkeit'))

#29
newpage('Handlungsempfehlung','8 · Umsetzung')
story.append(box('Entscheidungsvorschlag an den Vorstand','Der RGZV soll die Anerkennung der Gemeinnützigkeit aktiv anstreben. Die Satzung wird vor der Beschlussfassung mit dem Finanzamt abgestimmt; parallel wird die Buchhaltung ab 1. Januar 2026 in vier Bereiche nachkontiert.',GREEN))
story.append(Spacer(1,6*mm));story.append(P('Begründung','H2X'));story += bullets(['Die Satzungszwecke gehören ausdrücklich zum Katalog des § 52 AO.','Die tatsächlichen Tätigkeiten – Zuchtarbeit, Tierschutz, Tierseuchenbekämpfung und Aufklärung – sind grundsätzlich anschlussfähig.','Die aktuelle Steuerersparnis ist klein, aber Spenden- und Förderfähigkeit schaffen strategischen Mehrwert.','Die wirtschaftlichen Aktivitäten sind derzeit klein und lassen sich getrennt führen.','Die Satzungsmängel sind mit standardnahen Klauseln behebbar.'])
story.append(Spacer(1,4*mm));story.append(box('Bedingung','Die Empfehlung gilt nur, wenn der Vorstand dauerhaft bereit ist, Mittelbindung, Belegqualität, Tätigkeitsnachweise und Bereichstrennung einzuhalten. Andernfalls wäre die Anerkennung riskant.',AMBER))

#30
newpage('Maßnahmenplan in 10 Schritten','8 · Umsetzung')
steps=[['Nr.','Maßnahme','Ergebnis'],['1','Finanzamt Hagen: zuständige Gemeinnützigkeitsstelle und gewünschtes Vorprüfungsverfahren klären','Ansprechpartner/Checkliste'],['2','§§ 4, 5 und 13 sowie neue Steuerklauseln als Gesamtentwurf erstellen','abgestimmter Entwurf'],['3','Entwurf vor Beschluss nach § 60a AO fachlich vorprüfen lassen','schriftliche Rückmeldung'],['4','Einladung mit Satzungsänderung frist- und formgerecht versenden','wirksame Tagesordnung'],['5','Mitgliederversammlung: 3/4-Mehrheit nach § 11 Abs. 3; Protokoll','Satzungsbeschluss'],['6','Notar/Registeranmeldung; Vertretungsbefugnis und vollständige Satzung beifügen','Registereintragung'],['7','Feststellung der Satzungsmäßigkeit nach § 60a AO beantragen','Feststellungsbescheid'],['8','Kontenplan: ideell, Vermögensverwaltung, Zweckbetrieb, Geschäftsbetrieb','saubere Buchhaltung'],['9','2026 nachkontieren; Impf- und Veranstaltungssachverhalte mit Steuerberatung klären','belastbare Eröffnungsakte'],['10','Jährliche Compliance-Prüfung und turnusmäßige Steuererklärungen','dauerhafte Anerkennung']]
story.append(table(steps,[10*mm,112*mm,48*mm]));story.append(Spacer(1,4*mm));story.append(P('<b>Benötigte Unterlagen:</b> aktuelle und beschlossene Satzung, Vereinsregisterauszug, Gründungs-/Änderungsprotokoll, Tätigkeitsbericht, Einnahmen-Ausgaben-Rechnung, Vermögensübersicht, Kassen-/Banknachweise, Verträge, Spendenunterlagen, Impf- und Veranstaltungsdokumentation.','SmallX'))

#31
newpage('Fazit, offene Punkte und Rechtsquellen','8 · Abschluss')
story.append(P('<b>Fazit:</b> Der RGZV ist inhaltlich ein sehr plausibler gemeinnütziger Verein, formal aber noch keiner. Die aktuelle Satzung erfüllt die zwingenden steuerlichen Satzungsanforderungen nicht. Nach Ergänzung der Mustersatzungsklauseln und Einführung einer belastbaren Bereichsrechnung ist die Anerkennung fachlich zu empfehlen.','BodyX'))
story.append(P('Vor Antrag abschließend klären','H2X'));story += bullets(['Wer ist rechtlich und tatsächlich Leistungserbringer der Impfungen? Wie werden Preise und Kosten kalkuliert?','Woraus bestehen die 416,50 € Veranstaltungserträge im Einzelnen?','Was steckt hinter „Eigenmächtige Verfügung Sternal“ und dem Werbemittelbestand?','Sind 2025 oder weitere 2026-Umsätze, Vergütungen, Grundstücke, Tombolen oder Beschäftigte vorhanden?','Ist der vorgesehene Vermögensempfänger steuerbegünstigt und stimmt er der Zweckbindung zu?'],'SmallX')
story.append(P('Zentrale amtliche Rechtsquellen (Abruf 02.08.2026)','H2X'))
sources=[
 'AO §§ 14, 51–68, Anlage 1: https://www.gesetze-im-internet.de/ao_1977/',
 'KStG §§ 1, 5, 8, 23, 24: https://www.gesetze-im-internet.de/kstg_1977/',
 'GewStG §§ 2, 3, 11: https://www.gesetze-im-internet.de/gewstg/',
 'UStG §§ 1, 2, 4, 12, 19: https://www.gesetze-im-internet.de/ustg_1980/',
 'EStG § 10b: https://www.gesetze-im-internet.de/estg/__10b.html',
 'BGB Vereinsrecht §§ 21 ff.: https://www.gesetze-im-internet.de/bgb/'
]
story += bullets(sources,'TinyX')
story.append(Spacer(1,4*mm));story.append(box('Abschließender Hinweis','Dieses Gutachten beruht ausschließlich auf der vorgelegten Satzung, dem Finanzbericht und geltendem Recht. Es kennzeichnet offene Tatsachenfragen; eine verbindliche steuerliche Beurteilung erfolgt durch Finanzamt oder beauftragte steuerliche Beratung.',NAVY))

doc=SimpleDocTemplate(OUT,pagesize=A4,rightMargin=20*mm,leftMargin=20*mm,topMargin=19*mm,bottomMargin=18*mm,title='Gemeinnützigkeit oder Steuerpflicht? – RGZV Hagen',author='Steuerliche Dokumentation für den RGZV Hagen und Umgebung seit 1903 e.V.',subject='Vereinssteuerliche Analyse auf Basis Satzung und Finanzbericht 2026')
doc.build(story,canvasmaker=NumberedCanvas)
print(OUT)
