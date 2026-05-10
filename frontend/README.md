# Boxify Frontend

Next.js frontend for the Boxify annotation tool.

## Prerequisites

- Node.js 18+

## Installation

```bash
npm install
```

## Environment Setup

```bash
cp .env.local.example .env.local
```

Open `.env.local` and update the backend URL if needed:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Running the App

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000). Make sure the backend is running first.
