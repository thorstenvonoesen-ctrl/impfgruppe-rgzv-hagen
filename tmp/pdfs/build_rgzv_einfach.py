from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable, Flowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.legends import Legend
import os

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
OUT=os.path.join(ROOT,'output','pdf','RGZV_Steuern_einfach_erklaert_2026.pdf')
os.makedirs(os.path.dirname(OUT),exist_ok=True)

NAVY=colors.HexColor('#17324D'); BLUE=colors.HexColor('#246B8E'); TEAL=colors.HexColor('#2A9D8F')
GREEN=colors.HexColor('#3A7D44'); AMBER=colors.HexColor('#E9A23B'); RED=colors.HexColor('#C84B4B')
LIGHT=colors.HexColor('#EDF3F6'); MID=colors.HexColor('#D5E1E7'); DARK=colors.HexColor('#22313A')
GRAY=colors.HexColor('#647581'); WHITE=colors.white
for n,p in [('A',r'C:\Windows\Fonts\arial.ttf'),('AB',r'C:\Windows\Fonts\arialbd.ttf'),('AI',r'C:\Windows\Fonts\ariali.ttf')]:
    if os.path.exists(p): pdfmetrics.registerFont(TTFont(n,p))

S={
'title':ParagraphStyle('title',fontName='AB',fontSize=28,leading=32,textColor=WHITE),
'subtitle':ParagraphStyle('subtitle',fontName='A',fontSize=14,leading=19,textColor=colors.HexColor('#D7E8F0')),
'h1':ParagraphStyle('h1',fontName='AB',fontSize=22,leading=26,textColor=NAVY,spaceAfter=7),
'h2':ParagraphStyle('h2',fontName='AB',fontSize=13,leading=16,textColor=BLUE,spaceBefore=8,spaceAfter=4),
'body':ParagraphStyle('body',fontName='A',fontSize=11,leading=15.5,textColor=DARK,spaceAfter=7),
'big':ParagraphStyle('big',fontName='AB',fontSize=17,leading=22,textColor=NAVY,spaceAfter=7),
'small':ParagraphStyle('small',fontName='A',fontSize=8,leading=10.5,textColor=GRAY),
'box':ParagraphStyle('box',fontName='A',fontSize=10.5,leading=14.5,textColor=DARK),
'boxt':ParagraphStyle('boxt',fontName='AB',fontSize=11.5,leading=14,textColor=NAVY,spaceAfter=3),
'th':ParagraphStyle('th',fontName='AB',fontSize=8.6,leading=10.5,textColor=WHITE),
'td':ParagraphStyle('td',fontName='A',fontSize=8.8,leading=11.2,textColor=DARK),
'kpi':ParagraphStyle('kpi',fontName='AB',fontSize=19,leading=21,textColor=NAVY,alignment=TA_CENTER),
'kpil':ParagraphStyle('kpil',fontName='A',fontSize=8,leading=10,textColor=GRAY,alignment=TA_CENTER),
}
def P(x,s='body'): return Paragraph(x,S[s])
def money(v): return f'{v:,.2f} €'.replace(',','X').replace('.',',').replace('X','.')
def bullets(xs): return [P('• '+x) for x in xs]
def box(title,body,col=TEAL):
    t=Table([[P(title,'boxt')],[P(body,'box')]],colWidths=[170*mm])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.Color(col.red,col.green,col.blue,alpha=.09)),('BOX',(0,0),(-1,-1),.8,col),('LINEBEFORE',(0,0),(0,-1),4,col),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]));return t
def table(rows,widths):
    data=[[P(str(v),'th' if r==0 else 'td') for v in row] for r,row in enumerate(rows)]
    t=Table(data,colWidths=widths,repeatRows=1)
    st=[('BACKGROUND',(0,0),(-1,0),NAVY),('GRID',(0,0),(-1,-1),.4,MID),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]
    for r in range(2,len(rows),2):st.append(('BACKGROUND',(0,r),(-1,r),colors.HexColor('#F7FAFB')))
    t.setStyle(TableStyle(st));return t
def kpis(items):
    cells=[]
    for v,l in items:
        q=Table([[P(v,'kpi')],[P(l,'kpil')]],colWidths=[40*mm]);q.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('BOX',(0,0),(-1,-1),.5,MID),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),6)]));cells.append(q)
    return Table([cells],colWidths=[42.5*mm]*len(cells))
