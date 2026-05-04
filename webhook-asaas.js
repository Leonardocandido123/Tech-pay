// netlify/functions/webhook-asaas.js

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { event: tipo, payment } = payload;

    console.log("📩 Webhook recebido:", tipo, payment?.id);

    if (!payment || !payment.id) {
      throw new Error("Pagamento inválido");
    }

    // 🔒 EVITA DUPLICIDADE
    const logRef = db.collection("logs_pagamentos").doc(payment.id);
    const logSnap = await logRef.get();

    if (logSnap.exists) {
      console.log("⚠️ Pagamento já processado:", payment.id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ duplicado: true })
      };
    }

    // 🔎 BUSCAR USUÁRIO PELO METADATA (ESSENCIAL)
    const userId = payment.externalReference; // você deve enviar isso ao criar cobrança

    if (!userId) {
      throw new Error("Usuário não identificado no pagamento");
    }

    const userRef = db.collection("usuarios").doc(userId);

    switch (tipo) {

      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':

        const valor = Number(payment.value);

        console.log("💰 Pagamento confirmado:", valor);

        // 🔥 ATUALIZA SALDO
        await userRef.update({
          saldo: admin.firestore.FieldValue.increment(valor)
        });

        // 🧾 LOG DA TRANSAÇÃO
        await db.collection("usuarios")
          .doc(userId)
          .collection("transacoes")
          .add({
            tipo: "entrada",
            valor,
            descricao: "Recebimento via Pix",
            status: "confirmado",
            txid: payment.id,
            criadoEm: admin.firestore.FieldValue.serverTimestamp()
          });

        // 🧠 LOG GLOBAL (antifraude)
        await logRef.set({
          userId,
          valor,
          tipo,
          criadoEm: admin.firestore.FieldValue.serverTimestamp()
        });

        break;

      case 'TRANSFER_DONE':
        console.log("💸 Transferência concluída");
        break;

      case 'TRANSFER_FAILED':
        console.log("❌ Transferência falhou");
        break;

      default:
        console.log("Evento ignorado:", tipo);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true })
    };

  } catch (err) {
    console.error("❌ Erro webhook:", err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ erro: err.message })
    };
  }
};
