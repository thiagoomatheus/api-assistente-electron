# api-assistente-electron

Desenvolvida com **TypeScript**, esta API robusta e modular integra funcionalidades de gerenciamento de usuários, autenticação segura via WhatsApp, processamento de webhooks de pagamentos (Asaas) e uma poderosa integração com Inteligência Artificial (Google Gemini) para auxiliar no preenchimento de diários de classe, otimizando o fluxo de trabalho educacional com maior segurança e manutenibilidade.

## ✨ Funcionalidades

*   **Gerenciamento de Webhooks Asaas**:
    *   Recebe e processa eventos de pagamentos (recebidos, confirmados, vencidos, reembolsados).
    *   Atualiza o status de pagamento (`estaPago`) de usuários no banco de dados.
    *   Cria automaticamente novos usuários no sistema quando um `customerId` do Asaas é detectado pela primeira vez, associando-os aos seus dados de contato.
    *   Desativa ou deleta usuários do sistema em caso de cancelamento ou exclusão de assinaturas no Asaas, mantendo a base de dados sincronizada.
*   **Autenticação Segura (OTP via WhatsApp)**:
    *   Endpoint dedicado para solicitar um código de autenticação de uso único (OTP) de 6 dígitos, que é enviado diretamente para o número de WhatsApp cadastrado do usuário.
    *   Implementa um mecanismo de `cooldown` para evitar o envio excessivo de solicitações de OTP, prevenindo spam e otimizando recursos.
    *   Endpoint para verificar o OTP fornecido, com limites de tentativas e validação de expiração, garantindo a segurança do processo.
    *   Gera um JSON Web Token (JWT) após a verificação bem-sucedida, que é utilizado para autenticar requisições futuras à API.
*   **Gerenciamento de Usuários (Admin)**:
    *   Endpoint protegido por uma chave de API secreta (`adminApiKey`) para a criação manual e controlada de novos usuários no sistema.
    *   Ideal para administração interna, testes ou integração inicial com outras plataformas.
*   **Processamento de Cronogramas com IA (Google Gemini)**:
    *   Endpoint autenticado via JWT que recebe um cronograma de aulas em formato PDF (codificado em Base64) e uma lista estruturada de matérias com suas respectivas habilidades do Currículo Paulista.
    *   Utiliza a inteligência artificial do Google Gemini para analisar o conteúdo do PDF, consolidar as informações de aulas por dia e matéria.
    *   Extrai descrições detalhadas das aulas e seleciona as habilidades do Currículo Paulista mais relevantes e aplicáveis com base no conteúdo didático descrito no cronograma.
    *   Filtra e omite automaticamente aulas de matérias específicas ("EPA", "Educação Física") e dias que não apresentam conteúdo curricular válido, garantindo que apenas informações relevantes sejam processadas.
    *   Retorna dados estruturados e organizados, prontos para serem integrados e utilizados no preenchimento de diários de classe em aplicações front-end.

## 🛠️ Tecnologias Utilizadas

*   **TypeScript**: Superconjunto tipado do JavaScript que oferece segurança de tipo e escalabilidade.
*   **Node.js**: Ambiente de execução JavaScript assíncrono e de alto desempenho.
*   **Fastify**: Framework web rápido e de baixo overhead para Node.js.
*   **Prisma**: ORM moderno, tipado e de próxima geração para bancos de dados.
*   **PostgreSQL**: Banco de dados relacional robusto e extensível.
*   **Zod**: Biblioteca de declaração e validação de schema **TypeScript-first**, garantindo segurança de tipo e validação em tempo de execução.
*   **jsonwebtoken**: Implementação de JSON Web Tokens para autenticação segura.
*   **@google/genai**: SDK oficial para integração com a API Google Gemini (IA).
*   **date-fns**: Biblioteca utilitária para manipulação de datas no JavaScript.
*   **Asaas API**: Integração para gestão de pagamentos e assinaturas.
*   **Evolution API**: Gateway para envio de mensagens via WhatsApp.
*   **Docker**: Plataforma de containerização para empacotar e isolar o ambiente da aplicação, garantindo portabilidade e consistência.
*   **Docker Compose**: Ferramenta para definir e executar aplicações Docker multi-container, simplificando a orquestração de serviços como a API e o banco de dados.

