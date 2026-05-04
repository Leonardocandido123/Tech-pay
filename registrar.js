const bcrypt = require("bcryptjs");

exports.handler = async (event) => {
  const { email, senha } = JSON.parse(event.body);

  const senhaHash = await bcrypt.hash(senha, 10);

  // salva no banco (Firestore ou outro)
  // 👉 IMPORTANTE: salvar senhaHash, NÃO senha pura

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  };
};
