// netlify/functions/criar-cliente-asaas.js

const admin = require("firebase-admin");

// Inicializa Firebase Admin apenas uma vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    )
  });
}

const db = admin.firestore();

// Configuração do Asaas
const ASAAS_BASE_URL =
  process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

const ASAAS_KEY = process.env.ASAAS_KEY;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // Pré-flight CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  // Apenas POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        erro: "Método não permitido"
      })
    };
  }

  try {
    // Verifica variável de ambiente
    if (!ASAAS_KEY) {
      throw new Error("ASAAS_KEY não configurada");
    }

    // Dados recebidos
    const {
      uid,
      nome,
      email,
      cpfCnpj,
      telefone
    } = JSON.parse(event.body || "{}");

    // Validações
    if (!uid) throw new Error("UID não informado");
    if (!nome) throw new Error("Nome não informado");
    if (!email) throw new Error("E-mail não informado");
    if (!cpfCnpj) throw new Error("CPF/CNPJ não informado");

    // Verifica se usuário existe no Firestore
    const userRef = db.collection("usuarios").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new Error("Usuário não encontrado");
    }

    const dadosUsuario = userSnap.data();

    // Se já possui customer criado, retorna o existente
    if (dadosUsuario.asaasCustomerId) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          customerId: dadosUsuario.asaasCustomerId,
          jaExistia: true
        })
      };
    }

    // Cria cliente no Asaas
    const resposta = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_KEY
      },
      body: JSON.stringify({
        name: nome,
        email: email,
        cpfCnpj: cpfCnpj.replace(/\D/g, ""),
        phone: telefone ? telefone.replace(/\D/g, "") : null,
        notificationDisabled: false,
        externalReference: uid
      })
    });

    const asaasData = await resposta.json();

    // Verifica erro
    if (!resposta.ok || !asaasData.id) {
      console.error("Erro Asaas:", asaasData);
      throw new Error(
        asaasData?.errors?.[0]?.description ||
        "Erro ao criar cliente no Asaas"
      );
    }

    // Salva customerId no Firestore
    await userRef.update({
      asaasCustomerId: asaasData.id,
      asaasCriadoEm: admin.firestore.FieldValue.serverTimestamp()
    });

    // Retorno
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        customerId: asaasData.id,
        jaExistia: false
      })
    };

  } catch (err) {
    console.error("Erro criar-cliente-asaas:", err);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        erro: err.message
      })
    };
  }
};
