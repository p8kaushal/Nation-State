# 🏛️ Nation State: Cabinet of the Republic

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0%2B-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend%20%26%20Auth-3ECF8E?logo=supabase)](https://supabase.com/)

> **An executive strategy and political simulation game.** Take the oath of office, balance volatile factional trusts, steer macroeconomic policy, and survive the trials of executive governance across multi-year presidential terms.

---

## 📖 Overview

**Nation State: Cabinet of the Republic** is an in-depth, turn-based executive political simulation web application. Players assume the mantle of head of state in a nation with evolving challenges. Each decision made at the cabinet table creates immediate effects, factional shifts, and long-term delayed ramifications that shape the trajectory of the republic.

Whether managing debt crises, navigating geopolitical conflicts, reforming education, or cracking down on corruption, every choice influences key national statistics, cabinet factions, and your ultimate legacy in the history books.

---

## ✨ Key Features

- **Dynamic Macroeconomic & Social Simulation**:
  - Models complex, interdependent indicators: **GDP**, **Unemployment Rate**, **Poverty Rate**, **National Debt**, **Treasury Budget**, **Corruption Level**, **Education & Healthcare Indices**, **Crime Rate**, and **Environmental Quality**.
  - Dynamic economic drift and feedback loops between growth, public health, stability, and state expenditure.

- **Faction Trust Matrix**:
  - Balance 4 pivotal national factions: **Military**, **Business**, **Public**, and **International Community**.
  - Neglecting any faction leads to unrest, capital flight, loss of foreign aid, or military intervention.

- **Multiple Starting Scenarios**:
  - 🏛️ **Golden Era**: Balanced starting economy and manageable debt; ideal for classic governance.
  - 🏗️ **Post-War Reconstruction**: Devastated infrastructure, low trust, and crippling debt burdens.
  - 🛢️ **Petrostate**: Immense resource-driven GDP paired with rampant corruption and environmental degradation.
  - ⚖️ **Fragile Democracy**: Robust economy paired with volatile civil-military relations and polarization.

- **Executive Report Card & Legacy Archetypes**:
  - End-of-administration grading system scoring Fiscal Discipline, Social Welfare, Democratic Stability, and Environmental Stewardship.
  - Presidential title archetypes and unlockable achievement badges.

- **Cloud Saves & Cross-Device Persistence**:
  - Integrated with **Supabase** for secure user profiles, cloud save synchronization, and past run archives.
  - Optional Google OAuth sign-in with offline fallback local-storage support.

- **Automated Analysis & Simulation Suite**:
  - Headless autoplay testing and Monte Carlo drift simulations powered by Puppeteer and TSX to calibrate policy balancing.

- **Federal / Westminster Aesthetic**:
  - Bespoke cabinet interface styled in parchment tones, federal navy, and ministerial burgundy with interactive 2D map views.

---

## 🛠️ Tech Stack

- **Core & Runtime**: [TypeScript](https://www.typescriptlang.org/) (Strict typing, ESM)
- **Frontend / UI**: Modern HTML5, Semantic CSS3, Canvas 2D scene renderers
- **Build Tool & Dev Server**: [Vite](https://vitejs.dev/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security, Supabase Auth)
- **Headless Testing & Benchmarks**: [Puppeteer](https://pptr.dev/), [TSX](https://github.com/privatenumber/tsx)
- **Package Manager**: [npm](https://www.npmjs.com/)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher (or equivalent package manager)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/p8kaushal/Nation-State.git
   cd Nation-State
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment template:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and configure your Supabase project credentials:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
   *(Note: The game operates seamlessly in offline local mode if Supabase credentials are omitted.)*

4. **Launch Local Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173` (or the URL shown in your terminal).

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite local development server with HMR. |
| `npm run build` | Runs TypeScript compilation (`tsc`) and generates optimized production bundle in `dist/`. |
| `npm run test` | Runs the simulation unit test suite (`src/run_game_test.ts`). |
| `npm run validate` | Validates decisions and events schema integrity (`src/validate_content.ts`). |
| `npx tsx src/run_autoplay_analysis.ts` | Runs automated headless Monte Carlo autoplay batch to analyze game balance. |

---

## 🗄️ Database Setup (Optional Cloud Sync)

If setting up your own Supabase instance:
1. Create a new Supabase project at [database.new](https://database.new).
2. Navigate to the **SQL Editor** in the Supabase Dashboard.
3. Paste and execute the contents of [`supabase/schema.sql`](supabase/schema.sql).
4. Copy your project's URL and Anon API Key to `.env`.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

Copyright &copy; 2026 **Parth Kaushal**.