class Light(Flowable):
    def __init__(self,col,label): super().__init__();self.col=col;self.label=label;self.width=170*mm;self.height=14*mm
    def draw(self):
        c=self.canv;c.setFillColor(colors.Color(self.col.red,self.col.green,self.col.blue,alpha=.12));c.roundRect(0,0,self.width,self.height,3*mm,fill=1,stroke=0);c.setFillColor(self.col);c.circle(7*mm,7*mm,2.4*mm,fill=1,stroke=0);c.setFont('AB',10);c.drawString(14*mm,5.1*mm,self.label)
class NumCanvas(canvas.Canvas):
    def __init__(self,*a,**k):canvas.Canvas.__init__(self,*a,**k);self.states=[]
    def showPage(self):self.states.append(dict(self.__dict__));self._startPage()
    def save(self):
        total=len(self.states)
        for s in self.states:
            self.__dict__.update(s)
            if self._pageNumber>1:
                self.setStrokeColor(MID);self.line(20*mm,14*mm,190*mm,14*mm);self.setFillColor(GRAY);self.setFont('A',7);self.drawString(20*mm,9*mm,'RGZV Hagen - Steuern einfach erklärt - Stand 02.08.2026');self.drawRightString(190*mm,9*mm,f'{self._pageNumber} / {total}')
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

story=[]
def page(title,kicker='EINFACH ERKLÄRT'):
    if story:story.append(PageBreak())
    story.append(P(kicker,'small'));story.append(Spacer(1,2*mm));story.append(P(title,'h1'));story.append(HRFlowable(width='100%',thickness=1,color=TEAL,spaceAfter=9))

# 1
story+=[Spacer(1,30*mm)]
t=Table([[P('VORSTANDSVERSION','small')],[P('Gemeinnützigkeit<br/>oder Steuerpflicht?','title')],[P('Die Steuerlage unseres Vereins - verständlich erklärt','subtitle')]],colWidths=[170*mm]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),NAVY),('LEFTPADDING',(0,0),(-1,-1),14*mm),('RIGHTPADDING',(0,0),(-1,-1),14*mm),('TOPPADDING',(0,0),(-1,0),12*mm),('BOTTOMPADDING',(0,-1),(-1,-1),15*mm)]));story.append(t)
story+=[Spacer(1,13*mm),P('Rassegeflügelzuchtverein Hagen und Umgebung seit 1903 e.V.','big'),P('Keine trockene Steuer-Vorlesung: Diese Fassung erklärt die wichtigsten Punkte so, dass man sie ohne Vorwissen in einer Vorstandssitzung besprechen kann.'),Spacer(1,8*mm),box('Die Antwort in einem Satz','Ja, die Gemeinnützigkeit passt zu unserem Verein und lohnt sich langfristig. Aber unsere Satzung muss zuerst ergänzt werden.',GREEN)]

#2
page('Das Wichtigste zuerst')
story.append(Light(AMBER,'UNSER STATUS: gute Voraussetzungen, aber die Satzung reicht noch nicht'))
story+=[Spacer(1,7*mm)]+bullets(['Unsere Vereinsziele passen sehr gut zur Gemeinnützigkeit.','Die aktuelle Satzung enthält mehrere vorgeschriebene Sätze noch nicht.','Bei unseren heutigen Beträgen ist wahrscheinlich keine Körperschaft- oder Gewerbesteuer zu zahlen.','Werbung, Bewirtung und manche Veranstaltungen müssen trotzdem sauber getrennt werden.','Die Impfaktionen können begünstigt sein. Dafür müssen wir genauer dokumentieren, wie sie ablaufen.'])
story.append(Spacer(1,5*mm));story.append(box('Unsere Empfehlung','Satzung verbessern, vorher mit dem Finanzamt abstimmen und danach Gemeinnützigkeit beantragen.',GREEN))