## 📄 Pré-requisitos

Antes de iniciar o projeto, certifique-se de ter os seguintes itens instalados e configurados em seu ambiente:

*   **Node.js**: Versão 18 ou superior (apenas se for rodar sem Docker).
*   **npm** ou **Yarn**: Gerenciador de pacotes (apenas se for rodar sem Docker).
*   **Docker e Docker Compose**: Essenciais para rodar a aplicação em contêineres. Geralmente incluídos no Docker Desktop para Windows/macOS, ou instalados separadamente no Linux.
*   Um banco de dados **PostgreSQL** (será provisionado via Docker Compose, mas o cliente `psql` pode ser útil para acesso direto).
*   Credenciais de API para os seguintes serviços:
    *   **Asaas**: URL da API e chave de acesso (`ASAAS_API_URL`, `ASAAS_API_KEY`).
    *   **Google Gemini**: Chave de API (`GEMINI_API_KEY`).
    *   **Evolution API (WhatsApp)**: URL base, chave de API e nome da instância (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `INSTANCIA_EVO`).
*   Uma chave secreta complexa para a assinatura de JWTs: `JWT_SECRET`.
*   Uma chave de API para o acesso administrativo: `ADMIN_API_KEY`.

## ⚙️ Configuração (Variáveis de Ambiente)

Crie um arquivo `.env` na raiz do seu projeto com as seguintes variáveis de ambiente. Preencha-as com suas respectivas credenciais e configurações:

```dotenv
# Configurações do Banco de Dados
# Quando usando Docker Compose, "db" é o nome do serviço do banco de dados
DATABASE_URL="postgresql://user:password@db:5432/database?schema=public"
# Variáveis para o serviço de banco de dados Docker Compose
POSTGRES_USER="user"
POSTGRES_PASSWORD="password"
POSTGRES_DB="database"

# Configurações da API Asaas
ASAAS_API_URL="https://sandbox.asaas.com/api" # Use https://api.asaas.com/api para produção
ASAAS_API_KEY="SUA_CHAVE_ASAAS_AQUI"
WEBHOOK_ACTIVE="true" # Defina como "true" para ativar o processamento de webhooks

# Configurações de Admin
ADMIN_ACTIVE="true" # Defina como "true" para ativar as rotas de admin
ADMIN_API_KEY="SUA_CHAVE_ADMIN_SECRETA_E_FORTE_AQUI" # Chave para acessar as rotas /admin

# Configurações da Evolution API (WhatsApp)
EVOLUTION_API_URL="SEU_URL_BASE_EVOLUTION_API" # Ex: http://localhost:8080
EVOLUTION_API_KEY="SUA_CHAVE_API_EVOLUTION_AQUI"
INSTANCIA_EVO="NOME_DA_SUA_INSTANCIA_EVOLUTION" # Nome da instância configurada no Evolution API

# Configurações do Google Gemini (IA)
GEMINI_API_KEY="SUA_CHAVE_GOOGLE_GEMINI_AQUI"

# Configurações JWT
JWT_SECRET="SEGREDO_SUPER_SECRETO_PARA_ASSINAR_TOKENS_JWT_AQUI" # Uma string longa, complexa e única
```

## 📦 Instalação

