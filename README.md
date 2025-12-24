# Public API Documentation

**Authentication**
All requests require an `api_key` header.

---

## GET /user/{username}

Get public profile data for a user.

**Request**

* Path: `username` (string)

**Response**

```json
{
  "firstName": "string",
  "lastName": "string",
  "wallets": [...],
  "bankAccounts": [...],
  "portfolio": {...}
}
```

---

## GET /user/{username}/history

Get transaction history for a user.

**Request**

* Path: `username` (string)

**Response**

```json
[
  {
    "id": "transaction_id",
    "from": "string",
    "to": "string",
    "amount": 0,
    "currency": "AKR",
    "date": "ISO-8601",
    "type": "digital | physical"
  }
]
```

---

## GET /balance/{identifier}

Get balance for a wallet or bank account.

**Request**

* Path: `identifier` (wallet ID or account ID)

**Response**

```json
{
  "currency": "AKR",
  "balance": 0
}
```

---

## POST /transaction

Send a transaction between two wallets/accounts.

**Request**

```json
{
  "from": "source_id",
  "to": "target_id",
  "amount": 10,
  "currency": "AKR",
  "note": "optional"
}
```

**Response**

```json
{
  "transaction_id": "string",
  "status": "success"
}
```

---

## POST /account/operation

Deposit or withdraw funds between wallet and bank account.

**Request**

```json
{
  "account_id": "string",
  "wallet_id": "string",
  "amount": 10,
  "operation": "deposit | withdraw"
}
```

**Response**

```json
{
  "status": "success",
  "new_balance": 0
}
```

---

## POST /entity/pay

Receive a payment from an entity (nation/org/group).

**Request**

```json
{
  "entity": "entity_name",
  "to": "wallet_id",
  "amount": 10,
  "currency": "AKR",
  "note": "optional"
}
```

**Response**

```json
{
  "transaction_id": "string"
}
```

---

## POST /entity/transfer

Transfer funds to an entity.

**Request**

```json
{
  "from": "wallet_id",
  "entity": "entity_name",
  "amount": 10,
  "currency": "AKR",
  "note": "optional"
}
```

**Response**

```json
{
  "transaction_id": "string"
}
```

---

## GET /entities

List available entities.

**Response**

```json
{
  "nations": ["aetheria"],
  "organizations": ["valentino_foundation"],
  "groups": []
}
```

---

## GET /currencies

Get supported currencies and rates.

**Response**

```json
{
  "AKR": {
    "rate_to_chf": 3.33,
    "total_supply": 43500
  }
}
```

---

## GET /stock/{ticker}

Get stock information.

**Request**

* Path: `ticker` (string)

**Response**

```json
{
  "name": "string",
  "current_price": 0,
  "currency": "AKR",
  "shareholders": {...}
}
```

---

## POST /stock/trade

Buy or sell stock via the market (not P2P).

**Notes:**

* `payment_type` indicates how the buyer pays: `physical` (cash) or `digital` (wallet/bank transfer).
* For `buy` orders the market (orderbook) is the counterparty; for `sell` orders the market will match buyers.

**Request**

```json
{
  "ticker": "VLFD",
  "action": "buy | sell",
  "quantity": 5,
  "order_type": "market | limit",
  "price": 10,                    // required for limit orders (per-share)
  "payment_type": "physical | digital",
  "payment_method": {
    // required if payment_type == "digital"
    "wallet_id": "StealthTrooper36-AKR", // or
    "bank_account_id": "000-000-001"
  },
  "reserve_funds": true            // optional: reserve buyer funds before matching
}
```

**Response**

```json
{
  "status": "accepted | rejected",
  "order_id": "string",
  "executed_quantity": 0,
  "avg_executed_price": 0,
  "remaining_quantity": 5,
  "payment_transaction_id": "string | null",
  "errors": ["string"]
}
```

---

## POST /stock/p2p

Peer-to-peer stock trade between two users (direct transfer + payment).

**Notes:**

* P2P requires explicit buyer and seller ids and a payment record (physical or digital).

**Request**

```json
{
  "ticker": "VLFD",
  "from": "seller_username",
  "to": "buyer_username",
  "quantity": 1,
  "price_per_share": 10,
  "total_price": 10,
  "payment_type": "physical | digital",
  "payment_method": {
    "wallet_id": "buyer-WTC",        // required if digital
    "bank_account_id": "000-000-002"
  }
}
```

**Response**

```json
{
  "status": "success | failed",
  "transaction_id": "string",
  "stock_transfer_id": "string",
  "payment_transaction_id": "string | null",
  "errors": ["string"]
}
```

---

## POST /stock/cancel

Cancel an outstanding market order.

**Request**

```json
{
  "order_id": "string"
}
```

**Response**

```json
{
  "status": "cancelled | not_found | failed"
}
```

---

(End of public endpoints)
