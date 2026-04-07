#!/bin/bash

echo "🔍 Validando entorno de Hammock AI Site..."

# Paso 1: Verificar package.json
if [ -f "package.json" ]; then
    echo "[✅] package.json encontrado"
else
    echo "[❌] package.json no encontrado"
    exit 1
fi

# Paso 2: Ejecutar npm install
echo "📦 Ejecutando npm install..."
npm install > /dev/null 2>&1
if [ $? -eq 0 ] && [ -d "node_modules" ]; then
    echo "[✅] node_modules creado correctamente"
else
    echo "[❌] Error al crear node_modules"
    exit 1
fi

# Paso 3: Verificar que tailwindcss esté en node_modules
if [ -d "node_modules/tailwindcss" ]; then
    echo "[✅] tailwindcss encontrado en node_modules"
else
    echo "[❌] tailwindcss no encontrado en node_modules"
    exit 1
fi

# Paso 4: Verificar que SOLO tailwindcss esté en devDependencies
DEPS=$(node -p "Object.keys(require('./package.json').devDependencies || {}).join(', ')")
if [[ "$DEPS" == *"tailwindcss"* ]] && [[ $(echo $DEPS | wc -w) -eq 1 ]]; then
    echo "[✅] node_modules contiene SOLO tailwindcss como devDependency"
else
    echo "[❌] node_modules contiene otras dependencias además de tailwindcss: $DEPS"
    exit 1
fi

# Paso 5: Ejecutar npm run build
echo "🔨 Ejecutando npm run build..."
BUILD_OUTPUT=$(npm run build 2>&1)
BUILD_EXIT_CODE=$?
if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "[✅] npm run build completado exitosamente"
else
    echo "[❌] npm run build falló:"
    echo "$BUILD_OUTPUT"
    exit 1
fi

# Paso 6: Verificar que dist/output.css existe
if [ -f "dist/output.css" ]; then
    echo "[✅] dist/output.css generado correctamente"
else
    echo "[❌] dist/output.css no fue generado"
    exit 1
fi

# Paso 7: Verificar que dist/output.css tiene contenido
CSS_SIZE=$(stat -c %s dist/output.css)
if [ $CSS_SIZE -gt 0 ]; then
    echo "[✅] dist/output.css tiene contenido (tamaño: ${CSS_SIZE} bytes)"
else
    echo "[❌] dist/output.css está vacío"
    exit 1
fi

# Paso 8: Verificar que no contenga strings sospechosos
SUSPICIOUS_COUNT=$(grep -c -i "@import url\|cdn\|googleapis\|unpkg" dist/output.css || true)
if [ $SUSPICIOUS_COUNT -eq 0 ]; then
    echo "[✅] dist/output.css no contiene strings sospechosos"
else
    echo "[❌] dist/output.css contiene $SUSPICIOUS_COUNT strings sospechosos"
    grep -i "@import url\|cdn\|googleapis\|unpkg" dist/output.css
    exit 1
fi

echo ""
echo "🎉 Validación completada exitosamente!"
echo "Todo está configurado correctamente para Hammock AI Site."