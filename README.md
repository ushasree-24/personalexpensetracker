# Aura Finance: AI-Powered Personal Expense Tracker

Aura is a fully responsive, premium full-stack **Personal Expense Tracker** application built using **native HTML5, CSS3, and JavaScript** (no frontend frameworks) on the frontend, and a lightweight **Node.js + Express** API backend. It features an interactive **AI Financial Coach (Aura)** and a dynamic database connection layer.

## Key Features
* 📊 **Interactive Dashboard:** Dynamic KPI indicators for monthly income, expenses, and savings rate. Uses an interactive **Chart.js** line chart displaying cumulative spending trends.
* 💸 **Category Budget Audit:** Custom budget allowances per category with HSL color-coded warnings (Green for `<70%`, Orange warning for `70-90%`, Red for over budget `>90%`).
* 🏷️ **Transaction Manager:** Complete statement logger supporting add, edit, search, category filtering, and sorting options.
* 🧠 **AI-Powered Input & Chat:** 
  * **Quick Add Input:** Type raw text like *"Spent $45 on sushi yesterday"* to automatically extract the amount, category, description, and date!
  * **Financial Chat Coach (Aura):** Consult the chatbot to run automated audits, summarize monthly spending reports, and output tailored savings advice.
* 💾 **Dual-Mode AI Engine:** Operating in offline Local Heuristics Mode (Free, no setup) by default, and upgradable to Google Gemini API Engine via Settings.
* 📂 **Maintenance Utilities:** Built-in exports for downloading statements in **JSON** or **CSV** formats, and one-click database reset.

---

## Technical Stack & Architecture
* **Frontend:** Semantic HTML5, Vanilla CSS3 (CSS Grid, Flexbox, Media Queries), Vanilla ES6 JavaScript (No React, Angular, Vue, Tailwind, or Bootstrap).
* **Backend:** Node.js, Express.js.
* **Database Driver:** `mongodb` client.
* **CDNs Used:** Lucide Icons (SVG renders) and Chart.js.

---

## Database Connection Details (Bulletproof Fallback)
To ensure the project runs seamlessly with **zero configurations or api keys**, the backend uses a dynamic database router:
1. **Cloud MongoDB:** If a `MONGODB_URI` environment variable is detected, the app automatically connects to that database cluster (e.g., MongoDB Atlas).
2. **Local MongoDB:** If no environment variable is present, it attempts to connect to a default local instance at `mongodb://127.0.0.1:27017/expense-tracker`.
3. **JSON File Fallback (`database.json`):** If the MongoDB server is unavailable or connection timeouts occur, the app **automatically falls back to a local JSON file** in the project root. This ensures that reviewers can run the application immediately without installing MongoDB.

---

## Local Setup Instructions

### Prerequisites
* [Node.js](https://nodejs.org/) (version 16 or higher recommended).

### Installation
1. Clone or open the project folder:
   ```bash
   cd "personal expense tracker"
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm start
   ```
4. Open your browser and navigate to: [http://localhost:3000](http://localhost:3000)

---

## AI Configuration (Optional Gemini Upgrade)
By default, Aura operates using a local regex-based parsing system and a rule-based database analyzer to calculate your tips.
To unlock full, conversational intelligence:
1. Go to the **Settings** tab in the sidebar.
2. Toggle **Enable Google Gemini AI**.
3. Input your **Gemini API Key** and click **Save AI Configuration**.
4. The key is saved locally in your browser's Local Storage (it is never saved on backend servers).

---

## Deployment Instructions

### 1. Deploying on Render (Web Service)
Render is perfect for hosting the long-running Express server.
1. Create a new **Web Service** on Render and connect your GitHub repository.
2. Set the following options:
   * **Environment:** `Node`
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
3. Add Environment Variables (optional):
   * `MONGODB_URI`: Link your MongoDB Atlas database string to persist records in the cloud.
   * `GEMINI_API_KEY`: Set your Google Gemini API key to make it available for all users globally.

### 2. Deploying on Vercel (Serverless)
The codebase includes a `vercel.json` routing configuration that splits your app into a Serverless Function (`api/index.js`) and static frontend sheets (`public/`).
1. Install Vercel CLI: `npm i -g vercel` (or link via Vercel GitHub integration).
2. Run command:
   ```bash
   vercel
   ```
3. Vercel automatically reads `vercel.json` and spins up the environment.
4. Set Environment Variables under project settings if you want to connect external databases (`MONGODB_URI`). If no URI is provided, Vercel serverless containers will run using a temporary in-memory database instance for testing.
