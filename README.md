# Bitespeed Identity Reconciliation Service

A backend service that identifies and consolidates customer contact information across multiple requests. Built for the [Bitespeed Backend Task](https://drive.google.com/file/d/1h3xh2PKP8aQW85hDdn2qUkXDUUAVDKaP/view).

## Problem Statement

FliteManager receives customer orders with `email` and/or `phoneNumber`. The same person may use different contact details across orders. This service links all contact information belonging to the same person into a single identity group, ensuring:

- The **oldest** contact is always the **primary**
- All others are **secondary**, linked to the primary
- If two separate identity groups become connected, they are **merged** (oldest stays primary)

## API

### `POST /identify`

**Request:**
```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```
At least one of `email` or `phoneNumber` must be provided.

**Response:**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["111", "222"],
    "secondaryContactIds": [2, 3]
  }
}
```

### Example Walkthrough

**Request 1** — New user:
```json
// POST /identify
{ "email": "lorraine@hillvalley.edu", "phoneNumber": "123456" }

// Response: new primary created (id=1)
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

**Request 2** — Same email, new phone:
```json
// POST /identify
{ "email": "lorraine@hillvalley.edu", "phoneNumber": "789012" }

// Response: secondary created (id=2), linked to primary
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456", "789012"],
    "secondaryContactIds": [2]
  }
}
```

**Request 3** — Merge two groups:
```json
// Assume id=3 exists as a separate primary: { email: "mcfly@hillvalley.edu", phone: "555" }
// POST /identify
{ "email": "lorraine@hillvalley.edu", "phoneNumber": "555" }

// Response: id=3 converted to secondary, merged under id=1
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456", "789012", "555"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Data Model

```
Contact
├── id             Int (auto-increment, primary key)
├── email          String? (nullable, indexed)
├── phoneNumber    String? (nullable, indexed)
├── linkedId       Int? (FK → Contact.id, null for primaries)
├── linkPrecedence "primary" | "secondary"
├── createdAt      DateTime
├── updatedAt      DateTime
└── deletedAt      DateTime? (soft delete)
```

## Merge Logic

1. **No match found** → Create a new **primary** contact
2. **Single group match** → Check if the request introduces new info (new email or phone not in the group). If yes, create a **secondary** linked to the primary
3. **Multiple groups match** → **Merge**: the oldest primary stays primary; newer primaries become secondaries; all their secondaries are re-linked. This runs inside a **Prisma transaction** for atomicity
4. **Duplicate prevention** → If both email and phone already exist in the group, no new row is created

## Tech Stack

- **Runtime:** Node.js + TypeScript (strict mode)
- **Framework:** Express
- **ORM:** Prisma 7 with `@prisma/adapter-pg`
- **Database:** PostgreSQL (Neon)

## Project Structure

```
src/
├── index.ts                    # Entry point
├── routes/
│   └── identify.route.ts       # POST /identify route
├── controllers/
│   └── identify.controller.ts  # Input validation, error handling
├── services/
│   └── identify.service.ts     # Core identity reconciliation logic
└── lib/
    └── prisma.ts               # Prisma client singleton
```

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/Harsh-uu/bitespeed-assignment.git
cd bitespeed-assignment

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env and set DATABASE_URL to your PostgreSQL connection string

# 4. Run migrations
npx prisma migrate deploy

# 5. Generate Prisma client
npx prisma generate

# 6. Start development server
npm run dev
```

The server starts on `http://localhost:3000`.

## Deployed Endpoint

`https://identity-reconciliation-vrgl.onrender.com/identify`

Test it:
```bash
curl -X POST https://identity-reconciliation-vrgl.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","phoneNumber":"123456"}'
```
