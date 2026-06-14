import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-2" });
const ddb = DynamoDBDocumentClient.from(client);

const STOCKS_TABLE = "InvestingGuru-Stocks";
const OPTIONS_TABLE = "InvestingGuru-Options";

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,PATCH,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return {};
  }
}

// ─── Stock Handlers ────────────────────────────────────────────────────────────

async function getStocks() {
  const result = await ddb.send(new ScanCommand({ TableName: STOCKS_TABLE }));
  const items = (result.Items || []).sort((a, b) => {
    const ra = a.user_rating_override ?? a.rating ?? 0;
    const rb = b.user_rating_override ?? b.rating ?? 0;
    return rb - ra;
  });
  return response(200, items.slice(0, 100));
}

async function getStock(ticker) {
  const result = await ddb.send(
    new GetCommand({ TableName: STOCKS_TABLE, Key: { ticker } })
  );
  if (!result.Item) return response(404, { error: "Stock not found" });
  return response(200, result.Item);
}

async function upsertStock(ticker, body) {
  const item = {
    ticker,
    company_name: body.company_name || "",
    sector: body.sector || "",
    current_price: body.current_price ?? null,
    rating: body.rating ?? 0,
    analyst_upside: body.analyst_upside ?? null,
    eps_growth: body.eps_growth ?? null,
    revenue_growth: body.revenue_growth ?? null,
    pe_ratio: body.pe_ratio ?? null,
    profit_margin: body.profit_margin ?? null,
    momentum: body.momentum ?? null,
    notes: body.notes || "",
    prediction: body.prediction || "",
    user_rating_override: body.user_rating_override ?? null,
    last_updated: new Date().toISOString(),
    source: body.source || "manual",
  };
  await ddb.send(new PutCommand({ TableName: STOCKS_TABLE, Item: item }));
  return response(200, item);
}

async function patchStock(ticker, body) {
  const allowed = ["notes", "prediction", "user_rating_override"];
  const updates = [];
  const names = {};
  const values = {};

  for (const key of allowed) {
    if (key in body) {
      updates.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = body[key];
    }
  }
  if (updates.length === 0) return response(400, { error: "No patchable fields" });

  updates.push("#last_updated = :last_updated");
  names["#last_updated"] = "last_updated";
  values[":last_updated"] = new Date().toISOString();

  const result = await ddb.send(
    new UpdateCommand({
      TableName: STOCKS_TABLE,
      Key: { ticker },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );
  return response(200, result.Attributes);
}

async function deleteStock(ticker) {
  await ddb.send(new DeleteCommand({ TableName: STOCKS_TABLE, Key: { ticker } }));
  return response(200, { deleted: ticker });
}

// ─── Options Handlers ──────────────────────────────────────────────────────────

async function getOptions() {
  const result = await ddb.send(new ScanCommand({ TableName: OPTIONS_TABLE }));
  const items = (result.Items || []).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  return response(200, items);
}

async function createOption(body) {
  const item = {
    id: randomUUID(),
    ticker: body.ticker || "",
    strategy: body.strategy || "",
    expiry: body.expiry || "",
    strike: body.strike ?? null,
    premium: body.premium ?? null,
    max_profit: body.max_profit ?? null,
    max_loss: body.max_loss ?? null,
    breakeven: body.breakeven ?? null,
    rationale: body.rationale || "",
    risk_level: body.risk_level || "medium",
    status: body.status || "active",
    created_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: OPTIONS_TABLE, Item: item }));
  return response(201, item);
}

async function patchOption(id, body) {
  const allowed = [
    "ticker", "strategy", "expiry", "strike", "premium",
    "max_profit", "max_loss", "breakeven", "rationale", "risk_level", "status",
  ];
  const updates = [];
  const names = {};
  const values = {};

  for (const key of allowed) {
    if (key in body) {
      updates.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = body[key];
    }
  }
  if (updates.length === 0) return response(400, { error: "No patchable fields" });

  updates.push("#last_updated = :last_updated");
  names["#last_updated"] = "last_updated";
  values[":last_updated"] = new Date().toISOString();

  const result = await ddb.send(
    new UpdateCommand({
      TableName: OPTIONS_TABLE,
      Key: { id },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );
  return response(200, result.Attributes);
}

async function deleteOption(id) {
  await ddb.send(new DeleteCommand({ TableName: OPTIONS_TABLE, Key: { id } }));
  return response(200, { deleted: id });
}

// ─── Router ────────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || "GET";
  const rawPath = event.path || event.rawPath || "/";
  const pathParts = rawPath.replace(/^\//, "").split("/");
  const resource = pathParts[0];
  const param = pathParts[1];

  if (method === "OPTIONS") return response(200, {});

  try {
    if (resource === "stocks") {
      if (method === "GET" && !param) return await getStocks();
      if (method === "GET" && param) return await getStock(param);
      if (method === "PUT" && param) return await upsertStock(param, parseBody(event));
      if (method === "PATCH" && param) return await patchStock(param, parseBody(event));
      if (method === "DELETE" && param) return await deleteStock(param);
    }

    if (resource === "options") {
      if (method === "GET" && !param) return await getOptions();
      if (method === "POST" && !param) return await createOption(parseBody(event));
      if (method === "PATCH" && param) return await patchOption(param, parseBody(event));
      if (method === "DELETE" && param) return await deleteOption(param);
    }

    return response(404, { error: "Route not found" });
  } catch (err) {
    console.error(err);
    return response(500, { error: err.message });
  }
};
