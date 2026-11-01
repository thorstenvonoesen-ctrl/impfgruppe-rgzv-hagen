import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "file:///C:/Users/thors/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const root = "C:/Users/thors/OneDrive/Documents/GitHub/impfgruppe-rgzv-hagen/Festschrift_125_Jahre_RGZV_Hagen";
const outputDir = `${root}/12_Redaktion`;
const previewDir = `${root}/09_Layout/Tabellen_Vorschau`;
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const GREEN = "#23483B";
const RED = "#7B3029";
const CREAM = "#F4EFE4";
const LIGHT = "#E8E2D6";
const AMBER = "#FFF1B8";
const WHITE = "#FFFFFF";
const FONT = "Arial";

function setupSheet(sheet, title, subtitle, cols) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${cols}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A2:${cols}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange(`A1:${cols}1`).format = { font: { name: FONT, size: 16, bold: true, color: GREEN } };
  sheet.getRange(`A2:${cols}2`).format = { font: { name: FONT, size: 10, italic: true, color: "#5B625E" } };
  sheet.getRange(`A3:${cols}3`).format.borders = { bottom: { style: "medium", color: RED } };
  sheet.freezePanes.freezeRows(5);
}

function styleTable(sheet, range, headerRange) {
  sheet.getRange(range).format.font = { name: FONT, size: 10, color: "#222222" };
  sheet.getRange(range).format.verticalAlignment = "center";
  sheet.getRange(headerRange).format = {
    fill: GREEN,
    font: { name: FONT, size: 10, bold: true, color: WHITE },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: WHITE },
  };
}

async function finish(workbook, sheet, fileName, previewName, inspectRange) {
  workbook.recalculate();
  const inspect = await workbook.inspect({ kind: "table", sheetId: sheet.name, range: inspectRange, include: "values,formulas", tableMaxRows: 12, tableMaxCols: 12, maxChars: 6000 });
  console.log(inspect.ndjson);
  const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
  console.log(errors.ndjson);
  const preview = await workbook.render({ sheetName: sheet.name, range: inspectRange, scale: 1, format: "png" });
  await fs.writeFile(`${previewDir}/${previewName}`, new Uint8Array(await preview.arrayBuffer()));
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(`${outputDir}/${fileName}`);
}

// 1) Editorial plan
{
  const wb = Workbook.create();
  const sh = wb.worksheets.add("Redaktionsplan");
  setupSheet(sh, "Redaktionsplan Festschrift 2028", "Arbeitsstand je Kapitel; gelbe Zellen benötigen redaktionelle Eingaben.", "I");
  const chapters = [
    "Titel und Innentitel","Impressum","Inhaltsverzeichnis","Grußwort Frank Sternal","Weitere Grußworte",
    "1903 Ein Verein entsteht","Zeittafel 1903–2028","Die ersten Jahre 1903–1914","Erster Weltkrieg 1914–1918","1920er Jahre","Verein und Gesellschaft 1933–1945","Neubeginn nach 1945","1950er bis 1970er","1980er und 1990er","100 Jahre 1903–2003","Vom 100. zum 125. Jubiläum","Der RGZV Hagen heute","Vorstand 2028","Unsere Mitglieder","Ehrenmitglieder","Vorsitzende seit 1903","Vorstände im Wandel","Unsere Ausstellungen","Damals und heute","Faszination Rassegeflügel","Rassen unserer Mitglieder","Vom Ei zum Küken","Gesundheit und Verantwortung","Vereinsleben","Nachwuchs","Züchterschulung","Digitalisierung","Befreundete Vereine","Jubiläumsjahr 2028","Festakt","Jubiläumsschau","125 Jahre in Zahlen","Prägende Persönlichkeiten","Historische Dokumente","Historische Fotos","Hagen und der Verein","Pressespiegel","Anekdoten","Interviews","Blick in die Zukunft","Danksagung","Gedenkseite","Sponsoren","Werbeanzeigen","Bild- und Quellennachweis","Quellenverzeichnis","Rückseite"
  ];
  const headers = ["Kapitel","Inhalt vorhanden?","Text geprüft?","Bilder vorhanden?","Bildrechte geklärt?","Quelle geprüft?","Layout fertig?","Freigabe?","Bemerkung"];
  sh.getRange("A5:I5").values = [headers];
  const rows = chapters.map(c => [c,"Nein","Nein","Nein","Nein","Nein","In Arbeit","Nein",""]);
  sh.getRange("A6").write(rows);
  const end = 5 + rows.length;
  styleTable(sh, `A5:I${end}`, "A5:I5");
  sh.tables.add(`A5:I${end}`, true, "RedaktionsplanTable").style = "TableStyleMedium4";
  for (const col of ["B","C","D","E","F","G","H"]) sh.getRange(`${col}6:${col}${end}`).dataValidation = { rule: { type: "list", values: ["Nein","In Arbeit","Ja","Nicht erforderlich"] } };
  sh.getRange(`B6:H${end}`).format.fill = AMBER;
  sh.getRange(`A6:A${end}`).format.font = { name: FONT, size: 10, bold: true, color: GREEN };
  sh.getRange(`I6:I${end}`).format.wrapText = true;
  sh.getRange("A:I").format.columnWidth = 16;
  sh.getRange("A:A").format.columnWidth = 34;
  sh.getRange("I:I").format.columnWidth = 34;
  sh.getRange("B:H").format.columnWidth = 16;
  sh.getRange(`A5:I${end}`).format.autofitRows();
  await finish(wb, sh, "Redaktionsplan_Festschrift_2028.xlsx", "Redaktionsplan.png", `A1:I${Math.min(end,25)}`);
}

