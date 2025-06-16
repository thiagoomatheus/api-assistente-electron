import { z } from "zod";
import { FastifyTypedInstance } from "./types";
import jwt from "jsonwebtoken";
import { prisma } from "./utils/prisma";
import { differenceInSeconds } from "date-fns";
import { authenticateJWT } from "./hooks/auth";
import { ContentListUnion, GenerateContentConfig, GoogleGenAI, Type } from "@google/genai";

export default async function routes(app: FastifyTypedInstance) {

    app.post("/auth/request-otp", {
        schema: {
            tags: ['Autenticação'],
            description: 'Envia um código de 6 dígitos via WhatsApp no número cadastrado.',
            body: z.object({
                telefone: z.string()
            }),
            response: {
                200: z.object({
                    mensagem: z.string()
                }),
                400: z.object({
                    mensagem: z.string()
                }),
                500: z.object({
                    mensagem: z.string()
                })
            }
        }
    }, async (req, reply) => {

        const { telefone } = req.body;

        if (!telefone) {
            return reply.status(400).send({ mensagem: 'Número de telefone é obrigatório.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const expiraEm = new Date(Date.now() + 5 * 60 * 1000);

        try {
            await prisma.otp.upsert({
                where: {
                    telefone: telefone
                },
                update: {
                    codigo: otp,
                    expiraEm: expiraEm,
                    ultimaTentativa: new Date()
                },
                create: {
                    telefone: telefone,
                    codigo: otp,
                    expiraEm: expiraEm,
                    ultimaTentativa: new Date()
                }
            });

            const message = `Seu código de autenticação é: *${otp}*`;
            const headers = {
                'Content-Type': 'application/json',
                'apiKey': process.env.EVOLUTION_API_KEY!,
            };
            const data = {
                number: telefone,
                textMessage: {
                    text: message,
                },
            };

            await fetch(`${process.env.EVOLUTION_API_URL!}/message/sendText/${process.env.INSTANCIA_EVO}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data),
            })

            return reply.send({ mensagem: 'Código OTP enviado para o seu WhatsApp.' });

        } catch (error) {
            app.log.error('Erro ao solicitar OTP:', error);
            return reply.status(500).send({ mensagem: 'Erro interno ao solicitar OTP.' });
        }
    })

    app.post('/auth/verify-otp', {
        schema: {
            tags: ['Autenticação'],
            description: 'Verifica o código OTP.',
            body: z.object({
                telefone: z.string(),
                codigo: z.string()
            }),
            response: {
                200: z.object({
                    token: z.string(),
                    expiraEm: z.number(),
                    mensagem: z.string()
                }),
                400: z.object({
                    mensagem: z.string()
                }),
                500: z.object({
                    mensagem: z.string()
                })
            }
        }
    }, async (req, reply) => {

        const MAX_TENTATIVAS = 3
        const TEMPO_ESPERA = 60

        const { telefone, codigo } = req.body

        if (!telefone || !codigo) {
            return reply.status(400).send({ mensagem: 'Número de telefone e código são obrigatórios.' });
        }

        try {
            const otpDB = await prisma.$transaction(async (prisma) => {
                const otp = await prisma.otp.findUnique({
                    where: { telefone }
                });

                if (!otp) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return null;
                }

                if (otp.codigo !== codigo) {
                    await prisma.otp.update({
                        where: { id: otp.id },
                        data: { 
                            tentativas: { increment: 1 },
                            ultimaTentativa: new Date() 
                        }
                    });
                }

                return otp;
            });

            if (!otpDB) {
                return reply.status(400).send({ mensagem: 'Código OTP inválido.' });
            }

            if (otpDB.tentativas >= MAX_TENTATIVAS) {
                return reply.status(400).send({ mensagem: 'Tentativas excedidas. Gere outro código e tente novamente!' });
            }

            if (differenceInSeconds(new Date(), otpDB.ultimaTentativa) < TEMPO_ESPERA) {
                return reply.status(400).send({ mensagem: 'Você precisa esperar 60 segundos para gerar um novo código OTP.' });
            }

            if (otpDB.foiUsado) {
                return reply.status(400).send({ mensagem: 'Código OTP já utilizado.' });
            }

            if (new Date() > otpDB.expiraEm) {
                return reply.status(400).send({ mensagem: 'Código OTP expirado.' });
            }

            await prisma.otp.update({
                where: { id: otpDB.id },
                data: { foiUsado: true, tentativas: otpDB.tentativas + 1 },
            });

            const payload = {
                telefone: telefone,
            }

            if (!process.env.JWT_SECRET) {
                throw new Error('JWT_SECRET não definida');
            }

            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn:  1800 });

            return reply.status(200).send({
                token: token,
                expiraEm: 1800,
                mensagem: 'Código OTP verificado com sucesso.'
            });

        } catch (error) {
            app.log.error('Erro ao verificar OTP:', error);
            return reply.status(500).send({ mensagem: 'Erro interno ao verificar OTP.' });
        }
    })

    app.post('/cronograma', {
        preHandler: [authenticateJWT],
        schema: {
            tags: ['Cronograma'],
            description: 'Envia cronograma a IA e retorna dados necessários para o front-end.',
            body: z.object({
                token: z.string(),
                cronograma: z.string(),
                materias: z.array(z.object({
                    materia: z.string(),
                    habilidades: z.array(z.string())
                }))
            }),
            response: {
                200: z.object({
                    mensagem: z.string(),
                    dados: z.array(z.object({
                        dia: z.string(),
                        horario: z.string(),
                        descricao: z.string()
                    }))
                }),
                500: z.object({
                    mensagem: z.string()
                })
            }
        }
    }, async (req, reply) => {
        const { cronograma, materias } = req.body

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const config: GenerateContentConfig = {
            responseMimeType: 'application/json',
            thinkingConfig: {
            thinkingBudget: 8000,
        },
        systemInstruction: [
            {
            text: `Você é um(a) assistente experiente no preenchimento de diários de classe, com foco na identificação precisa de habilidades do Currículo Paulista a partir da descrição das aulas. Sua tarefa é analisar um cronograma semanal em PDF, consolidar as informações por dia e matéria, extrair os dados relevantes para o diário de classe e omitir da saída os dias que não possuírem aulas de Componentes Curriculares válidos.
Tarefa:
Irei fornecer a você duas informações essenciais:
Cronograma de Aulas em PDF: Este documento possui múltiplas páginas e detalha a rotina de aulas por dia, matéria e período ("Aula 1", "Aula 2", etc.) para um período específico (geralmente de segunda a sexta-feira).
Lista de Habilidades do Currículo Paulista: Uma lista de códigos de habilidades que você deverá usar para comparar com a descrição das aulas e selecionar as mais relevantes.
Analise o cronograma em PDF cobrindo todo o período apresentado (segunda a sexta-feira). Para cada dia desse período, identifique todas as aulas de todas as matérias.
Ignore quaisquer aulas das matérias "EPA" e "Educação Física".
Ignore também atividades de "Acolhida/Rotina" que não apresentem um Componente Curricular associado com descrição de conteúdo.
Para as matérias restantes (que não sejam EPA ou Educação Física), agrupe as informações de todas as aulas da mesma matéria que acontecem naquele dia específico em uma única entrada.
Se, após a exclusão das aulas de EPA, Educação Física e atividades de rotina, um determinado dia não apresentar nenhuma aula de Componente Curricular com descrição de conteúdo, OMITE ESTE DIA COMPLETAMENTE da resposta final.
Para cada grupo consolidado (matéria em um dia específico, apenas para os dias que não foram omitidos), preencha os seguintes campos do diário de classe:
Dia: A data da aula (DD/MM/AAAA).
Matéria: O nome da matéria (exceto EPA e Educação Física) que teve aula(s) neste dia.
Descrição da Aula: Consolide os resumos das atividades realizadas em todos os períodos desta matéria naquele dia. Mencione páginas de livros didáticos utilizados, materiais de apoio (se houver), e os principais tópicos abordados para aquela matéria naquele dia.
Habilidades: Com base na descrição consolidada da aula para esta matéria neste dia, selecione os códigos de habilidades do Currículo Paulista (fornecidos na lista) que melhor se encaixam nas atividades realizadas. Seja preciso(a) na seleção, priorizando as habilidades que foram efetivamente trabalhadas.
Instruções Adicionais:
Análise Semanal Completa: Percorra o cronograma dia a dia (segunda a sexta) e consolide as informações conforme especificado.
Priorize a Precisão: Identifique corretamente todas as aulas para consolidação, respeitando as exclusões.
Excluir Matérias Específicas: Não inclua nenhuma entrada para aulas das matérias 'EPA' e 'Educação Física'.
Omitir Dias Sem Conteúdo Válido: Se um dia, após filtragem, não tiver nenhuma aula de Componente Curricular com descrição de conteúdo, não crie NENHUMA entrada para esse dia na saída.
Consolidar Aulas: Se uma matéria aparecer em múltiplos períodos no mesmo dia, combine suas descrições e habilidades em uma única entrada para aquele dia.
Remover Campo: Não inclua o campo 'Período da Aula' na saída.
Considere o Contexto: Leve em conta o nível de ensino e as características da turma ao selecionar as habilidades.
Analise Todas as Páginas: O cronograma tem mais de uma página; analise todas.
Mantenha a Coerência: As habilidades selecionadas para a entrada consolidada devem refletir todas as atividades descritas para aquela matéria naquele dia.
Selecione apenas os códigos fornecidos: Não invente ou sugira códigos de habilidades que não estejam na lista fornecida.
Currículo Paulista: As habilidades a serem selecionadas são do Currículo Paulista, e não da BNCC.
Formato de Resposta:
Apresente a resposta em um formato organizado (como uma lista de objetos JSON ou similar) que contenha uma entrada para cada matéria (exceto EPA e Educação Física) em cada dia da semana EM QUE HOUVE AULA VÁLIDA. A lista deve estar ordenada cronologicamente por dia. Também, no campo matéria utilize os nomes das matérias em letra maiúscula e sem acentos.

Preparação:
Aguarde o envio do cronograma em PDF e a lista de habilidades do Currículo Paulista para iniciar a análise.`,
                }
            ],
            responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                dia: { type: Type.STRING },
                materia: { type: Type.STRING },
                descricao: { type: Type.STRING },
                habilidades: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
            }
            }
        };

        const model = 'gemini-2.5-flash-preview-05-20';
        const contents: ContentListUnion = [
            {
            role: 'user',
            parts: [
                {
                    text: JSON.stringify(materias),
                },
                {
                    inlineData: {
                        mimeType: 'application/pdf',
                        data: cronograma,
                    }
                }
            ],
            },
        ];

        const response = await ai.models.generateContent({
            model,
            config,
            contents,
        });

        if (!response.text) {
            return reply.status(500).send({
                mensagem: "Erro ao obter resposta",
            });
        }

        return reply.status(200).send({
            mensagem: "Resposta obtida com sucesso",
            dados: JSON.parse(response.text)
        });
    });
}