$ErrorActionPreference = 'Stop'
$inputPath = (Resolve-Path -LiteralPath '.\output\RGZV_Hagen_Mitgliederplakat_1903.docx').Path
$outputDir = (Resolve-Path -LiteralPath '.\tmp\poster_qa').Path
$pdfPath = Join-Path $outputDir 'docx-word-render.pdf'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($inputPath, $false, $true)
    try {
        $doc.ExportAsFixedFormat($pdfPath, 17)
    }
    finally {
        $doc.Close($false)
    }
}
finally {
    $word.Quit()
}
Write-Output $pdfPath