// 2) Images and sources
{
  const wb = Workbook.create();
  const sh = wb.worksheets.add("Bilder und Quellen");
  setupSheet(sh, "Bilder und Quellen Festschrift 2028", "Eine Zeile je Bild oder Dokument; ungesicherte Angaben ausdrücklich offen lassen.", "J");
  const headers = ["Bildnummer","Dateiname","Motiv","Ungefähres Jahr","Quelle","Urheber","Nutzungsrecht","Kapitel","Bildunterschrift","Freigabe"];
  sh.getRange("A5:J5").values = [headers];
  const rows = Array.from({length: 40}, (_,i) => [i+1,"","","undatiert","","","Ungeklärt","","","Nein"]);
  sh.getRange("A6").write(rows);
  const end = 5 + rows.length;
  styleTable(sh, `A5:J${end}`, "A5:J5");
  sh.tables.add(`A5:J${end}`, true, "BilderQuellenTable").style = "TableStyleMedium4";
  sh.getRange(`G6:G${end}`).dataValidation = { rule: { type: "list", values: ["Ungeklärt","Anfrage läuft","Freigegeben","Gemeinfrei","Lizenz dokumentiert","Nicht verwendbar"] } };
  sh.getRange(`J6:J${end}`).dataValidation = { rule: { type: "list", values: ["Nein","In Prüfung","Ja"] } };
  sh.getRange(`B6:J${end}`).format.fill = AMBER;
  sh.getRange(`A6:A${end}`).format.numberFormat = "0";
  const widths = {A:12,B:28,C:30,D:16,E:24,F:22,G:22,H:28,I:42,J:14};
  for (const [col,w] of Object.entries(widths)) sh.getRange(`${col}:${col}`).format.columnWidth = w;
  sh.getRange(`A5:J${end}`).format.autofitRows();
  await finish(wb, sh, "Bilder_und_Quellen_Festschrift_2028.xlsx", "Bilder_und_Quellen.png", "A1:J18");
}

// 3) Advertising and sponsors
{
  const wb = Workbook.create();
  const sh = wb.worksheets.add("Anzeigen und Sponsoren");
  setupSheet(sh, "Anzeigen und Sponsoren Festschrift 2028", "Preise erst nach Beschluss eintragen; Unternehmen nur nach Kontaktaufnahme und Zusage führen.", "J");
  const headers = ["Unternehmen","Ansprechpartner","Anzeigenformat","Preis","Logo erhalten","Anzeige erhalten","Rechnung","Bezahlt","Position","Bemerkung"];
  sh.getRange("A5:J5").values = [headers];
  const rows = Array.from({length: 30}, () => ["","","","", "Nein","Nein","Offen","Nein","",""]);
  sh.getRange("A6").write(rows);
  const end = 5 + rows.length;
  styleTable(sh, `A5:J${end}`, "A5:J5");
  sh.tables.add(`A5:J${end}`, true, "AnzeigenSponsorenTable").style = "TableStyleMedium4";
  sh.getRange(`C6:C${end}`).dataValidation = { rule: { type: "list", values: ["1/1 Seite","1/2 Seite","1/4 Seite","U2","U3","U4","Sachspende","Förderung"] } };
  for (const col of ["E","F","H"]) sh.getRange(`${col}6:${col}${end}`).dataValidation = { rule: { type: "list", values: ["Nein","Angefragt","Ja"] } };
  sh.getRange(`G6:G${end}`).dataValidation = { rule: { type: "list", values: ["Offen","Erstellt","Versendet","Storniert"] } };
  sh.getRange(`D6:D${end}`).format.numberFormat = "#,##0.00 [$€-407]";
  sh.getRange(`A6:J${end}`).format.fill = AMBER;
  const widths = {A:28,B:24,C:20,D:14,E:16,F:17,G:16,H:14,I:22,J:34};
  for (const [col,w] of Object.entries(widths)) sh.getRange(`${col}:${col}`).format.columnWidth = w;
  sh.getRange(`A5:J${end}`).format.autofitRows();
  await finish(wb, sh, "Anzeigen_Sponsoren_Festschrift_2028.xlsx", "Anzeigen_Sponsoren.png", "A1:J18");
}
