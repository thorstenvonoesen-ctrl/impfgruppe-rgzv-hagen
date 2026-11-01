$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath '.\Festschrift_125_Jahre_RGZV_Hagen').Path
$docx = Join-Path $root '10_Druckdaten\Festschrift_RGZV_Hagen_125_Jahre_1903-2028.docx'
$pdf = Join-Path $root '10_Druckdaten\Festschrift_RGZV_Hagen_125_Jahre_1903-2028.pdf'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($docx, $false, $false)
    try {
        $doc.Fields.Update() | Out-Null
        foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
        $doc.Repaginate()
        $pages = $doc.ComputeStatistics(2)
        $doc.Save()
        $doc.ExportAsFixedFormat($pdf, 17)
        Write-Output "PAGES=$pages"
        Write-Output $pdf
    }
    finally { $doc.Close($true) }
}
finally { $word.Quit() }
