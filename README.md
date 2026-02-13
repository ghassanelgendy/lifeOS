<div align="center">
  <a href="https://life-os-tan.vercel.app/" target="_blank">
    <img src="https://raw.githubusercontent.com/ghassanelgendy/lifeOS/capacitorJS/public/favicon-96x96.png" alt="lifeOS Logo" width="150">
  </a>
  <h1>lifeOS</h1>
  <p>Your life, quantified. An operating system for your existence.</p>
  
  <p>
    <a href="https://life-os-tan.vercel.app/" target="_blank">
      <img src="https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge" alt="Live Demo">
    </a>
    <a href="https://github.com/ghassanelgendy/lifeOS/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/ghassanelgendy/lifeOS?style=for-the-badge" alt="License">
    </a>
    <a href="https://github.com/ghassanelgendy/lifeOS/issues">
      <img src="https://img.shields.io/github/issues/ghassanelgendy/lifeOS?style=for-the-badge" alt="Issues">
    </a>
    <a href="https://github.com/ghassanelgendy/lifeOS/pulls">
      <img src="https://img.shields.io/github/issues-pr/ghassanelgendy/lifeOS?style=for-the-badge" alt="Pull Requests">
    </a>
  </p>
</div>

lifeOS is not just a dashboard; it is an operating system for your existence. It connects your habits, health, finances, and digital footprint into a single, offline-first interface, helping you navigate the noise of modern life with clarity.

## 🧩 The Ecosystem

lifeOS aggregates data from different aspects of your life into one cohesive view.

*   **📱 Digital Wellbeing (Powered by [Chronos](https://github.com/ghassanelgendy/chronos-screentime))**
    *   **Seamless Sync**: Integrates with Chronos, our custom desktop tracker, to log active window usage.
    *   **Granular Analytics**: Visualize your digital habits, set limits, and reclaim your time.

*   **🧠 Second Brain & Productivity**
    *   **Unified Calendar**: Syncs with iCal to merge tasks, classes, and events.
    *   **Academic Suite**: Specialized tracking for grades, assignments, and course schedules.
    *   **SMS Handling**: Process incoming SMS messages using Apple Shortcuts for task creation and data input.
    *   **Offline-First**: Built on IndexedDB, so your brain works even when the internet doesn't.

*   **💰 Financial Intelligence**
    *   **Real-Time Wealth**: Connect directly to bank accounts for live income and expense tracking.
    *   **Investment Portfolio**: Monitor asset performance alongside your daily spending.

*   **❤️ Health & Spirit**
    *   **Bio-Metrics**: Deep integration with Withings to track physical health.
    *   **Habit Formation**: Visualize streaks for prayer, meditation, and daily routines.

## 🛠️ The Stack

Built with modern web technologies for performance and scalability.

| Component      | Technology                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| **Frontend**   | React, TypeScript, Vite, Tailwind CSS                                                                     |
| **Backend/DB** | Supabase, SQLite (via `sqlite-wasm`)                                                                      |
| **State**      | Zustand, TanStack Query                                                                                   |
| **Desktop**    | Chronos (.NET 8 / WPF)                                                                                    |
| **UI/UX**      | `cmdk`, `recharts`, `react-big-calendar`                                                                  |
| **Tooling**    | ESLint, Prettier, Vite PWA                                                                                |

## 🚀 Quick Start

Get your local copy up and running in a few simple steps.

### Prerequisites

*   Node.js (v18 or higher recommended)
*   npm

### Installation

1.  **Clone the repository**
    ```sh
    git clone https://github.com/ghassanelgendy/lifeOS.git
    ```
2.  **Install dependencies**
    ```sh
    npm install
    ```
3.  **Configure your environment**
    *   Create a `.env` file in the root directory.
    *   Add your Supabase project URL and anon key.
4.  **Run the development server**
    ```sh
    npm run dev
    ```

## 🗺️ Roadmap

- [ ] **Dashboard 2.0**: Interactive widgets and customizable layouts.
- [ ] **Mobile Experience**: Enhanced UI for PWA usage on phones.
- [ ] **Deeper Chronos Integration**: Two-way sync for blocking distractions via lifeOS.

See the [open issues](https://github.com/ghassanelgendy/lifeOS/issues) for a full list of proposed features and known issues.

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

## 📧 Contact

Ghassan - [@ghassanelgendy](https://github.com/ghassanelgendy)

Project Link: [https://github.com/ghassanelgendy/lifeOS](https://github.com/ghassanelgendy/lifeOS)