#3
page('Was wurde geprüft?')
story += bullets(['unsere Satzung vom 7. Januar 2026','unser Finanzbericht vom 1. Januar bis 31. Juli 2026','jede dort genannte Einnahme und wesentliche Ausgabe','Körperschaftsteuer, Gewerbesteuer und Umsatzsteuer','die Regeln für gemeinnützige Vereine'])
story.append(Spacer(1,7*mm));story.append(box('Was nicht vorlag','Einzelbelege, Verträge, Teilnehmerlisten, Impfabläufe und die genaue Zusammensetzung der Veranstaltungseinnahmen. Wo diese Informationen fehlen, steht in dieser Unterlage ausdrücklich „noch zu klären“.',AMBER))
story.append(Spacer(1,7*mm));story.append(P('Diese verständliche Fassung ersetzt nicht die ausführliche Fachfassung. Sie übersetzt deren Ergebnisse in Alltagssprache.','small'))

#4
page('Was macht unser Verein?')
story.append(table([['Laut Satzung','Ganz einfach gesagt'],['Rasse- und Ziergeflügelzucht fördern','Züchter beraten und gute Zucht unterstützen'],['Tierschutz fördern','auf artgerechte Haltung achten'],['Tierseuchen bekämpfen','Impfungen und Vorsorge organisieren'],['Natur- und Umweltschutz','verantwortungsvollen Umgang mit Tieren und Natur fördern'],['Jugendarbeit','junge Menschen an die Zucht heranführen'],['Ausstellungen und Vorträge','Wissen zeigen und weitergeben']],[80*mm,90*mm]));story.append(Spacer(1,6*mm));story.append(box('Warum das wichtig ist','Genau diese Ziele können vom Finanzamt als gemeinnützig anerkannt werden. Inhaltlich sind wir also auf dem richtigen Weg.',GREEN))

#5
page('Unser Geld auf einen Blick')
story.append(kpis([(money(2917.18),'Einnahmen'),(money(2177.55),'Ausgaben'),(money(728.07),'Überschuss'),('7 Monate','Zeitraum')]))
story.append(Spacer(1,8*mm));story.append(P('Der Überschuss von 728,07 € ist klein. Selbst wenn man sehr vorsichtig rechnet, ist eine Zahlung von Körperschaft- oder Gewerbesteuer nach den vorliegenden Zahlen nicht zu erwarten.'))
story.append(box('Aber Achtung','Der Bericht endet am 31. Juli 2026. Das ganze Jahr und mögliche weitere Einnahmen kennen wir noch nicht.',AMBER))

#6
page('Woher kamen die Einnahmen?')
story.append(table([['Einnahme','Betrag','Anteil ungefähr'],['Mitgliedsbeiträge','905,00 €','31 %'],['Spenden','427,00 €','15 %'],['Impfen intern','578,73 €','20 %'],['Impfen extern','559,95 €','19 %'],['Veranstaltungen','416,50 €','14 %'],['Werbung','25,00 €','1 %'],['Pfand','5,00 €','unter 1 %']],[65*mm,45*mm,60*mm]));story.append(Spacer(1,6*mm));story.append(box('Auffällig','Die Impfbeiträge sind zusammen der größte leistungsbezogene Einnahmeblock. Deshalb müssen wir gerade diesen Bereich gut erklären und belegen können.',BLUE))

#7
page('Warum gibt es vier „Geld-Schubladen“?')
story.append(P('Ein gemeinnütziger Verein muss seine Einnahmen und Ausgaben gedanklich in vier Schubladen sortieren:'))
story.append(table([['Schublade','Beispiel bei uns'],['1. Vereinszweck ohne Verkauf','Beiträge, Spenden, Beratung'],['2. Vermögen nutzen','zum Beispiel Zinsen - derzeit kaum vorhanden'],['3. Zweck mit Bezahlung','möglicherweise Impfaktion oder Fachausstellung'],['4. normales Geschäft','Werbung, Essenverkauf, geselliges Fest']],[80*mm,90*mm]));story.append(Spacer(1,7*mm));story.append(box('Merksatz','Gemeinnützig heißt nicht: „Alles ist steuerfrei.“ Die vier Schubladen bleiben getrennt.',AMBER))

