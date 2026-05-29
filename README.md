<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Fine Art Print Analyzer

An automated cataloguing and appraisal platform for fine art prints, lithographs, and engravings. Powered by Gemini, PostgreSQL, and Supabase.

---

## 🔗 Project Links

- **GitHub Project Repository**: [https://github.com/sylvan-s/Fine-Art-Print-Analyzer](https://github.com/sylvan-s/Fine-Art-Print-Analyzer)
- **Render Production URL**: [https://fine-art-print-analyzer.onrender.com](https://fine-art-print-analyzer.onrender.com) (or your specific custom service URL configured in the Render Dashboard)

---

## 💻 Running Locally

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **NPM** (v9 or higher)

### Setup & Execution Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sylvan-s/Fine-Art-Print-Analyzer.git
   cd Fine-Art-Print-Analyzer
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add the following keys:
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   ANTHROPIC_API_KEY="your-anthropic-api-key" # Optional, required to run Claude appraisals
   DATABASE_URL="your-supabase-postgresql-connection-string"
   ```
   > [!TIP]
   > Either `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY` can be used to authenticate with Anthropic Claude models.
   > For local development with Supabase, it is highly recommended to use the **Transaction-Mode Pooler connection string** (port `6543`) to resolve network connection correctly.

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   *The server will boot on [http://localhost:3000](http://localhost:3000) (hot-reloads enabled).*

5. **Type Check / Linter Verification**:
   ```bash
   npm run lint
   ```

---

## 🚀 Running via Render Domain (Production Deployment)

This application is ready to be hosted as a Web Service on **Render**.

### Deployment Settings

1. **Build & Start Settings**:
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`

2. **Environment Variables**:
   Add the following environment variables in your Render Web Service settings panel:
   - `GEMINI_API_KEY`: Your Gemini API developer token.
   - `DATABASE_URL`: Your Supabase PostgreSQL database pooler connection string.
   - `ANTHROPIC_API_KEY` (or `CLAUDE_API_KEY`): (Optional) Your Anthropic Claude API developer token.

   Render will bundle the client files via Vite and package the Node server into a single build artifact (`dist/server.cjs`), listening on port `3000` (or `PORT` environment override).

---

## 💾 Where User Data is Stored

To ensure high performance, security, and offline sync support, user data is partitioned as follows:

1. **Relational Metadata (Database)**:
   - All structured records—including user accounts (credentials hashed with bcrypt), catalogue groups, lot structures, image records, and Gemini appraisal reports—are stored in your **Supabase PostgreSQL database** using the relational schema defined in [`schema.sql`](file:///Users/sylvansitkey/antigravity/Fine-Art-Print-Analyzer/schema.sql).

2. **Uploaded Scans & Crop Highlights (File Storage)**:
   - Original user-uploaded scans and crop details (signature zooms, condition issues, scale photos) are stored on the server's disk under the directory **`data/user_records/[username]/images/`** (served via the static route `/api/user-images/`).
   - The database maps these using the `storage_key` column, making it easy to migrate local storage folders to cloud object buckets (e.g. AWS S3, Google Cloud Storage, or Supabase Storage) in the future.

3. **Offline Client-Side Cache**:
   - The client-side application caches catalogue indices in the browser's **IndexedDB** (`catalog_list`, `active_catalog_id`, and `catalog_items_[id]`) to support instant, zero-latency catalog switching.