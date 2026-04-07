Write-Host "🔍 Validando entorno de Hammock AI Site..." -ForegroundColor Yellow

# Paso 1: Verificar package.json
if (Test-Path "package.json") {
    Write-Host "[✅] package.json encontrado"
} else {
    Write-Host "[❌] package.json no encontrado"
    exit 1
}

# Paso 2: Ejecutar npm install
Write-Host "📦 Ejecutando npm install..." -ForegroundColor Yellow
npm install *> $null
if ($LASTEXITCODE -eq 0 -and (Test-Path "node_modules")) {
    Write-Host "[✅] node_modules creado correctamente"
} else {
    Write-Host "[❌] Error al crear node_modules"
    exit 1
}

# Paso 3: Verificar que tailwindcss esté en node_modules
if (Test-Path "node_modules/tailwindcss") {
    Write-Host "[✅] tailwindcss encontrado en node_modules"
} else {
    Write-Host "[❌] tailwindcss no encontrado en node_modules"
    exit 1
}

# Paso 4: Verificar que SOLO tailwindcss esté en devDependencies
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$devDeps = $packageJson.devDependencies | Get-Member -MemberType NoteProperty
$depNames = $devDeps.Name

if ($depNames -contains "tailwindcss" -and $depNames.Count -eq 1) {
    Write-Host "[✅] node_modules contiene SOLO tailwindcss como devDependency"
} else {
    Write-Host "[❌] node_modules contiene otras dependencias además de tailwindcss: $($depNames -join ', ')"
    exit 1
}

# Paso 5: Ejecutar npm run build
Write-Host "🔨 Ejecutando npm run build..." -ForegroundColor Yellow
$buildResult = npm run build 2>&1
$buildExitCode = $LASTEXITCODE
if ($buildExitCode -eq 0) {
    Write-Host "[✅] npm run build completado exitosamente"
} else {
    Write-Host "[❌] npm run build falló:" -ForegroundColor Red
    $buildResult
    exit 1
}

# Paso 6: Verificar que dist/output.css existe
if (Test-Path "dist/output.css") {
    Write-Host "[✅] dist/output.css generado correctamente"
} else {
    Write-Host "[❌] dist/output.css no fue generado"
    exit 1
}

# Paso 7: Verificar que dist/output.css tiene contenido
$cssInfo = Get-Item "dist/output.css"
if ($cssInfo.Length -gt 0) {
    Write-Host "[✅] dist/output.css tiene contenido (tamaño: $($cssInfo.Length) bytes)"
} else {
    Write-Host "[❌] dist/output.css está vacío"
    exit 1
}

# Paso 8: Verificar que no contenga strings sospechosos
$suspiciousContent = Select-String -Path "dist/output.css" -Pattern "@import url|cdn|googleapis|unpkg" -CaseSensitive:$false -Quiet
if (-not $suspiciousContent) {
    Write-Host "[✅] dist/output.css no contiene strings sospechosos"
} else {
    Write-Host "[❌] dist/output.css contiene strings sospechosos" -ForegroundColor Red
    Select-String -Path "dist/output.css" -Pattern "@import url|cdn|googleapis|unpkg" -CaseSensitive:$false
    exit 1
}

Write-Host ""
Write-Host "🎉 Validación completada exitosamente!" -ForegroundColor Green
Write-Host "Todo está configurado correctamente para Hammock AI Site." -ForegroundColor Green