#8
page('Schublade 1: normale Vereinsarbeit')
story.append(P('Hier landet alles, was direkt unserer Vereinsarbeit dient und keine bezahlte Einzelleistung ist.'))
story += bullets(['allgemeine Mitgliedsbeiträge','echte Spenden ohne Gegenleistung','Zuchtberatung und Aufklärung','Jugendarbeit','Verbandsarbeit','allgemeine Verwaltung'])
story.append(Spacer(1,5*mm));story.append(box('Beispiel','Ein Mitglied zahlt seinen Jahresbeitrag. Dafür bekommt es keine bestimmte Impfung oder Ware. Das ist normale Vereinsarbeit.',GREEN))

#9
page('Schublade 2: Vermögen nutzen')
story.append(P('Das wäre zum Beispiel der Fall, wenn der Verein Geld anlegt und Zinsen bekommt oder eigene Räume langfristig vermietet.'))
story.append(Light(GREEN,'AKTUELL: In unserem Finanzbericht spielt das praktisch keine Rolle'))
story+=[Spacer(1,8*mm),P('Sponsoring ist ein Sonderfall','h2'),P('Steht ein Firmenname nur klein als Unterstützer auf einem Plakat, kann die Behandlung günstiger sein. Werben wir aktiv für die Firma, ist es normalerweise ein Geschäft. Deshalb braucht jeder Sponsor einen klaren Vertrag.')]

#10
page('Schublade 3: Zweckbetrieb')
story.append(P('Ein Zweckbetrieb ist eine bezahlte Tätigkeit, die wir brauchen, um unseren gemeinnützigen Zweck zu erfüllen.'))
story.append(table([['Frage','Bei unseren Impfaktionen'],['Dient es dem Vereinszweck?','Ja: Bekämpfung von Tierseuchen steht in der Satzung.'],['Ist die Tätigkeit dafür wirklich nötig?','Wahrscheinlich - muss erklärt werden.'],['Treten wir unnötig gegen normale Anbieter an?','Muss anhand der Rolle von Tierarzt und Verein geprüft werden.'],['Ist alles nachvollziehbar?','Noch nicht: Kosten und Ablauf sind zu wenig aufgeschlüsselt.']],[70*mm,100*mm]));story.append(Spacer(1,5*mm));story.append(box('Vorläufiges Ergebnis','Die Einordnung als Zweckbetrieb ist gut denkbar, aber nicht allein durch den Kontonamen bewiesen.',AMBER))

#11
page('Schublade 4: normales Geschäft')
story.append(P('Hierzu gehören Tätigkeiten, die auch ein normales Unternehmen anbieten könnte.'))
story += bullets(['Werbung für Firmen','Verkauf von Essen und Getränken','Verkauf von Waren','gesellige Feste','möglicherweise Teile einer Ausstellung oder Impfaktion'])
story.append(Spacer(1,5*mm));story.append(box('Keine Panik','Unsere sicher erkennbaren Werbeeinnahmen betragen nur 25 €. Ein kleines Geschäft nimmt dem Verein nicht automatisch die Gemeinnützigkeit. Es muss nur getrennt gebucht werden.',GREEN))

#12
page('Erfüllt unsere Satzung die Regeln?')
story.append(table([['Punkt','Stand heute'],['Unsere Ziele sind gemeinnützig möglich','JA'],['Die Umsetzung ist beschrieben','weitgehend JA'],['„ausschließlich und unmittelbar“ steht drin','NEIN'],['Selbstlosigkeit steht drin','NEIN'],['Geld darf nur für Vereinszwecke verwendet werden','nicht vollständig'],['Mitglieder dürfen nicht begünstigt werden','NEIN'],['Vermögen ist beim Ende richtig gebunden','nicht vollständig']],[125*mm,45*mm]));story.append(Spacer(1,6*mm));story.append(Light(RED,'ERGEBNIS: Mit dieser Satzung ist die Anerkennung noch nicht möglich'))

#13
page('Was fehlt in der Satzung?')
story += bullets(['Der Verein arbeitet selbstlos und nicht hauptsächlich für eigene wirtschaftliche Vorteile.','Das Vereinsgeld darf nur für die gemeinnützigen Ziele verwendet werden.','Mitglieder bekommen keine Zuwendungen aus dem Vereinsvermögen.','Niemand darf unangemessen bezahlt oder bevorzugt werden.','Auch beim Wegfall der Gemeinnützigkeit bleibt das Vermögen gemeinnützig gebunden.','Der Empfänger des Restvermögens muss selbst steuerbegünstigt sein und das Geld für einen festgelegten gemeinnützigen Zweck verwenden.'])
story.append(Spacer(1,5*mm));story.append(box('Gut zu wissen','Das sind übliche Standardsätze. Wir müssen den Verein nicht neu erfinden - wir müssen die Satzung nur rechtssicher ergänzen.',GREEN))

