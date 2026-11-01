$ErrorActionPreference = 'Stop'
$docx = (Resolve-Path -LiteralPath '.\Festschrift_125_Jahre_RGZV_Hagen\10_Druckdaten\Festschrift_RGZV_Hagen_125_Jahre_1903-2028.docx').Path
$pdf = [IO.Path]::ChangeExtension($docx, '.pdf')
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($docx, $false, $true)
  try {
    $doc.ExportAsFixedFormat($pdf, 17, $false, 0, 0, 1, 999, 0, $true, $true, 1, $true, $true, $false)
  } finally { $doc.Close($false) }
} finally { $word.Quit() }
Write-Output $pdf
