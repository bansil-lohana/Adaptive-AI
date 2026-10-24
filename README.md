Adaptive AI — Full-Stack Multi-Modal Platform

An end-to-end full-stack application leveraging Google Gemini AI for multi-modal text, image, and voice capabilities. Built as a pnpm monorepo featuring a React Native (Expo) frontend, Express.js backend, and Supabase (PostgreSQL) database.

🏗️ Project Architecture

adaptive-ai-monorepo/
├── artifacts/
│   ├── adaptive-ai/      # Frontend Application (Expo / React Native)
│   └── api-server/       # Backend API Server (Node.js / Express.js)
├── lib/
│   ├── api-client/       # Shared REST API Client & Zod Types
│   └── db/               # Supabase Database Schemas & Migrations
└── pnpm-workspace.yaml   # Monorepo Workspace Configuration


✨ Features

Multi-Modal AI Integration: Interact with Google Gemini API for text analysis, image recognition, and chat assistant capabilities.

Cross-Platform Frontend: React Native app built with Expo and Expo Router for web and mobile platforms.

Secure Backend: Express.js REST API with authentication middleware and token verification.

Database & Auth: Supabase and PostgreSQL backend supporting OAuth2 (Google OAuth) and user sessions.

End-to-End Type Safety: TypeScript across all packages with Zod schema validation.

🛠️ Tech Stack

Frontend: React Native, Expo, Expo Router, TypeScript

Backend: Node.js, Express.js, TypeScript, REST API

AI Services: Google Gemini API (Multi-Modal AI)

Database & Auth: Supabase, PostgreSQL, Google OAuth

Monorepo Tools: pnpm Workspaces

🚀 Getting Started

Prerequisites

Ensure you have the following installed:

Node.js (v18 or higher)

pnpm (npm install -g pnpm)

Installation

Clone the repository:

git clone https://github.com/bansil-lohana/adaptive-ai.git
cd adaptive-ai


Install dependencies across the monorepo:

pnpm install


Configure Environment Variables:

Create .env files in both backend and frontend directories:

Backend (artifacts/api-server/.env):

PORT=5000
GEMINI_API_KEY=your_google_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key


Frontend (artifacts/adaptive-ai/.env):

EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key


Running the Project

Start the Backend API Server:

pnpm --filter api-server dev


Start the Expo Frontend:

pnpm --filter adaptive-ai start
