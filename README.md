# AliMimi — Almoço da Semana

Plataforma para organizar o cardápio semanal da família. Cada dia você escolhe a proteína e o prato (ou pula o dia), e o app entrega a receita, a lista de compras de cada prato e a **lista de supermercado da semana somada**, em PDF ou para copiar no WhatsApp.

A semana é **compartilhada**: quem começa recebe um código de família (ex.: `K7QM2P`) e manda o link para os outros. Todo mundo vê e edita a mesma semana, inclusive o carrinho de compras.

```
backend/    API em Python (FastAPI + SQLite): cardápio e semana de cada família
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
| `ALIMIMI_DB` | `backend/alimimi.db` | arquivo SQLite com as semanas das famílias |
| `ALIMIMI_FRONT` | `frontend/dist` | pasta do front compilado |

## API

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/cardapio` | categorias, pratos e receitas |
| POST | `/api/familias` | cria uma família e devolve o código |
| GET | `/api/familias/{codigo}` | semana da família |
| PUT | `/api/familias/{codigo}/dias/{dia}` | `{"prato_id": "carne0"}` ou `{"pulado": true}` (dia 0 = segunda) |
| DELETE | `/api/familias/{codigo}/dias/{dia}` | volta o dia para "sem prato" |
| PUT | `/api/familias/{codigo}/compras/{dia}` | `{"itens": [0, 2]}`: ingredientes já no carrinho |
| PUT | `/api/familias/{codigo}/semana` | substitui a semana inteira (Recomeçar / Desfazer) |

A documentação interativa fica em http://localhost:8000/docs.

## Testes

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

## Onde mexer

- **Pratos e receitas:** `backend/app/dados/pratos.json` e `receitas.json`; fotos em `backend/app/static/img/<id>.jpg`.
- **Categoria "Massas", ordem e capas:** topo de `backend/app/cardapio.py`.
- **Telas:** `frontend/src/telas/` (Inicio, Cardapio, Categorias, Pratos, Receita).
- **Lista somada e PDFs:** `frontend/src/lib/lista.js` e `frontend/src/lib/pdf.js`.
- **Cores e estilos:** `frontend/src/estilo.css`.
