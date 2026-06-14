# OP Investing Guru

Stock research and options tracking app backed by AWS Lambda + DynamoDB.

## Stack

- **Frontend**: React + Vite + Tailwind CSS (HashRouter, two pages)
- **Backend**: AWS Lambda (Node.js 22, ES modules) + API Gateway HTTP API
- **Database**: DynamoDB — `InvestingGuru-Stocks`, `InvestingGuru-Options`
- **Scheduler**: Python script using yfinance to auto-score and upsert stocks daily

## Local dev

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL` in `frontend/.env` to point at your deployed Lambda:

```
VITE_API_URL=https://xxxxxxxxxx.execute-api.us-east-2.amazonaws.com
```

## Run daily analysis

```bash
cd backend
pip install -r requirements.txt
INVESTING_GURU_API_URL=https://xxxxxxxxxx.execute-api.us-east-2.amazonaws.com python scheduler.py
```

Fetches S&P 500 + NASDAQ 100 tickers, scores each on 6 factors (analyst upside, EPS growth,
revenue growth, P/E, profit margin, 52-week momentum), and upserts up to 500 records.

## Deploy backend (GitHub Actions)

Set secrets in the repo:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM key with Lambda + DynamoDB + API Gateway permissions |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret |
| `VITE_API_URL` | Lambda API endpoint (after first backend deploy) |

Push to `main` → auto-deploys Lambda, creates DynamoDB tables and API Gateway on first run.

## Deploy frontend

Push to `main` → builds and syncs to S3 bucket `op-investing-guru-web` (us-east-2).

## Pages

- **`/` — Stocks**: ranked table of up to 100 stocks by rating, add/edit/delete
- **`/#/options` — Options**: strategy suggestions with full CRUD and filter bar
