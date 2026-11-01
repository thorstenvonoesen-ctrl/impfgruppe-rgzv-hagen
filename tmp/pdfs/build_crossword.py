import random, json, textwrap, subprocess
from pathlib import Path
from collections import defaultdict
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pdfplumber
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf'; OUT.mkdir(parents=True,exist_ok=True)
DATA=[
('AUSSTELLUNG','Schau, auf der Zuchttiere öffentlich präsentiert werden.'),
('PREISRICHTER','Fachperson, die Tiere nach dem Standard beurteilt.'),
('GEFLUEGEL','Sammelbegriff für Hühner, Enten, Gänse und verwandte Nutzvögel.'),
('BEWERTUNG','Fachliches Urteil, das auf der Schaukarte festgehalten wird.'),
('ZUECHTER','Plant Verpaarungen und wählt die Nachzucht aus.'),
('STANDARD','Verbindliche Beschreibung der Merkmale einer Rasse.'),
('VOLIERE','Überdachter oder überspannter Freiflugraum für Vögel.'),
('KUEKEN','Jungvogel in der ersten Zeit nach dem Schlupf.'),
('BRUT','Entwicklung des Embryos im Ei unter Wärmeeinwirkung.'),
('RASSE','Zuchtgruppe mit erblich gefestigten, typischen Merkmalen.'),
('HAHN','Männliches Zuchttier bei den Hühnern.'),
('HENNE','Weibliches Zuchttier bei den Hühnern.'),
('FEDER','Einzelnes Gebilde aus Kiel und Fahne im Vogelkleid.'),
('KAMM','Fleischiger Kopfschmuck, etwa in Rosen- oder Erbsenform.'),
('TAUBE','Vogel, dessen Rassen etwa in Tümmler und Kröpfer gegliedert werden.'),
('RING','Geschlossene Kennzeichnung am Lauf eines Ausstellungstiers.'),
('SCHLUPF','Vorgang, bei dem das Jungtier die Eischale verlässt.'),
('GELEGE','Gesamtheit der zu einer Brut gehörenden Eier.'),
('STALL','Geschützter Innenraum für Unterbringung und Nachtruhe.'),
('ZUCHT','Gezielte Verpaarung und Auslese zur Erhaltung von Merkmalen.'),
('GEFIEDER','Gesamtheit der Federn eines Vogels.'),
('BRUTEI','Zur Erzeugung von Nachzucht vorgesehenes Ei.'),
('FARBSCHLAG','Farb- und Zeichnungsvariante innerhalb einer Rasse.'),
('MELDUNG','Anmeldung eines Tieres zur Teilnahme an einer Schau.'),
('KATALOG','Verzeichnis der ausgestellten Tiere und ihrer Aussteller.'),
('EHRENPREIS','Besondere Auszeichnung für eine herausragende Zuchtleistung.'),
('KAEFIG','Einzelunterbringung zur Präsentation eines Tieres auf der Schau.'),
('ZUCHTBUCH','Aufzeichnung von Abstammung, Verpaarungen und Nachzucht.'),
('MAUSER','Regelmäßiger natürlicher Wechsel des Federkleids.'),
('VEREIN','Organisierter Zusammenschluss für ein gemeinsames Zuchtinteresse.')]
CLUES=dict(DATA)
CLUES.update(dict(zip([w for w,c in DATA],[
'Öffentliche Schau von Zuchttieren.',
'Beurteilt Schautiere nach dem Standard.',
'Sammelbegriff für Hühner, Enten und Gänse.',
'Fachliches Urteil auf der Schaukarte.',
'Plant Verpaarungen und wählt Nachzucht aus.',
'Verbindliches Idealbild einer Rasse.',
'Mit Netz oder Gitter geschützter Flugraum.',
'Jungvogel unmittelbar nach dem Schlupf.',
'Entwicklung im Ei unter Wärmeeinwirkung.',
'Zuchtgruppe mit gefestigten Erbmerkmalen.',
'Männliches Zuchttier bei den Hühnern.',
'Weibliches Zuchttier bei den Hühnern.',
'Einzelgebilde aus Kiel und Fahne.',
'Kopfschmuck in Rosen- oder Erbsenform.',
'Vogel mit Rassegruppen wie den Kröpfern.',
'Geschlossene Kennzeichnung am Lauf.',
'Befreiung des Jungtiers aus der Eischale.',
'Alle zu einer Brut gehörenden Eier.',
'Geschützter Raum für die Nachtruhe.',
'Gezielte Verpaarung und Auslese.',
'Gesamtheit aller Federn eines Vogels.',
'Für die Nachzucht vorgesehenes Ei.',
'Farbvariante innerhalb einer Rasse.',
'Formelle Anmeldung eines Schautiers.',
'Verzeichnis der Tiere und Aussteller.',
'Besondere Auszeichnung auf einer Schau.',
'Einzelunterbringung auf der Geflügelschau.',
'Dokumentation von Abstammung und Paarung.',
'Natürlicher Wechsel des Federkleids.',
'Zusammenschluss mit gemeinsamem Zuchtziel.'
])))