#14
page('Was sollte ungefähr hineingeschrieben werden?')
story.append(box('In verständlicher Kurzform','Unser Verein verfolgt ausschließlich und unmittelbar gemeinnützige Zwecke. Er fördert insbesondere Tierzucht, Tierschutz und die Bekämpfung von Tierseuchen. Er arbeitet selbstlos. Vereinsgeld darf nur für diese Ziele eingesetzt werden. Mitglieder dürfen keine Zuwendungen bekommen. Niemand darf unangemessen begünstigt werden. Bei Auflösung oder Verlust der Gemeinnützigkeit bleibt das Vermögen für einen gemeinnützigen Zweck gebunden.',BLUE))
story.append(Spacer(1,7*mm));story.append(P('Der endgültige Wortlaut sollte sich eng an der gesetzlichen Mustersatzung orientieren und <b>vor der Abstimmung</b> mit dem Finanzamt geprüft werden.'))
story.append(box('Wichtig','Nicht einfach nur diese Kurzform beschließen. Für die echte Satzung brauchen wir den vollständigen juristischen Wortlaut aus der Fachfassung.',AMBER))

#15
page('Mitgliedsbeiträge und Spenden')
story.append(table([['Geldart','Einfach erklärt'],['Mitgliedsbeitrag 905 €','normale Vereinsfinanzierung; grundsätzlich unproblematisch'],['Spende 427 €','nur eine Spende, wenn es keine Gegenleistung gibt'],['Spendenquittung','erst ausstellen, wenn wir dazu vom Finanzamt berechtigt sind'],['Beitragsquittung','bei einem Tierzuchtverein steuerlich regelmäßig nicht abzugsfähig']],[65*mm,105*mm]));story.append(Spacer(1,6*mm));story.append(box('Beispiel','Jemand gibt 50 € ohne etwas dafür zu bekommen: mögliche Spende. Eine Firma gibt 50 € und bekommt ein Werbebanner: keine Spende, sondern Werbung.',AMBER))

#16
page('Die Impfbeiträge')
story.append(kpis([(money(578.73),'intern'),(money(559.95),'extern'),(money(1138.68),'zusammen'),(money(400.87),'gebuchte Kosten')]))
story.append(Spacer(1,7*mm));story.append(P('Rechnerisch bleiben 737,81 € Unterschied. Das muss kein Gewinn sein: Vielleicht fehlen dort Tierarztkosten, Fahrt, Material oder andere Ausgaben.'))
story.append(P('Für jede Impfaktion sollten wir festhalten: Wer organisiert? Wer impft? Wer bekommt die Leistung? Wie wird der Preis berechnet? Welche Kosten entstehen?'))
story.append(box('Bewertung','Zweckbetrieb möglich. Ohne diese Unterlagen kann das aber niemand sicher bestätigen.',AMBER))

#17
page('Werbung und Veranstaltungen')
story.append(table([['Einnahme','Was wir damit machen'],['Werbung 25 €','als normales Geschäft getrennt buchen'],['Eintritt zur Fachausstellung','kann Zweckbetrieb sein'],['Essen und Getränke','normalerweise Geschäft'],['geselliges Fest','normalerweise Geschäft'],['echte freiwillige Spende','normale Vereinsarbeit'],['Standgebühr/Verkaufsstand','gesondert prüfen']],[80*mm,90*mm]));story.append(Spacer(1,6*mm));story.append(box('Das Problem im Finanzbericht','Die 416,50 € Veranstaltungseinnahmen stehen nur als eine Summe da. Künftig bitte Eintritt, Essen, Spenden, Standgeld und Werbung getrennt buchen.',RED))

