# StockResearch

A full-stack stock market research tool that scores and ranks S&P 500 + NASDAQ 100 stocks for growth potential. Data is fetched daily via `yfinance` (no API key required), scored with a weighted algorithm, stored in SQLite, and displayed in a React/Vite frontend.

---

## Project Structure

```
StockResearch/
├── backend/
│   ├── app.py          # Flask REST API
│   ├── db.py           # SQLite setup & queries
│   ├── analyzer.py     # Scoring algorithm
│   ├── fetcher.py      # yfinance data fetching
│   ├── scheduler.py    # Daily pipeline runner
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── StockTable.jsx
│   │       ├── StockDetail.jsx
│   │       └── RatingBadge.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## Running

### 1. Run the Flask API

```bash
cd backend
python app.py
```

The API will be available at `http://localhost:5000`.

### 2. Run the Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

### 3. Fetch & Analyze Stock Data (manual)

```bash
cd backend
python scheduler.py
```

This fetches data for ~500 tickers and scores them. Takes 5–15 minutes depending on network speed. Run it once before using the UI.

---

## Scheduling via Windows Task Scheduler

To run the analysis automatically at 5:00 PM every weekday:

1. Open **Task Scheduler** → **Create Basic Task**
2. Set trigger: **Daily**, start time **5:00 PM**, recur every **1** day
3. Action: **Start a program**
   - Program: `python`
   - Arguments: `E:\StockResearch\backend\scheduler.py`
   - Start in: `E:\StockResearch\backend`
4. Click **Finish**

---

## Scoring Algorithm

Each stock is rated 0–100 using these weighted factors:

| Factor | Weight | Source Field |
|---|---|---|
| EPS growth (fwd vs trailing) | 25% | `forwardEps`, `trailingEps` |
| Revenue growth (YoY) | 20% | `revenueGrowth` |
| Forward P/E ratio | 15% | `forwardPE` |
| Analyst target upside | 20% | `targetMeanPrice` |
| 52-week momentum | 10% | `fiftyTwoWeekLow/High` |
| Profit margin | 10% | `profitMargins` |

Rating badges:
- **80+** → Strong Buy
- **60–79** → Buy
- **40–59** → Hold
- **<40** → Watch

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/stocks` | Top 100 stocks by effective rating |
| GET | `/api/stocks/:ticker` | Single stock + 30-entry history |
| PATCH | `/api/stocks/:ticker` | Update notes, prediction, rating override |
| POST | `/api/refresh` | Trigger full fetch + score pipeline |
| GET | `/api/stats` | Summary stats (count, last updated, top sector) |