def cells(w,r,c,d):
    return [(r+(i if d else 0),c+(i if not d else 0)) for i in range(len(w))]

def generate(seed):
    rng=random.Random(seed); grid={}; dirs=defaultdict(set); placed=[]
    remaining=list(CLUES); remaining.sort(key=lambda w:-len(w))
    w=remaining.pop(rng.randrange(4))
    for p,ch in zip(cells(w,0,0,0),w): grid[p]=ch; dirs[p].add(0)
    placed.append((w,0,0,0))
    while remaining:
        opts=[]
        for w in remaining:
            candidates=set()
            for i,ch in enumerate(w):
                for (r,c),old in grid.items():
                    if ch==old:
                        for d in (0,1):
                            if d not in dirs[r,c]: candidates.add((r-i*d,c-i*(1-d),d))
            for r,c,d in candidates:
                ps=cells(w,r,c,d)
                if (r-d,c-(1-d)) in grid or (r+d*len(w),c+(1-d)*len(w)) in grid: continue
                cross=0; good=True
                for p,ch in zip(ps,w):
                    if p in grid:
                        if grid[p]!=ch or d in dirs[p]: good=False; break
                        cross+=1
                    elif any(q in grid for q in ((p[0]+1-d,p[1]+d),(p[0]-(1-d),p[1]-d))): good=False; break
                if not good: continue
                allp=list(grid)+ps
                h=max(p[0] for p in allp)-min(p[0] for p in allp)+1
                b=max(p[1] for p in allp)-min(p[1] for p in allp)+1
                if b>27 or h>21: continue
                score=cross*22 - b*h*.10 - abs(b-h)*.4 + len(w)*.5 + rng.random()*7
                opts.append((score,w,r,c,d))
        if not opts: break
        _,w,r,c,d=max(opts)
        for p,ch in zip(cells(w,r,c,d),w): grid[p]=ch; dirs[p].add(d)
        placed.append((w,r,c,d)); remaining.remove(w)
    if remaining:return None
    mr=min(r for r,c in grid); mc=min(c for r,c in grid)
    grid={(r-mr,c-mc):ch for (r,c),ch in grid.items()}
    placed=[(w,r-mr,c-mc,d) for w,r,c,d in placed]
    h=max(r for r,c in grid)+1;b=max(c for r,c in grid)+1
    return (b*h,grid,placed,b,h)

best=None
for seed in range(160):
    result=generate(seed)
    if result and (best is None or result[0]<best[0]):
        best=result;print('Gitter:',seed,result[3:5],flush=True)
    if best and best[0]<=480:break