#18
page('Wofür wurde Geld ausgegeben?')
story.append(table([['Ausgabenblock','Betrag'],['Veranstaltung und Verpflegung','550,75 €'],['Impfungen','400,87 €'],['Werbemittel','345,58 €'],['Verbände','363,50 €'],['Büro, Internet, Porto','269,19 €'],['Gericht und Notar','186,66 €'],['Gutschein + ungeklärte Verfügung','61,00 €']],[115*mm,55*mm]));story.append(Spacer(1,5*mm));story.append(P('Die meisten Ausgaben wirken für einen Verein nachvollziehbar. Entscheidend ist aber immer: Wofür genau war die Ausgabe und zu welcher Einnahmen-Schublade gehört sie?'))

#19
page('Zwei Ausgaben müssen wir erklären')
story.append(box('1. „Eigenmächtige Verfügung Sternal“ - 46,00 €','Dieser Kontoname ist steuerlich und vereinsintern nicht verständlich. Wir brauchen Empfänger, Beleg, Grund und die Information, ob der Vorstand zugestimmt hat.',RED))
story.append(Spacer(1,7*mm));story.append(box('2. Geburtstagsgutschein - 15,00 €','Kleine Aufmerksamkeiten können in angemessenem Rahmen möglich sein. Anlass, Empfänger und Wert müssen aber dokumentiert werden, weil Mitglieder nicht einfach aus Vereinsmitteln beschenkt werden dürfen.',AMBER))
story.append(Spacer(1,7*mm));story.append(P('Außerdem sollte beim Einkauf von Werbemitteln klar sein, ob sie kostenlos verteilt, verkauft oder für Werbung eines Sponsors genutzt wurden.'))

#20
page('Müssen wir Körperschaftsteuer zahlen?')
story.append(Light(GREEN,'NACH HEUTIGER DATENLAGE: sehr wahrscheinlich nein'))
story+=[Spacer(1,7*mm),P('Warum?','h2')]+bullets(['Unser gesamter Überschuss bis Juli beträgt nur 728,07 €.','Der allgemeine Körperschaftsteuer-Freibetrag beträgt 5.000 €.','Bei Gemeinnützigkeit sind die begünstigten Vereinsbereiche zusätzlich geschützt.','Die endgültige Aussage ist erst mit dem vollständigen Jahresabschluss möglich.'])
story.append(box('Nicht verwechseln','Der Freibetrag befreit nicht automatisch jeden Umsatz. Entscheidend ist am Ende der steuerliche Gewinn.',BLUE))

#21
page('Müssen wir Gewerbesteuer zahlen?')
story.append(Light(GREEN,'NACH HEUTIGER DATENLAGE: ebenfalls sehr wahrscheinlich nein'))
story+=[Spacer(1,7*mm),P('Gewerbesteuer betrifft nur den gewerblichen Teil, zum Beispiel Werbung oder Warenverkauf. Der sicher erkennbare Geschäftsumsatz ist sehr klein. Auch der gesamte Vereinsüberschuss liegt weit unter üblichen Freibeträgen.','body')]
story.append(P('Bei anerkannter Gemeinnützigkeit bleiben nicht begünstigte Geschäftsbetriebe bis insgesamt 50.000 € Jahreseinnahmen grundsätzlich von Körperschaft- und Gewerbesteuer verschont. Diese Grenze gilt <b>nicht</b> für die Umsatzsteuer.'))

#22
page('Und was ist mit Umsatzsteuer?')
story.append(P('Umsatzsteuer fragt vor allem: Haben wir für Geld eine konkrete Leistung erbracht?'))
story.append(table([['Beispiel','Meistens'],['echter Mitgliedsbeitrag','keine Umsatzsteuer'],['echte Spende','keine Umsatzsteuer'],['Werbung','umsatzsteuerbare Leistung'],['Impfleistung','kann umsatzsteuerbar sein'],['Eintritt, Essen, Waren','kann umsatzsteuerbar sein']],[85*mm,85*mm]));story.append(Spacer(1,5*mm));story.append(box('Warum trotzdem wahrscheinlich nichts anfällt','Die Kleinunternehmerregelung gilt grundsätzlich, wenn der Vorjahresumsatz höchstens 25.000 € und der laufende Jahresumsatz höchstens 100.000 € beträgt. Unsere bekannten Beträge liegen weit darunter - vorausgesetzt, es gibt keine unbekannten Umsätze und wir haben nicht darauf verzichtet.',GREEN))

