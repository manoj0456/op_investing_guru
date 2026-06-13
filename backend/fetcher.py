import yfinance as yf
import pandas as pd
import time

# Hardcoded S&P 500 fallback (representative subset, as of 2024)
SP500_FALLBACK = [
    "MMM","AOS","ABT","ABBV","ACN","ADBE","AMD","AES","AFL","A","APD","ABNB","AKAM","ALB","ARE",
    "ALGN","ALLE","LNT","ALL","GOOGL","GOOG","MO","AMZN","AMCR","AEE","AAL","AEP","AXP","AIG",
    "AMT","AWK","AMP","AME","AMGN","APH","ADI","ANSS","AON","APA","AAPL","AMAT","APTV","ACGL",
    "ADM","ANET","AJG","AIZ","T","ATO","ADSK","ADP","AZO","AVB","AVY","AXON","BKR","BALL","BAC",
    "BK","BBWI","BAX","BDX","WRB","BBY","BIO","TECH","BIIB","BLK","BX","BA","BCR","BKNG","BWA",
    "BXP","BSX","BMY","AVGO","BR","BRO","BF-B","BLDR","BG","CDNS","CZR","CPT","CPB","COF","CAH",
    "KMX","CCL","CARR","CTLT","CAT","CBOE","CBRE","CDW","CE","COR","CNC","CNX","CDAY","CF","CRL",
    "SCHW","CHTR","CVX","CMG","CB","CHD","CI","CINF","CTAS","CSCO","C","CFG","CLX","CME","CMS",
    "KO","CTSH","CL","CMCSA","CAG","COP","ED","STZ","CEG","COO","CPRT","GLW","CPAY","CTVA","CSGP",
    "COST","CTRA","CRWD","CCI","CSX","CMI","CVS","DHR","DRI","DVA","DAY","DECK","DE","DAL","DVN",
    "DXCM","FANG","DLR","DFS","DG","DLTR","D","DPZ","DOV","DOW","DHI","DTE","DUK","DD","EMN",
    "ETN","EBAY","ECL","EIX","EW","EA","ELV","LLY","EMR","ENPH","ETR","EOG","EPAM","EQT","EFX",
    "EQIX","EQR","ESS","EL","ETSY","EG","EVRG","ES","EXC","EXPE","EXPD","EXR","XOM","FFIV","FDS",
    "FICO","FAST","FRT","FDX","FIS","FITB","FSLR","FE","FI","FMC","F","FTIV","BEN","FCX","GRMN",
    "IT","GE","GEHC","GEN","GNRC","GD","GIS","GM","GPC","GILD","GS","HAL","HIG","HAS","HCA","DOC",
    "HSIC","HSY","HES","HPE","HLT","HOLX","HD","HON","HRL","HST","HWM","HPQ","HUBB","HUM","HBAN",
    "HII","IBM","IEX","IDXX","ITW","INCY","IR","PODD","INTC","ICE","IFF","IP","IPG","INTU","ISRG",
    "IVZ","INVH","IQV","IRM","JBHT","JBL","JKHY","J","JNJ","JCI","JPM","JNPR","K","KVUE","KDP",
    "KEY","KEYS","KMB","KIM","KMI","KKR","KLAC","KHC","KR","LHX","LH","LRCX","LW","LVS","LDOS",
    "LEN","LIN","LYV","LKQ","LMT","L","LOW","LULU","LYB","MTB","MRO","MPC","MKTX","MAR","MMC",
    "MLM","MAS","MA","MTCH","MKC","MCD","MCK","MDT","MRK","META","MET","MTD","MGM","MCHP","MU",
    "MSFT","MAA","MRNA","MHK","MOH","TAP","MDLZ","MPWR","MNST","MCO","MS","MOS","MSI","MSCI",
    "NDAQ","NTAP","NFLX","NEM","NBIX","NKE","NI","NDSN","NSC","NTRS","NOC","NCLH","NRG","NUE",
    "NVDA","NVR","NXPI","ORLY","OXY","ODFL","OMC","ON","OKE","ORCL","OTIS","PCAR","PKG","PANW",
    "PH","PAYX","PAYC","PYPL","PNR","PEP","PFE","PCG","PM","PSX","PNW","PXD","PNC","POOL","PPG",
    "PPL","PFG","PG","PGR","PLD","PRU","PEG","PTCS","PSA","PHM","QRVO","PWR","QCOM","DGX","RL",
    "RJF","RTX","O","REG","REGN","RF","RSG","RMD","RVTY","ROK","ROL","ROP","ROST","RCL","SPGI",
    "CRM","SBAC","SLB","STX","SRE","NOW","SHW","SPG","SWKS","SJM","SW","SNA","SOLV","SO","LUV",
    "SWK","SBUX","STT","STLD","STE","SYK","SYF","SNPS","SYY","TMUS","TROW","TTWO","TPR","TGT",
    "TEL","TDY","TFX","TER","TSLA","TXN","TXT","TMO","TJX","TT","TSCO","TDG","TRV","TRMB","TFC",
    "TYL","TSN","USB","UDR","ULTA","UNP","UAL","UPS","URI","UNH","UHS","VLO","VTR","VLTO","VRSN",
    "VRSK","VZ","VRTX","VTRS","VICI","V","VST","VMC","WRK","WAB","WMT","WBD","WM","WAT","WEC",
    "WFC","WELL","WST","WDC","WRK","WY","WHR","WMB","WTW","WDAY","WYNN","XEL","XYL","YUM","ZBRA",
    "ZBH","ZTS",
]