Siga os passos abaixo para configurar e instalar o projeto. **Recomenda-se o uso de Docker para garantir um ambiente consistente.**

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/seu-projeto.git
    cd seu-projeto
    ```
2.  **Crie os arquivos Docker:**
    Crie um arquivo `Dockerfile` na raiz do seu projeto com o seguinte conteúdo:
    ```dockerfile
    # Use a imagem oficial do Node.js
    FROM node:18-alpine

    # Define o diretório de trabalho dentro do contêiner
    WORKDIR /usr/src/app

    # Copia os arquivos de package.json e package-lock.json para instalar as dependências
    COPY package*.json ./

    # Instala as dependências do projeto
    RUN npm install

    # Copia o restante do código-fonte da aplicação
    COPY . .

    # Constrói o projeto TypeScript
    RUN npm run build

    # Expõe a porta que a aplicação Fastify irá escutar
    EXPOSE 3000

    # Comando para iniciar a aplicação em produção (executa o JavaScript compilado)
    CMD [ "npm", "start" ]
    ```
    Crie também um arquivo `.dockerignore` na raiz do projeto para evitar copiar arquivos desnecessários para a imagem Docker:
    ```
    node_modules
    dist
    .env
    .git
    .gitignore
    Dockerfile
    docker-compose.yml
    README.md
    npm-debug.log
    ```
    Crie o arquivo `docker-compose.yml` na raiz do seu projeto para definir os serviços da aplicação:
    ```yaml
    version: '3.8'

    services:
      db:
        image: postgres:15-alpine
        restart: always
        environment:
          POSTGRES_USER: ${POSTGRES_USER}
          POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
          POSTGRES_DB: ${POSTGRES_DB}
        volumes:
          - postgres_data:/var/lib/postgresql/data
        ports:
          - "5432:5432" # Opcional: para acessar o banco de dados diretamente da sua máquina
        healthcheck:
          test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
          interval: 5s
          timeout: 5s
          retries: 5

      api:
        build:
          context: .
          dockerfile: Dockerfile
        restart: always
        ports:
          - "3000:3000"
        environment:
          DATABASE_URL: ${DATABASE_URL}
          ASAAS_API_URL: ${ASAAS_API_URL}
          ASAAS_API_KEY: ${ASAAS_API_KEY}
          WEBHOOK_ACTIVE: ${WEBHOOK_ACTIVE}
          ADMIN_ACTIVE: ${ADMIN_ACTIVE}
          ADMIN_API_KEY: ${ADMIN_API_KEY}
          EVOLUTION_API_URL: ${EVOLUTION_API_URL}
          EVOLUTION_API_KEY: ${EVOLUTION_API_KEY}
          INSTANCIA_EVO: ${INSTANCIA_EVO}
          GEMINI_API_KEY: ${GEMINI_API_KEY}
          JWT_SECRET: ${JWT_SECRET}
        depends_on:
          db:
            condition: service_healthy # Garante que o DB esteja saudável antes de iniciar a API
        volumes:
          # Monta o volume para hot-reloading em desenvolvimento. Remova ou ajuste para produção.
          # Nota: Garanta que seu `package.json` tenha um script `dev` que use `ts-node` ou similar
          # para que as mudanças no TypeScript sejam refletidas sem reconstrução completa da imagem.
          - .:/usr/src/app
          - /usr/src/app/node_modules # Impede que node_modules do host sobrescreva o do container

    volumes:
      postgres_data:

    ```
    **Nota:** As variáveis de ambiente no `docker-compose.yml` são carregadas automaticamente do seu arquivo `.env`.

3.  **Construa as imagens Docker:**
    ```bash
    docker compose build
    ```
4.  **Execute as migrações do Prisma no contêiner do banco de dados:**
    Certifique-se de que o serviço `db` esteja rodando ou inicie-o antes de executar as migrações.
    ```bash
    docker compose run --rm api npx prisma migrate dev --name init
    ```
    Para gerar o cliente Prisma (se necessário, após alterações no schema):
    ```bash
    docker compose run --rm api npx prisma generate
    ```

## ▶️ Como Rodar

### Com Docker Compose (Recomendado)

Para iniciar todos os serviços (API e Banco de Dados) usando Docker Compose:

#### Modo de Desenvolvimento (com hot-reloading)

Para rodar a aplicação em modo de desenvolvimento com hot-reloading (ideal para o fluxo de trabalho TypeScript):

```bash
# Inicia os serviços em background
docker compose up -d

