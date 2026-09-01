# 🌐 lifeOS Companion — Browser Extension

The **lifeOS Companion** is an ultra-lightweight, high-performance browser extension (Manifest V3) that connects your daily web workflow directly to your personal lifeOS operating system.

---

## 🚀 Key Features

1. **⚡ Screentime at the Top:**
   - Real-time aggregated active screentime for today across apps & websites right in the extension header.
   - 1-click refresh to sync latest usage metrics.

2. **📎 Smart Web Clipper & Destination Notes:**
   - Captures current page title, URL, favicon, and highlighted text or readable article content.
   - **Smart Default Note Matching:** Automatically searches your lifeOS notes for `"Projects I wanna try"` (or your custom configured default note) and selects it by default.
   - Supports creating new notes on the fly or clipping to any existing note.

3. **✨ AI Note Analyzer, Summarizer & Organizer:**
   - Run AI summarization, key takeaways, and project breakdowns directly on any web clip or existing note.
   - **Optional Custom Prompt Field:** Send specific instructions to the AI (e.g. *"Extract tech stack and architecture"*, *"Summarize in 3 bullet points"*, *"Format as actionable tasks with due dates"*).
   - **Append vs. Replace Checkbox Toggle:** Seamlessly choose whether the AI result is appended to the bottom of the note or replaces the entire note content.

4. **✅ Today's Tasks & Habits + Quick Add:**
   - **Quick Add Task Bar:** Add tasks for today in seconds with priority levels (Low / Med / High), due times, and optional attached webpage URLs.
   - Check off completed tasks with instant visual feedback.
   - Track and log today's scheduled habits with 1-tap toggles.

5. **📝 Notes Explorer:**
   - Browse and search all your lifeOS notes.
   - View note bodies and run AI processing on existing notes with custom prompts and append/replace modes.

6. **🔄 1-Click Sync & Seamless Configuration:**
   - 1-Click Sync from any active lifeOS tab (reads session tokens directly).
   - Supports direct Supabase PostgREST connection and OpenAI-compatible AI endpoints (Bynara, Dahl, OpenAI, Anthropic, Groq, Ollama, or lifeOS `/api/ai` proxy).

---

## 📦 How to Install (Load Unpacked)

### Google Chrome / Brave / Edge / Arc:
1. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
2. Enable **Developer mode** toggle in the top right corner.
3. Click **Load unpacked** in the top left.
4. Select the directory:
   ```
   /home/batman/lifeOS/extension
   ```
5. The **lifeOS Companion** icon will appear in your browser toolbar! Pin it for quick access.

### Firefox:
1. Navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `/home/batman/lifeOS/extension/manifest.json`.

---

## ⌨️ Keyboard Shortcuts

- `Alt + Shift + L` (Mac: `Option + Shift + L`): Open lifeOS Companion popup
- `Alt + Shift + C` (Mac: `Option + Shift + C`): Quick Clip current page directly to `"Projects I wanna try"`

---

## ⚙️ Configuration & Permissions

The extension uses the following Manifest V3 permissions:
- `storage`: Preserves auth tokens and user preferences across browser sessions.
- `activeTab` & `scripting`: Extracts readable article text, page title, and user selection.
- `contextMenus`: Adds right-click *"Clip to lifeOS (Default Note)"* and *"Summarize with lifeOS AI & Save"*.
- `tabs`: Queries the current active URL and enables 1-click credential sync from open lifeOS tabs.
