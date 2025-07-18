import { FastifyReply, FastifyRequest } from "fastify";
import jwt from 'jsonwebtoken';
import { prisma } from "../utils/prisma";

export async function authenticateJWT(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers['authorization'];

  if (!authHeader) {
    reply.status(401).send({
      sucesso: false,
      mensagem: 'Header Authorization ausente.',
    });
    return;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    reply.status(401).send({
      sucesso: false,
      mensagem: 'Formato do token inválido. Use "Bearer <token>".',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as unknown as {
      telefone: string;
      exp: number;
    };

    const usuario = await prisma.usuario.findUnique({
      where: { telefone: decoded.telefone }
    });

    if (!usuario) {
      return reply.status(404).send({
        sucesso: false,
        mensagem: 'Usuário associado ao token não encontrado.',
      });
    }

    request.userPayload = decoded;

  } catch (error) {
    console.error("Erro na validação do JWT:", error);

    if (error instanceof jwt.JsonWebTokenError) {
      reply.status(401).send({
        sucesso: false,
        mensagem: 'Token inválido.',
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      reply.status(401).send({
        sucesso: false,
        mensagem: 'Token expirado.',
      });
    } else {
      reply.status(500).send({
        sucesso: false,
        mensagem: 'Erro interno na validação do token.',
      });
    }

    return;
  }
}