# Hardcoded NASDAQ 100 tickers (as of 2024)
NASDAQ_100 = [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "TSLA", "AVGO", "COST",
    "NFLX", "AMD", "ADBE", "QCOM", "TMUS", "INTC", "INTU", "AMAT", "CSCO", "TXN",
    "AMGN", "BKNG", "ISRG", "MU", "LRCX", "REGN", "ADI", "KLAC", "MELI", "PANW",
    "ASML", "ABNB", "CDNS", "SNPS", "ORLY", "CTAS", "PYPL", "CRWD", "AZN", "MRVL",
    "MAR", "NXPI", "PCAR", "FTNT", "KDP", "DXCM", "MNST", "CEG", "ROST", "ADP",
    "WDAY", "MCHP", "IDXX", "EXC", "LULU", "GILD", "TTD", "ON", "EA", "XEL",
    "ODFL", "ZS", "VRSK", "TEAM", "DDOG", "SIRI", "DLTR", "BIIB", "ILMN", "WBD",
    "ANSS", "FANG", "ALGN", "VRSN", "SWKS", "CHTR", "GFS", "WBA", "MTCH", "RIVN",
    "LCID", "PARA", "NTES", "PDD", "BIDU", "JD", "ZM", "DOCU", "OKTA", "BILL",
    "SNOW", "PLTR", "RBLX", "COIN", "HOOD", "SOFI", "AFRM", "OPEN", "WISH", "CLSK",
]


def get_sp500_tickers() -> list[str]:
    try:
        tables = pd.read_html(
            "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
            header=0,
        )
        tickers = tables[0]["Symbol"].tolist()
        tickers = [t.replace(".", "-") for t in tickers]
        print(f"Fetched {len(tickers)} S&P 500 tickers from Wikipedia.")
        return tickers
    except Exception as e:
        print(f"Wikipedia fetch failed ({e}); using built-in S&P 500 list.")
        return list(SP500_FALLBACK)


def get_all_tickers() -> list[str]:
    sp500 = get_sp500_tickers()
    combined = list(dict.fromkeys(sp500 + NASDAQ_100))  # deduplicate, preserve order
    return combined[:500]


def fetch_stock_info(ticker: str) -> dict | None:
    try:
        t = yf.Ticker(ticker)
        info = t.info
        if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
            return None
        price = info.get("currentPrice") or info.get("regularMarketPrice") or 0
        return {
            "ticker": ticker,
            "company_name": info.get("longName") or info.get("shortName") or ticker,
            "sector": info.get("sector") or "Unknown",
            "current_price": price,
            "forward_eps": info.get("forwardEps"),
            "trailing_eps": info.get("trailingEps"),
            "revenue_growth": info.get("revenueGrowth"),
            "forward_pe": info.get("forwardPE"),
            "target_mean_price": info.get("targetMeanPrice"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "profit_margins": info.get("profitMargins"),
        }
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return None


def fetch_all_stocks() -> list[dict]:
    tickers = get_all_tickers()
    print(f"Fetching data for {len(tickers)} tickers...")
    results = []
    for i, ticker in enumerate(tickers):
        data = fetch_stock_info(ticker)
        if data:
            results.append(data)
        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{len(tickers)} done")
            time.sleep(1)  # be polite to yfinance rate limits
    print(f"Fetched {len(results)} stocks successfully.")
    return results