# Para entrar no contêiner da API e iniciar o modo de desenvolvimento
# (assumindo que seu package.json tem um script `dev` que usa `ts-node` ou similar)
docker compose exec api npm run dev
```
O volume montado permitirá que as alterações no código TypeScript local sejam refletidas, e o `npm run dev` (se configurado corretamente) fará a recompilação e reinício.

#### Modo de Produção

Para construir as imagens e iniciar a aplicação compilada em segundo plano (detached mode):

```bash
docker compose up --build -d
```
Para parar os serviços:
```bash
docker compose down
```

A API estará disponível em `http://localhost:3000`.

### Sem Docker (Ambiente Local)

Se você não quiser usar Docker e preferir rodar a aplicação diretamente em seu ambiente local (garanta que Node.js e PostgreSQL estejam instalados e configurados manualmente):

1.  **Instale as dependências:**
    ```bash
    npm install
    # ou
    yarn install
    ```
2.  **Configure e migre o banco de dados com Prisma:**
    Certifique-se de que seu banco de dados PostgreSQL esteja rodando e que `DATABASE_URL` no `.env` esteja correto para o seu ambiente local.
    ```bash
    npx prisma migrate dev --name init
    ```
3.  **Inicie o servidor de desenvolvimento:**
    ```bash
    npm run dev # Este comando deve transpilá-lo e rodar a aplicação (ex: com `ts-node-dev`)
    # ou
    yarn dev
    ```
    Para construir e iniciar em produção:
    ```bash
    npm run build # Compila o TypeScript para JavaScript
    npm start     # Inicia a aplicação a partir dos arquivos JavaScript compilados
    # ou
    yarn build
    yarn start
    ```

## 🚀 Endpoints da API

A API utiliza validação de schema `Zod` para os corpos das requisições e respostas, garantindo robustez e tipagem.

### 1. Webhooks

*   **`POST /webhooks`**
    *   **Descrição**: Endpoint para receber e processar notificações de eventos da plataforma Asaas.
    *   **Corpo da Requisição**: JSON contendo os dados do evento de webhook, conforme enviado pela Asaas.
    *   **Respostas**: `200 OK` (a API sempre retorna 200 para a Asaas para indicar recebimento, o processamento interno é logado).
    *   **Observações**: Verifique os logs da aplicação para detalhes sobre o processamento do webhook.

### 2. Admin

*   **`POST /admin/users`**
    *   **Descrição**: Cria um novo usuário no sistema com dados fornecidos. Requer uma chave de API administrativa para acesso.
    *   **Tags**: `Admin`
    *   **Corpo da Requisição**:
        ```json
        {
            "telefone": "5511999999999",
            "estaPago": true,
            "customerId": "cus_XXXXXXXXXXXXXXXX",
            "adminApiKey": "SUA_CHAVE_ADMIN_SECRETA_AQUI"
        }
        ```
    *   **Respostas**:
        *   `201 Created`:
            ```json
            {
                "sucesso": true,
                "mensagem": "Usuário criado com sucesso."
            }
            ```
        *   `400 Bad Request`: Erro de validação dos campos ou `adminApiKey` inválida.
        *   `500 Internal Server Error`: Erro interno no servidor ao tentar criar o usuário.

### 3. Autenticação

