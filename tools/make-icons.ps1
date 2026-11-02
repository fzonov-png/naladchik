Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\assets\icons'
New-Item -ItemType Directory -Force -Path $out | Out-Null

function New-RoundedPath {
    param([float]$X, [float]$Y, [float]$W, [float]$H, [float]$R)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $R * 2
    $path.AddArc($X, $Y, $d, $d, 180, 90)
    $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
    $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
    $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-AppIcon {
    param([int]$Size, [string]$File, [bool]$Maskable)

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $background = [System.Drawing.ColorTranslator]::FromHtml('#0a111a')
    $graphics.Clear($background)

    $startColor = [System.Drawing.ColorTranslator]::FromHtml('#5c9bff')
    $endColor = [System.Drawing.ColorTranslator]::FromHtml('#2f6fed')

    if ($Maskable) {
        $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            (New-Object System.Drawing.Point(0, 0)),
            (New-Object System.Drawing.Point($Size, $Size)),
            $startColor,
            $endColor)
        $graphics.FillRectangle($gradient, 0, 0, $Size, $Size)
        $gradient.Dispose()
    } else {
        $padding = [int]($Size * 0.06)
        $radius = [int]($Size * 0.21)
        $path = New-RoundedPath $padding $padding ($Size - 2 * $padding) ($Size - 2 * $padding) $radius
        $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            (New-Object System.Drawing.Point($padding, $padding)),
            (New-Object System.Drawing.Point(($Size - $padding), ($Size - $padding))),
            $startColor,
            $endColor)
        $graphics.FillPath($gradient, $path)
        $gradient.Dispose()

        $highlight = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, 255, 255, 255), [float]($Size * 0.008))
        $graphics.DrawPath($highlight, $path)
        $highlight.Dispose()
        $path.Dispose()
    }

    $fontSize = [int]($Size * $(if ($Maskable) { 0.36 } else { 0.44 }))
    $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $rect = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)

    if ($Maskable) {
        $graphics.DrawString('Н', $font, $brush, $rect, $format)
    } else {
        $graphics.DrawString('Н', $font, $brush, $rect, $format)
    }

    $target = Join-Path $out $File
    $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)

    $brush.Dispose()
    $format.Dispose()
    $font.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

New-AppIcon -Size 512 -File 'icon-512.png' -Maskable $false
New-AppIcon -Size 192 -File 'icon-192.png' -Maskable $false
New-AppIcon -Size 512 -File 'icon-maskable-512.png' -Maskable $true

Write-Output 'Icons generated:'
Get-ChildItem $out -Filter *.png | Select-Object Name, Length
