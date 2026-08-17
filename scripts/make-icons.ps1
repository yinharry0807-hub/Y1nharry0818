$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\public'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-HarryIcon {
  param([int]$Size, [string]$Path)
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 11, 18, 32))

  $radius = [Math]::Max(18, $Size * 0.22)
  $rect = New-Object System.Drawing.RectangleF (0, 0, $Size, $Size)
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $gp.AddArc(0, 0, $d, $d, 180, 90)
  $gp.AddArc($Size - $d, 0, $d, $d, 270, 90)
  $gp.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
  $gp.AddArc(0, $Size - $d, $d, $d, 90, 90)
  $gp.CloseFigure()

  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 240, 196, 104),
    [System.Drawing.Color]::FromArgb(255, 201, 143, 47),
    45
  )
  $g.FillPath($bgBrush, $gp)

  $fontSize = $Size * 0.62
  $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 26, 20, 8))
  $textRect = New-Object System.Drawing.RectangleF (0, 0, $Size, $Size)
  $g.DrawString('H', $font, $textBrush, $textRect, $sf)

  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "已生成 $Path"
}

New-HarryIcon -Size 512 -Path (Join-Path $outDir 'icon-512.png')
New-HarryIcon -Size 192 -Path (Join-Path $outDir 'icon-192.png')
New-HarryIcon -Size 180 -Path (Join-Path $outDir 'apple-touch-icon.png')