*   **`POST /auth/request-otp`**
    *   **Descrição**: Solicita o envio de um código OTP de 6 dígitos para o número de telefone cadastrado via WhatsApp.
    *   **Tags**: `Autenticação`
    *   **Corpo da Requisição**:
        ```json
        {
            "telefone": "5511999999999"
        }
        ```
    *   **Respostas**:
        *   `201 Created`:
            ```json
            {
                "mensagem": "Código OTP enviado para o seu WhatsApp."
            }
            ```
        *   `400 Bad Request`: Número de telefone ausente.
        *   `403 Forbidden`: Cooldown ativo (o usuário precisa esperar 60 segundos) ou tentativas de solicitação excedidas.
        *   `404 Not Found`: Usuário não cadastrado com o telefone fornecido.
        *   `500 Internal Server Error`: Erro interno ao tentar enviar o código OTP via WhatsApp.

*   **`POST /auth/verify-otp`**
    *   **Descrição**: Verifica o código OTP recebido e, se válido, gera um JSON Web Token (JWT) para autenticação futura.
    *   **Tags**: `Autenticação`
    *   **Corpo da Requisição**:
        ```json
        {
            "telefone": "5511999999999",
            "codigo": "123456"
        }
        ```
    *   **Respostas**:
        *   `200 OK`:
            ```json
            {
                "token": "SEU_JSON_WEB_TOKEN_AQUI",
                "expiraEm": 1800, # Tempo de expiração do token em segundos (30 minutos)
                "mensagem": "Código OTP verificado com sucesso."
            }
            ```
        *   `400 Bad Request`: Número de telefone ou código OTP ausentes.
        *   `401 Unauthorized`: Código OTP já utilizado.
        *   `403 Forbidden`: Código inválido, código expirado, ou tentativas de verificação excedidas/cooldown.
        *   `404 Not Found`: Código OTP não encontrado ou associado ao telefone.
        *   `500 Internal Server Error`: Erro interno ao tentar verificar o código OTP.

### 4. Cronograma (IA)

*   **`POST /cronograma`**
    *   **Descrição**: Envia um cronograma em PDF e informações sobre matérias/habilidades para a IA, que processa e retorna dados estruturados para o diário de classe.
    *   **Tags**: `Cronograma`
    *   **Autenticação**: Requer um token JWT válido no cabeçalho `Authorization` (ex: `Authorization: Bearer SEU_JWT`).
    *   **Corpo da Requisição**:
        ```json
        {
            "cronograma": "BASE64_DO_CONTEUDO_DO_PDF_AQUI", # O conteúdo do arquivo PDF codificado em Base64
            "materias": [
                {
                    "materia": "MATEMATICA",
                    "habilidades": ["EF06MA01", "EF06MA02", "EF06MA03"]
                },
                {
                    "materia": "PORTUGUES",
                    "habilidades": ["EF06LP01", "EF06LP02"]
                },
                {
                    "materia": "HISTORIA",
                    "habilidades": ["EF06HI01", "EF06HI02", "EF06HI03", "EF06HI04"]
                }
                # ... adicione mais matérias e suas habilidades do Currículo Paulista
            ]
        }
        ```
    *   **Respostas**:
        *   `200 OK`:
            ```json
            {
                "mensagem": "Resposta obtida com sucesso",
                "dados": [
                    {
                        "dia": "DD/MM/AAAA", # Ex: "15/03/2024"
                        "materia": "NOME_DA_MATERIA_EM_MAIUSCULAS", # Ex: "MATEMATICA"
                        "descricao": "Descrição consolidada das atividades e tópicos abordados nas aulas desta matéria neste dia.",
                        "habilidades": ["CODIGO_HABILIDADE_1", "CODIGO_HABILIDADE_2"] # Códigos das habilidades relevantes
                    }
                    # ... pode conter múltiplas entradas por dia (para diferentes matérias) e por semana
                ]
            }
            ```
        *   `401 Unauthorized`: Token JWT ausente ou inválido no cabeçalho de autenticação.
        *   `500 Internal Server Error`: Erro no processamento da IA ou na obtenção da resposta do Google Gemini.

---

Este README agora está mais completo, destacando o uso do TypeScript e seu impacto na robustez e no desenvolvimento do projeto.
