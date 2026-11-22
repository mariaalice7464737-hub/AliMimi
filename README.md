# AliMimi — Almoço da Semana

Plataforma para organizar o cardápio semanal da família. Cada dia você escolhe a proteína e o prato (ou pula o dia), e o app entrega a receita, a lista de compras de cada prato e a **lista de supermercado da semana somada**, em PDF ou para copiar no WhatsApp.

A semana é **compartilhada**: quem começa recebe um código de família (ex.: `K7QM2P`) e manda o link para os outros. Todo mundo vê e edita a mesma semana, inclusive o carrinho de compras.

```
backend/    API em Python (FastAPI; SQLite no computador, Postgres em produção)
frontend/   App em React (Vite): as telas do celular
```

## Rodar no computador

Precisa de **Python 3.10+** e **Node 18+**.

**1. Back** (terminal 1)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**2. Front** (terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Abra o endereço que o Vite mostrar (http://localhost:5173). Em desenvolvimento, o Vite repassa `/api` e `/img` para o back na porta 8000.

Para testar no celular na mesma rede Wi-Fi: `npm run dev -- --host` e abra o IP do computador no celular.

## Produção (um servidor só)

O back entrega o front já compilado, então basta um processo:

```bash
cd frontend && npm install && npm run build      # gera frontend/dist
cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Ou com Docker:
```bash
docker build -t alimimi .
docker run -p 8000:8000 -v alimimi-dados:/data alimimi
```

Variáveis de ambiente:

| Variável | Padrão | Para que serve |
|---|---|---|
| `DATABASE_URL` | (vazio) | URL de um Postgres (ex.: Neon). Se existir, é usada no lugar do SQLite |
| `ALIMIMI_DB` | `backend/alimimi.db` | arquivo SQLite com as semanas das famílias (quando não há `DATABASE_URL`) |
| `ALIMIMI_FRONT` | `frontend/dist` | pasta do front compilado |
| `PORT` | `8000` | porta do servidor no Docker (o Render define sozinho) |

## Colocar no ar de graça (Render + Neon)

O Render gratuito apaga os arquivos do servidor sempre que ele reinicia ou "dorme", então a semana fica guardada num Postgres gratuito do **Neon**, que não expira.

**1. Banco no Neon** (uns 2 minutos)
1. Crie uma conta em https://neon.com (dá para entrar com o GitHub).
2. Crie um projeto chamado `alimimi` na região **AWS US West 2 (Oregon)**, a mesma do Render (`region: oregon` no `render.yaml`). O Render não tem servidor no Brasil e não deixa mudar a região depois; banco longe do servidor deixa cada requisição lenta.
3. Na tela do projeto, clique em **Connect**, **desligue o Connection pooling** (o back já tem pool próprio) e copie a *connection string* (`postgresql://…?sslmode=require`).

**2. App no Render**
1. Crie uma conta em https://render.com (dá para entrar com o GitHub).
2. **New → Blueprint**, escolha o repositório **AliMimi** (o arquivo `render.yaml` já diz o que criar).
3. Quando o Render pedir `DATABASE_URL`, cole a connection string do Neon e clique em **Apply**.
4. Espere o primeiro deploy (uns 5 minutos). O endereço do app aparece no topo, algo como `https://alimimi.onrender.com`.

Depois disso, todo push no `main` atualiza o app sozinho. As tabelas são criadas automaticamente na primeira vez.

**Bom saber:** no plano gratuito o Render "dorme" depois de 15 minutos sem ninguém usar. O primeiro acesso depois disso demora cerca de 1 minuto (aparece uma tela de carregamento); os seguintes são rápidos. A semana fica salva no Neon e não se perde.

## API

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/cardapio` | categorias, pratos e receitas |
| POST | `/api/familias` | cria uma família e devolve o código |
| GET | `/api/familias/{codigo}` | semana da família |
| PUT | `/api/familias/{codigo}/dias/{dia}` | `{"prato_id": "carne0"}` ou `{"pulado": true}` (dia 0 = segunda) |
| DELETE | `/api/familias/{codigo}/dias/{dia}` | volta o dia para "sem prato" |
| PUT | `/api/familias/{codigo}/compras/{dia}` | `{"itens": [0, 2]}`: ingredientes já no carrinho |
| PUT | `/api/familias/{codigo}/dias/{dia}/acompanhamentos` | `{"itens": ["acomp0"]}`: acompanhamentos do dia (exige proteína) |
| PUT | `/api/familias/{codigo}/semana` | substitui a semana inteira (Recomeçar / Desfazer) |

A documentação interativa fica em http://localhost:8000/docs.

## Testes

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
# para testar também num Postgres:
TEST_DATABASE_URL=postgresql://usuario:senha@localhost:5432/teste python -m pytest
```

No GitHub, o Actions (`.github/workflows/testes.yml`) roda os testes do back no SQLite e no Postgres, e o build do front, a cada pull request e a cada push no `main`.

## Acompanhamentos

Cada dia tem **exatamente uma proteína** (pratos de `pratos.json`) e **zero ou mais acompanhamentos**, em três grupos: Acompanhamentos, Leguminosas e vegetais, Saladas.

- Catálogo: `backend/app/dados/acompanhamentos.json`. **Está vazio de propósito**: as 58 receitas do PDF não têm ingredientes, quantidades nem modo de preparo. Enquanto estiver vazio, o app funciona exatamente como antes (a etapa "O que vai acompanhar?" não aparece).
- Um item só entra no app se a receita estiver **completa**: `tempo`, `porcoes`, `ingredientes`, `preparo` e `compras` (cada item com `nome`, `secao` válida e, se tiver `qtd`, `unidade`). Item incompleto fica de fora e aparece no log — nunca gera lista de compras errada.
- Ids novos não podem repetir os dos pratos; foto em `backend/app/static/img/<id>.jpg` (opcional).
- Formato de um item (dentro de `grupos[].itens`):
  ```json
  { "id": "acomp0", "nome": "…", "descricao": "…",
    "receita": { "tempo": "25 min", "porcoes": 4, "ingredientes": ["…"], "preparo": ["…"],
                 "compras": [{ "qtd": 2, "unidade": "xícara", "nome": "Arroz", "secao": "Mercearia" }] } }
  ```
- Exemplo completo (fictício, só para testes): `backend/tests/dados/acompanhamentos_teste.json`. Para ver a etapa no computador: `ALIMIMI_ACOMPANHAMENTOS=tests/dados/acompanhamentos_teste.json uvicorn app.main:app --reload`.
- Banco: tabela nova `acompanhamentos`; semanas antigas não têm linhas nela e carregam com a lista vazia (sem migração). Trocar a proteína mantém os acompanhamentos; pular o dia os retira.

## Onde mexer

- **Pratos e receitas:** `backend/app/dados/pratos.json` e `receitas.json`; fotos em `backend/app/static/img/<id>.jpg`.
- **Categoria "Massas", ordem e capas:** topo de `backend/app/cardapio.py`.
- **Telas:** `frontend/src/telas/` (Inicio, Cardapio, Categorias, Pratos, Acompanhamentos, Receita).
- **Lista somada e PDFs:** `frontend/src/lib/lista.js` e `frontend/src/lib/pdf.js`.
- **Cores, tipografia e espaçamentos:** tokens no topo de `frontend/src/estilo.css`.
- **Ilustrações e ícones (SVG):** `frontend/src/componentes/Ilustracoes.jsx`.
