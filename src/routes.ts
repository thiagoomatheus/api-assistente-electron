import { z } from "zod";
import { AsaasClient, FastifyTypedInstance } from "./types";
import jwt from "jsonwebtoken";
import { prisma } from "./utils/prisma";
import { differenceInSeconds } from "date-fns";
import { authenticateJWT } from "./hooks/auth";
import { ContentListUnion, GenerateContentConfig, GoogleGenAI, Type } from "@google/genai";

export default async function routes(app: FastifyTypedInstance) {

    app.get('/', {
        schema: {
            tags: ['Geral'],
            description: 'Rota de teste para verificar se a API está no ar.',
            response: {
                200: z.object({
                    mensagem: z.string()
                })
            }
        }
    }, async (req, reply) => {
        return reply.status(200).send({ mensagem: 'On' });
    });

    app.post('/webhooks', async (req, reply) => {

        const url = req.url;

        console.log(`Iniciando rota ${url}`);

        const webhook:any = req.body;

        console.log(webhook.event);
        
        if (process.env.WEBHOOK_ACTIVE !== 'true') {
            console.log('Webhook desativado');
            return reply.status(200).send('Webhook desativado');
        }

        if (!webhook) {
            console.log('Body ausente');
            return reply.status(200).send('Body ausente');
        }

        if (!webhook.event) {
            console.log('Event ausente');
            return reply.status(200).send('Event ausente');
        }

        if (!webhook.payment.customer) {
            console.log('Customer ausente');
            return reply.status(200).send('Customer ausente');
        }

        let usuario = await prisma.usuario.findFirst({
            where: {
                customerId: webhook.payment.customer
            }
        })

        const marcarPago = async () => {
            await prisma.usuario.update({
                where: {
                    id: usuario!.id
                },
                data: {
                    estaPago: true
                }
            })
        }

        const marcarNaoPago = async () => {
            await prisma.usuario.update({
                where: {
                    id: usuario!.id
                },
                data: {
                    estaPago: false
                }
            })
        }

        const criarUsuario = async () => {
            const usuarioAsaas = await fetch(`${process.env.ASAAS_API_URL}/v3/customers/${webhook.payment.customer}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
                    'access_token': `${process.env.ASAAS_API_KEY}`
                }
            })

            const usuarioAsaasJson: AsaasClient = await usuarioAsaas.json();

            usuario = await prisma.usuario.create({
                data: {
                    telefone: usuarioAsaasJson.mobilePhone,
                    customerId: webhook.payment.customer,
                    estaPago: true
                }
            })
        }

        switch (webhook.event) {
            case 'PAYMENT_RECEIVED': {

                if (webhook.payment.billingType === "CREDIT_CARD") {
                    console.log('Recebido compra com cartão');
                    return reply.status(200).send('Webhook recebido com sucesso.');
                }

                if (!usuario) {
                    criarUsuario();
                }

                await marcarPago();
                
                console.log('Recebido compra com boleto ou pix');

                break;
            }
            case 'PAYMENT_CONFIRMED': {

                if (webhook.payment.billingType !== "CREDIT_CARD") {
                    console.log('Confirmado compra com boleto ou pix');
                    return reply.status(200).send('Webhook recebido com sucesso.');
                }

                if (!usuario) {
                    await criarUsuario();
                }
                
                await marcarPago();
                
                console.log('Confirmado compra com cartão');
                
                break;
            }
            case 'PAYMENT_OVERDUE': {

                if (!usuario) {
                    console.log('Usuário inexistente');
                    return reply.status(200).send('Webhook recebido com sucesso.');
                };
                
                await marcarNaoPago();
                
                console.log('Cobrança vencido');

                break;
            }
            case 'PAYMENT_REFUNDED': {

                if (!usuario) {
                    console.log('Usuário inexistente');
                    return reply.status(200).send('Webhook recebido com sucesso.');
                }

                await marcarNaoPago();

                console.log('Reembolso realizado');

                break;
            }
            case 'SUBSCRIPTION_INACTIVATED': {

                if (!usuario) {
                    console.log('Usuário inexistente');
                    return reply.status(200).send('Webhook recebido com sucesso.');
                }

                await marcarNaoPago();

                console.log('Assinatura inativa');

                break;
            }
            case 'SUBSCRIPTION_DELETED': {

                if (!usuario) {
                    console.log('Usuário inexistente');
                    return reply.status(200).send('Webhook recebido com sucesso.');
                }

                await prisma.usuario.delete({
                    where: {
                        id: usuario.id
                    }
                })

                await fetch(`${process.env.ASAAS_API_URL}/v3/customers/${webhook.payment.customer}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
                        'access_token': `${process.env.ASAAS_API_KEY}`
                    }
                })

                console.log('Assinatura cancelada');

                break;
            
            }
            default:
                console.log(`Evento desconhecido: ${webhook.event}`);
                return reply.status(200).send('Webhook não configurado.');
        }

        return reply.status(200).send('Webhook recebido com sucesso.');
    })

    app.post('/admin/users', {
        schema: {
            tags: ['Admin'],
            description: 'Cria um novo usuário.',
            body: z.object({
                telefone: z.string(),
                estaPago: z.boolean(),
                customerId: z.string(),
                adminApiKey: z.string(),
            }),
            response: {
                201: z.object({
                sucesso: z.boolean(),
                mensagem: z.string(),
                }),
                400: z.object({
                sucesso: z.boolean(),
                mensagem: z.string(),
                }),
                500: z.object({
                sucesso: z.boolean(),
                mensagem: z.string(),
                }),
            },
        },
    }, async (req, reply) => {

        const url = req.url;

        console.log(`Iniciando rota ${url}`);

        if (process.env.ADMIN_ACTIVE !== 'true') {
            console.error('Admin desativado');
            return reply.status(500).send({
                sucesso: false,
                mensagem: 'Admin desativado.',
            });
        }
        const { telefone, estaPago, adminApiKey, customerId } = req.body;

        if (!telefone) {
            console.error('Telefone e login obrigatórios.');
            return reply.status(400).send({
                sucesso: false,
                mensagem: 'Telefone e login obrigatórios.',
            });
        }

        if (adminApiKey !== process.env.ADMIN_API_KEY) {
            console.error('Chave de admin inválida.');
            return reply.status(400).send({
                sucesso: false,
                mensagem: 'Chave de admin inválida.',
            });
        }

        try {
            await prisma.usuario.create({
                data: {
                    customerId: customerId,
                    telefone: telefone,
                    estaPago: estaPago
                },
            });

            console.log('Usuário criado com sucesso.');

            return reply.status(201).send({
                sucesso: true,
                mensagem: 'Usuário criado com sucesso.',
            });
        } catch (error) {
            console.error('Erro ao criar usuário: ' + error);
            return reply.status(500).send({
                sucesso: false,
                mensagem: 'Erro no servidor ao criar usuário',
            });
        }
    });

    app.post("/auth/request-otp", {
        schema: {
            tags: ['Autenticação'],
            description: 'Envia um código de 6 dígitos via WhatsApp no número cadastrado.',
            body: z.object({
                telefone: z.string()
            }),
            response: {
                201: z.object({
                    mensagem: z.string()
                }),
                400: z.object({
                    mensagem: z.string()
                }),
                403: z.object({
                    mensagem: z.string()
                }),
                404: z.object({
                    mensagem: z.string()
                }),
                500: z.object({
                    mensagem: z.string()
                })
            }
        }
    }, async (req, reply) => {

        const url = req.url;

        console.log(`Iniciando rota ${url}`);
        
        const { telefone } = req.body;

        if (!telefone) {
            console.log('Número de telefone é obrigatório.');
            return reply.status(400).send({ mensagem: 'Número de telefone é obrigatório.' });
        }

        console.log('Verificando usuário');

        const usuario = await prisma.usuario.findUnique({
            where: {
                telefone: telefone
            },
            include: {
                otp: true
            }
        });

        if (!usuario) {
            console.log('Usuário não cadastrado!')
            return reply.status(404).send({ mensagem: 'Usuário não cadastrado!' });
        };

        
        if (usuario.otp) {
            console.log('Verificando permissão para envio de OTP');
            
            const TEMPO_ESPERA = 60;

            if (differenceInSeconds(new Date(), usuario.otp.criadoEm) < TEMPO_ESPERA) {
                console.error('Você precisa esperar 60 segundos para gerar um novo código.');
                return reply.status(403).send({ mensagem: 'Você precisa esperar 60 segundos para gerar um novo código.' });
            }
        }

        console.log('Gerando código OTP');

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const expiraEm = new Date(Date.now() + 5 * 60 * 1000);

        console.log('Inserindo otp no banco de dados')

        try {
            await prisma.otp.upsert({
                where: {
                    telefone: telefone
                },
                update: {
                    codigo: otp,
                    expiraEm: expiraEm,
                    criadoEm: new Date(),
                    foiUsado: false,
                    tentativas: 0
                },
                create: {
                    telefone: telefone,
                    codigo: otp,
                    expiraEm: expiraEm,
                    criadoEm: new Date(),
                    foiUsado: false,
                    tentativas: 0
                }
            });

            const message = `Seu código de autenticação é: *${otp}*`;
            const headers = {
                'Content-Type': 'application/json',
                'apikey': process.env.EVOLUTION_API_KEY!,
            };
            const data = {
                number: `+55${telefone}`,
                text: message,
            };

            console.log(`Enviando código para celular - ${process.env.EVOLUTION_API_URL!}/message/sendText/${process.env.INSTANCIA_EVO}`)

            try {
                const resultado = await fetch(`${process.env.EVOLUTION_API_URL!}/message/sendText/${process.env.INSTANCIA_EVO}`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(data),
                })

                if (!resultado.ok) {
                    const resultadoJson = await resultado.json();
                    throw new Error(`${resultadoJson.response.message}`);
                }
    
                console.log('Código OTP enviado para o seu WhatsApp.')
                return reply.status(201).send({ mensagem: 'Código OTP enviado para o seu WhatsApp.' });
            } catch (error) {
                throw new Error(`${error}`);
            }


        } catch (error) {
            console.error('Erro ao solicitar OTP:', error);
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
                403: z.object({
                    mensagem: z.string()
                }),
                404: z.object({
                    mensagem: z.string()
                }),
                500: z.object({
                    mensagem: z.string()
                })
            }
        }
    }, async (req, reply) => {

        const url = req.url;

        console.log(`Iniciando rota ${url}`);

        const MAX_TENTATIVAS = 3
        const TEMPO_ESPERA = 60

        const { telefone, codigo } = req.body

        console.log(`Numero de telefone: ${telefone}`)

        if (!telefone || !codigo) {
            console.warn('Número de telefone e código obrigatórios.');
            return reply.status(400).send({ mensagem: 'Número de telefone e código são obrigatórios.' });
        }

        console.log('Verificando OTP no banco de dados')

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
                console.error('OTP não cadastrado no banco de dados.');
                return reply.status(404).send({ mensagem: 'Código OTP inválido.' });
            }

            if (otpDB?.codigo  !== codigo) {
                console.error('Código informado não confere com o banco de dados.');
                return reply.status(404).send({ mensagem: 'Código OTP inválido.' });
            }
            
            if (otpDB.tentativas >= MAX_TENTATIVAS) {
                console.error('Número máximo de tentativas foi excedido: ' + MAX_TENTATIVAS);
                return reply.status(403).send({ mensagem: 'Tentativas excedidas. Gere outro código e tente novamente!' });
            }

            if (otpDB.ultimaTentativa && (differenceInSeconds(new Date(), otpDB.ultimaTentativa) < TEMPO_ESPERA)) {
                console.error('Código OTP gerado em tempo menos do que o esperado:' + TEMPO_ESPERA + 'segundos.');
                return reply.status(403).send({ mensagem: 'Você precisa esperar 60 segundos para tentar novamente.' });
            }

            if (otpDB.codigo === codigo && otpDB.foiUsado) {
                console.error('Código OTP ja utilizado.');
                return reply.status(401).send({ mensagem: 'Código OTP já utilizado.' });
            }

            if (new Date() > otpDB.expiraEm) {
                console.error('Código OTP expirado.');
                return reply.status(403).send({ mensagem: 'Código OTP expirado.' });
            }

            console.log('Atualizando OTP no banco de dados')

            await prisma.otp.update({
                where: { id: otpDB.id },
                data: { foiUsado: true, tentativas: 0 },
            });

            console.log(`Código OTP verificado com sucesso para o telefone ${telefone}.`);

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
            console.error('Erro ao verificar OTP:', error);
            return reply.status(500).send({ mensagem: 'Erro interno ao verificar OTP.' });
        }
    })

    app.post('/cronograma', {
        preHandler: [authenticateJWT],
        schema: {
            tags: ['Cronograma'],
            description: 'Envia cronograma a IA e retorna dados necessários para o front-end.',
            body: z.object({
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
                        materia: z.string(),
                        descricao: z.string(),
                        habilidades: z.array(z.string())
                    }))
                }),
                500: z.object({
                    mensagem: z.string()
                })
            }
        }
    }, async (req, reply) => {

        const url = req.url;

        console.log(`Iniciando rota ${url}`);

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

        console.log('Enviar para IA');

        const response = await ai.models.generateContent({
            model,
            config,
            contents,
        });

        if (!response.text) {
            console.log('Resposta vazia');
            return reply.status(500).send({
                mensagem: "Erro ao obter resposta",
            });
        }

        console.log('Resposta obtida');
        
        return reply.status(200).send({
            mensagem: "Resposta obtida com sucesso",
            dados: JSON.parse(response.text)
        });
    });
}