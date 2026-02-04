LifeOS: Master Architectural Product Requirements Document (v1.0)

1\. Project Identity \& Philosophy

App Name: LifeOS



Core Concept: A local-first, privacy-centric "Life Dashboard" for a high-agency individual.



North Star Metric: "Clarity at a Glance." The user should know their physical, academic, and financial standing within 5 seconds of opening the app.



Platform Strategy: Hybrid Monorepo.



Core: React 19 + TypeScript + Vite.



Mobile: CapacitorJS (iOS output).



Desktop: Tauri v2 (Windows .exe output).



2\. Technical Stack (The "Non-Negotiables")

Language: TypeScript (Strict Mode).



Framework: React 19 (Hooks-heavy, no Class components).



Styling: Tailwind CSS v4 (Mobile-first utility classes).



Icons: Lucide React.



State Management:



Global App State: Zustand (for UI state like Sidebar toggle, Modal open).



Data State: TanStack Query (React Query) v5. This is critical for caching local DB results.



Database (The "Backend"):



Wrapper: Kysely (Type-safe SQL query builder).



Engine: sqlite-wasm (Web/Desktop) and capacitor-sqlite (Mobile Native).



Routing: React Router v7.



3\. Data Modules \& Schemas (Agent Context)

Each agent must respect these specific data needs based on the user's profile.



3.1 Module: Bio-Metrics (The "InBody" Engine)

Context: User tracks detailed monthly body composition, not just weight.



Required Fields:



date (ISO String)



weight\_kg (Float)



muscle\_mass\_kg (SMM)



body\_fat\_percent (PBF)



visceral\_fat\_level (Int)



bmr\_kcal (Int)



Visualization: Line charts for Weight vs. Muscle Mass. Table view for month-over-month comparison (Dec vs Jan vs Feb).



3.2 Module: Academic \& Career (The "Deep Work" Engine)

Context: User is managing a Thesis (Supply Chain) and Certification Exams (AWS).



Entity: Projects:



title (e.g., "Supply Chain Optimization")



type (Enum: "Thesis", "Certification", "Coding")



status (Enum: "Active", "Paused", "Done")



Entity: Literature\_Review:



A specific table for the thesis to compare papers.



Fields: paper\_title, methodology (e.g., AHP, TOPSIS), year, key\_finding.



3.3 Module: The Calendar \& Shifts

Context: User tracks standard events + specific work shifts (e.g., "Ghassan Shifts").



Features:



"Shift" events must have a distinct visual tag (e.g., a specific color dot).



Support for recurring events (e.g., "Every Monday until Jan 15").



4\. Design System (The "Calm" UI)

Theme: Dark Mode by default. High contrast text, low contrast backgrounds.



Color Palette:



Background: #09090b (Zinc-950)



Surface: #18181b (Zinc-900)



Accent: #fafafa (Zinc-50) - Used sparingly for active states.



Success: #22c55e (Green-500) - For habit completion.



Typography: Geist Sans or Inter. Tabular nums for data tables.



Layout Behavior:



Mobile: Bottom Tab Navigation. Pull-to-refresh to reload data. Swipe-to-delete on list items.



Desktop: Left Sidebar (Collapsible). Multi-pane dashboard. Keyboard shortcuts (CMD+K for command palette).