assert best, 'Kein vollständiges Gitter'
_,grid,placed,cols,rows=best
starts={p:i+1 for i,p in enumerate(sorted({(r,c) for w,r,c,d in placed}))}
entries=sorted([(starts[r,c],w,r,c,d) for w,r,c,d in placed])
marks={}
for i,ch in enumerate('HAGEN',1):
    available=[p for p in sorted(grid) if grid[p]==ch and p not in marks and p not in starts]
    p=available[len(available)//2];marks[p]=i

# Independent validation of maximal runs, crossings, numbering, and connectivity.
assert len(entries)==30 and len({e[1] for e in entries})==30
members=defaultdict(list)
for n,w,r,c,d in entries:
    assert starts[r,c]==n and d in (0,1) and w in CLUES
    ps=cells(w,r,c,d)
    assert (r-d,c-(1-d)) not in grid
    actual=''; rr,cc=r,c
    while (rr,cc) in grid:
        actual+=grid[rr,cc];rr+=d;cc+=1-d
    assert actual==w and len(actual)==len(w)
    for p,ch in zip(ps,w):assert grid[p]==ch;members[p].append((n,d))
assert set(members)==set(grid)
for p,ms in members.items():assert len(ms)<=2 and len({d for n,d in ms})==len(ms)
for p in grid:
    for d in (0,1):
        if (p[0]-d,p[1]-(1-d)) not in grid and (p[0]+d,p[1]+1-d) in grid:
            assert any((r,c)==p and dd==d for n,w,r,c,dd in entries)
seen={entries[0][1]}
while True:
    nxt=seen|{w for n,w,r,c,d in entries if any(set(cells(w,r,c,d)) & set(cells(ww,rr,cc,dd)) for nn,ww,rr,cc,dd in entries if ww in seen)}
    if nxt==seen:break
    seen=nxt
assert len(seen)==30
assert set(starts.values())=={n for n,w,r,c,d in entries}
assert ''.join(grid[p] for p in sorted(marks,key=marks.get))=='HAGEN'

pdfmetrics.registerFont(TTFont('Body','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Bold','C:/Windows/Fonts/arialbd.ttf'))
W,H=A4; M=34; size=min((W-2*M)/cols,365/rows)
assert size>=16, size
gx=(W-cols*size)/2; top=H-105; bottom=top-rows*size
def wrap(s,width,font='Body',fs=9.2):
    lines=[];line=''
    for word in s.split():
        test=(line+' '+word).strip()
        if pdfmetrics.stringWidth(test,font,fs)>width:lines.append(line);line=word
        else:line=test
    return lines+[line]

def create(solution):
    name='Kreuzwortraetsel_RGZV_Hagen'+('_Loesung' if solution else '')
    path=OUT/(name+'.pdf'); cv=canvas.Canvas(str(path),pagesize=A4)
    cv.setTitle('Kreuzworträtsel für Geflügelfreunde'+(' – Lösung' if solution else ''))
    cv.setAuthor('RGZV Hagen und Umgebung seit 1903 e.V.')
    boxes=[]
    def txt(x,y,t,fs=9.2,font='Body'):
        width=pdfmetrics.stringWidth(t,font,fs)
        assert M-1<=x and x+width<=W-M+1,(t,x,width)
        assert y-2>=M and y+fs<=H-M
        boxes.append((x,y-2,x+width,y+fs,t))
        cv.setFont(font,fs);cv.drawString(x,y,t)
    txt(M,H-50,'KREUZWORTRÄTSEL FÜR GEFLÜGELFREUNDE',15,'Bold')
    txt(M,H-65,'Rassegeflügel · Zucht · Ausstellung'+('  |  LÖSUNG' if solution else ''),10)
    txt(M,H-83,'Ä = AE · Ö = OE · Ü = UE · ß = SS   |   Kreisziffern 1–5 ergeben das Lösungswort.',8.5)
    cv.setLineWidth(.55)
    for (r,c),ch in grid.items():
        x=gx+c*size;y=top-(r+1)*size
        cv.rect(x,y,size,size,stroke=1,fill=0)
        if (r,c) in starts:
            cv.setFont('Body',5.7);cv.drawString(x+1.5,y+size-6.2,str(starts[r,c]))
        if solution:
            cv.setFont('Body',size*.55)
            cv.drawCentredString(x+size*(.43 if (r,c) in marks else .49),y+size*(.32 if (r,c) in marks else .23),ch)
        if (r,c) in marks:
            cx=x+size-4.2;cy=y+4.2
            cv.setLineWidth(.4);cv.circle(cx,cy,3.0,stroke=1,fill=0)
            cv.setFont('Body',4.6);cv.drawCentredString(cx,cy-1.6,str(marks[r,c]));cv.setLineWidth(.55)
    cw=(W-2*M-22)/2; ys=[]
    for d in (0,1):
        x=M+d*(cw+22);y=bottom-22
        txt(x,y,'WAAGERECHT' if d==0 else 'SENKRECHT',10,'Bold');y-=17
        for n,w,r,c,dd in entries:
            if dd!=d:continue
            text=w if solution else CLUES[w]
            txt(x,y,str(n)+('.' if not solution else ' ='),9.2,'Bold')
            lines=wrap(text,cw-25)
            for line in lines:txt(x+25,y,line);y-=10.8
            y-=3.0
        ys.append(y)
    ly=68
    assert min(ys)>ly+24,ys
    txt(M,ly+4,'LÖSUNGSWORT',10,'Bold')
    for i,ch in enumerate('HAGEN'):
        x=M+108+i*25;cv.rect(x,ly-3,22,22)
        cv.setFont('Body',5.7);cv.drawString(x+2,ly+12,str(i+1))
        if solution:cv.setFont('Bold',12);cv.drawCentredString(x+11,ly+2,ch)
    txt(M,36,'RGZV Hagen und Umgebung seit 1903 e.V.',8)
    # Text blocks cannot intersect; grid and clue blocks occupy separate bands.
    for i,a in enumerate(boxes):
        for b in boxes[i+1:]:
            assert min(a[2],b[2])-max(a[0],b[0])<=.1 or min(a[3],b[3])-max(a[1],b[1])<=.1,(a,b)
    assert bottom>max(b[3] for b in boxes if b[4] in ('WAAGERECHT','SENKRECHT'))
    cv.showPage();cv.save()
    with pdfplumber.open(path) as doc:
        assert len(doc.pages)==1
        page=doc.pages[0];assert abs(page.width-W)<1 and abs(page.height-H)<1
        extracted=page.extract_text()
        for label in ('WAAGERECHT','SENKRECHT','LÖSUNGSWORT'):assert label in extracted
        for n,w,r,c,d in entries:
            for line in wrap(w if solution else CLUES[w],cw-25):assert line in extracted,line
        for char in page.chars:
            assert char['x0']>=M-1 and char['x1']<=W-M+1 and char['top']>=M-1 and char['bottom']<=H-M+2
    png=ROOT/'tmp/pdfs'/name
    subprocess.run(['pdftoppm','-scale-to','1700','-png','-singlefile',str(path),str(png)],check=True)
    im=Image.open(str(png)+'.png').convert('L')
    # Raster checks: white paper, modest ink coverage, no solid black blocks.
    hist=im.histogram();assert sum(hist[:100])/(im.width*im.height)<.13
    for yy in range(0,im.height-30,15):
        for xx in range(0,im.width-30,15):
            patch=im.crop((xx,yy,xx+30,yy+30));assert sum(patch.histogram()[:70])/900<.8
    return path

create(False);create(True)
(OUT/'Kreuzwortraetsel_Pruefdaten.json').write_text(json.dumps({'columns':cols,'rows':rows,'cell_mm':round(size/72*25.4,2),'entries':[{'number':n,'answer':w,'row':r,'column':c,'direction':'waagerecht' if d==0 else 'senkrecht','clue':CLUES[w]} for n,w,r,c,d in entries],'solution_cells':[{'row':r,'column':c,'index':i,'letter':grid[r,c]} for (r,c),i in marks.items()]},ensure_ascii=False,indent=2),encoding='utf-8')
report=f'''ANZAHL BEGRIFFE: {len(entries)}
ANZAHL WAAGERECHT: {sum(d==0 for n,w,r,c,d in entries)}
ANZAHL SENKRECHT: {sum(d==1 for n,w,r,c,d in entries)}
ALLE WORTLÄNGEN GEPRÜFT: JA
ALLE KREUZUNGEN GEPRÜFT: JA
ALLE FRAGEN ZUGEORDNET: JA
LÖSUNGSWORT GEPRÜFT: HAGEN
PDF-SEITENZAHL RÄTSEL: 1
PDF-SEITENZAHL LÖSUNG: 1
LAYOUTPRÜFUNG: BESTANDEN
GITTER: {cols} x {rows}; KÄSTCHEN: {size/72*25.4:.2f} mm
FRAGENSCHRIFT: 9.2 pt
'''
print(report)
(OUT/'Kreuzwortraetsel_Pruefbericht.txt').write_text(report,encoding='utf-8')

