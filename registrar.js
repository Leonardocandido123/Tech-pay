const bcrypt = require("bcryptjs");
const { db } = require("./firebase"); // ajusta o caminho

exports.handler = async (event) => {
  try {
    const { email, senha } = JSON.parse(event.body);

    if (!email || !senha) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Dados incompletos" })
      };
    }

    // 🔐 gera hash
    const senhaHash = await bcrypt.hash(senha, 10);

    // 💾 salva no Firestore
    const docRef = await db.collection("usuarios").add({
      email: email,
      senha: senhaHash,
      criadoEm: new Date()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        id: docRef.id
      })
    };

  } catch (err) {
    console.error("Erro ao registrar:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "erro-interno" })
    };
  }
};