#23
page('Was bringt uns die Gemeinnützigkeit?')
story.append(table([['Vorteil','Für uns bedeutet das'],['Spenden','echte Spendenquittungen werden möglich'],['Fördermittel','bessere Chancen bei Zuschüssen und Stiftungen'],['Steuern','begünstigte Bereiche sind geschützt'],['Vertrauen','klare und geprüfte Zweckbindung'],['Wachstum','mehr Spielraum, wenn Aktivitäten größer werden'],['Kooperationen','leichtere Zusammenarbeit mit Stadt, Verbänden und Förderern']],[62*mm,108*mm]));story.append(Spacer(1,5*mm));story.append(box('Realistisch bleiben','Die Gemeinnützigkeit bringt uns heute keine riesige Steuerersparnis. Ihr Wert liegt vor allem bei Spenden, Förderung, Vertrauen und Zukunftssicherheit.',GREEN))

#24
page('Was macht die Gemeinnützigkeit anstrengender?')
story += bullets(['Wir müssen Einnahmen und Ausgaben sauber trennen.','Jeder Beleg braucht einen verständlichen Grund.','Vereinsgeld darf nur für die Satzungsziele verwendet werden.','Rücklagen und größere Ausgaben brauchen gute Beschlüsse.','Spendenquittungen dürfen nur korrekt ausgestellt werden.','Wir müssen dem Finanzamt regelmäßig Unterlagen vorlegen.','Die tatsächliche Arbeit muss zur Satzung passen.'])
story.append(Spacer(1,5*mm));story.append(box('Unsere Einschätzung','Bei unserer Vereinsgröße ist dieser Zusatzaufwand gut beherrschbar, wenn Kassierer und Vorstand einen klaren Kontenplan und eine einfache Checkliste nutzen.',AMBER))

#25
page('Unsere klare Entscheidung')
story.append(P('JA - die Gemeinnützigkeit lohnt sich für den RGZV Hagen.','big'))
story.append(P('Unsere Zwecke passen ausdrücklich zum Gesetz. Die nötigen Satzungsänderungen sind überschaubar. Die heutigen Steuerbeträge sind zwar gering, aber Spendenfähigkeit, Förderchancen und langfristige Sicherheit sprechen deutlich dafür.'))
story.append(Light(GREEN,'EMPFEHLUNG: Gemeinnützigkeit jetzt geordnet vorbereiten'))
story.append(Spacer(1,8*mm));story.append(P('Die nächsten Schritte','h2'))
story.append(table([['1','Satzungsentwurf nach Mustersatzung erstellen'],['2','Entwurf vorab mit dem Finanzamt abstimmen'],['3','Mitgliederversammlung korrekt einladen und abstimmen'],['4','Änderung über Notar und Vereinsregister eintragen'],['5','Feststellung der Satzungsmäßigkeit beantragen'],['6','Buchhaltung in vier Schubladen einrichten'],['7','Impfung und Veranstaltungen rückwirkend genauer aufteilen'],['8','Jedes Jahr eine kurze interne Prüfung durchführen']],[15*mm,155*mm]));story.append(Spacer(1,5*mm));story.append(box('Der wichtigste Satz für die Sitzung','Wir haben kein akutes Steuerproblem. Wir haben eine gute Gelegenheit, den Verein jetzt sauber und zukunftssicher gemeinnützig aufzustellen.',NAVY))
story.append(Spacer(1,5*mm));story.append(P('Rechtsstand: 2. August 2026. Grundlage: vorgelegte Satzung, Finanzbericht 1.1.-31.7.2026 sowie AO, KStG, GewStG, UStG, EStG und BGB. Offene Einzelfragen sind in der ausführlichen Fachfassung dokumentiert.','small'))

doc=SimpleDocTemplate(OUT,pagesize=A4,leftMargin=20*mm,rightMargin=20*mm,topMargin=19*mm,bottomMargin=18*mm,title='RGZV Steuern einfach erklärt',author='RGZV Hagen und Umgebung seit 1903 e.V.')
doc.build(story,canvasmaker=NumCanvas)
print(OUT)
