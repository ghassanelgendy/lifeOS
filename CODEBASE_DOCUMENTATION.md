# lifeOS Complete Codebase Documentation

Generated comprehensive documentation covering every source file in the lifeOS project.

## Table of Contents

### .
- [CODEBASE_DOCUMENTATION.md](#codebase-documentation-md)
- [CODEBASE_SRS.md](#codebase-srs-md)
- [PRD.md](#prd-md)
- [README.md](#readme-md)
- [build-docs.js](#build-docs-js)
- [capacitor.config.ts](#capacitor-config-ts)
- [codemagic.yaml](#codemagic-yaml)
- [enhance-docs.js](#enhance-docs-js)
- [eslint.config.js](#eslint-config-js)
- [index.html](#index-html)
- [knip.json](#knip-json)
- [package.json](#package-json)
- [pnpm-lock.yaml](#pnpm-lock-yaml)
- [pnpm-workspace.yaml](#pnpm-workspace-yaml)
- [postcss.config.js](#postcss-config-js)
- [tsconfig.app.json](#tsconfig-app-json)
- [tsconfig.base.json](#tsconfig-base-json)
- [tsconfig.json](#tsconfig-json)
- [tsconfig.node.json](#tsconfig-node-json)
- [vercel.json](#vercel-json)
- [vite.config.ts](#vite-config-ts)
- [vitest.config.ts](#vitest-config-ts)

### .agents
- [.agents/AGENTS.md](#-agents-agents-md)

### .agents/rules
- [.agents/rules/db-optimizer.md](#-agents-rules-db-optimizer-md)

### .github
- [.github/dependabot.yml](#-github-dependabot-yml)

### .github/workflows
- [.github/workflows/backup.yaml](#-github-workflows-backup-yaml)
- [.github/workflows/build-desktop.yml](#-github-workflows-build-desktop-yml)
- [.github/workflows/ci.yml](#-github-workflows-ci-yml)
- [.github/workflows/dependabot-auto-merge.yml](#-github-workflows-dependabot-auto-merge-yml)
- [.github/workflows/ota-deploy.yml](#-github-workflows-ota-deploy-yml)

### .vscode
- [.vscode/tasks.json](#-vscode-tasks-json)

### api
- [api/proxy.ts](#api-proxy-ts)

### api/calendar
- [api/calendar/tasks.ts](#api-calendar-tasks-ts)

### api/cron
- [api/cron/calendar-notifications-dispatch.ts](#api-cron-calendar-notifications-dispatch-ts)
- [api/cron/habit-notifications-dispatch.ts](#api-cron-habit-notifications-dispatch-ts)
- [api/cron/prayer-notifications-dispatch.ts](#api-cron-prayer-notifications-dispatch-ts)
- [api/cron/send-task-reminders.ts](#api-cron-send-task-reminders-ts)

### api/lib
- [api/lib/supabaseServer.ts](#api-lib-supabaseserver-ts)

### docs
- [docs/CRON.md](#docs-cron-md)
- [docs/PRD.md](#docs-prd-md)
- [docs/README.md](#docs-readme-md)

### ios/App/App
- [ios/App/App/capacitor.config.json](#ios-app-app-capacitor-config-json)

### ios/App/App/Assets.xcassets
- [ios/App/App/Assets.xcassets/Contents.json](#ios-app-app-assets-xcassets-contents-json)

### ios/App/App/Assets.xcassets/AppIcon.appiconset
- [ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json](#ios-app-app-assets-xcassets-appicon-appiconset-contents-json)

### ios/App/App/Assets.xcassets/Splash.imageset
- [ios/App/App/Assets.xcassets/Splash.imageset/Contents.json](#ios-app-app-assets-xcassets-splash-imageset-contents-json)

### ios/App/CapApp-SPM
- [ios/App/CapApp-SPM/README.md](#ios-app-capapp-spm-readme-md)

### lib/api-client-react
- [lib/api-client-react/package.json](#lib-api-client-react-package-json)
- [lib/api-client-react/tsconfig.json](#lib-api-client-react-tsconfig-json)

### lib/api-client-react/src
- [lib/api-client-react/src/custom-fetch.ts](#lib-api-client-react-src-custom-fetch-ts)
- [lib/api-client-react/src/index.ts](#lib-api-client-react-src-index-ts)

### lib/api-client-react/src/generated
- [lib/api-client-react/src/generated/api.schemas.ts](#lib-api-client-react-src-generated-api-schemas-ts)
- [lib/api-client-react/src/generated/api.ts](#lib-api-client-react-src-generated-api-ts)

### lib/api-spec
- [lib/api-spec/openapi.yaml](#lib-api-spec-openapi-yaml)
- [lib/api-spec/orval.config.ts](#lib-api-spec-orval-config-ts)
- [lib/api-spec/package.json](#lib-api-spec-package-json)

### lib/api-zod
- [lib/api-zod/package.json](#lib-api-zod-package-json)
- [lib/api-zod/tsconfig.json](#lib-api-zod-tsconfig-json)

### lib/api-zod/src
- [lib/api-zod/src/index.ts](#lib-api-zod-src-index-ts)

### lib/api-zod/src/generated
- [lib/api-zod/src/generated/api.ts](#lib-api-zod-src-generated-api-ts)

### lib/api-zod/src/generated/types
- [lib/api-zod/src/generated/types/healthStatus.ts](#lib-api-zod-src-generated-types-healthstatus-ts)
- [lib/api-zod/src/generated/types/index.ts](#lib-api-zod-src-generated-types-index-ts)

### lib/db
- [lib/db/drizzle.config.ts](#lib-db-drizzle-config-ts)
- [lib/db/package.json](#lib-db-package-json)
- [lib/db/tsconfig.json](#lib-db-tsconfig-json)

### lib/db/src
- [lib/db/src/index.ts](#lib-db-src-index-ts)

### lib/db/src/schema
- [lib/db/src/schema/index.ts](#lib-db-src-schema-index-ts)

### public/ios6-lite
- [public/ios6-lite/index.html](#public-ios6-lite-index-html)
- [public/ios6-lite/legacy-autologin.example.js](#public-ios6-lite-legacy-autologin-example-js)
- [public/ios6-lite/legacy-autologin.js](#public-ios6-lite-legacy-autologin-js)
- [public/ios6-lite/legacy-autologin.local.js](#public-ios6-lite-legacy-autologin-local-js)

### scratch
- [scratch/test-marked-heading.js](#scratch-test-marked-heading-js)
- [scratch/test-marked-instance.js](#scratch-test-marked-instance-js)
- [scratch/test-marked.js](#scratch-test-marked-js)

### scripts
- [scripts/generate-tauri-updater.js](#scripts-generate-tauri-updater-js)
- [scripts/package.json](#scripts-package-json)
- [scripts/pake-inject.js](#scripts-pake-inject-js)
- [scripts/patch-pake-config.js](#scripts-patch-pake-config-js)
- [scripts/tsconfig.json](#scripts-tsconfig-json)

### scripts/src
- [scripts/src/hello.ts](#scripts-src-hello-ts)

### src
- [src/App.css](#src-app-css)
- [src/App.ios.tsx](#src-app-ios-tsx)
- [src/App.test.tsx](#src-app-test-tsx)
- [src/App.tsx](#src-app-tsx)
- [src/App.web.tsx](#src-app-web-tsx)
- [src/index.css](#src-index-css)
- [src/index.ios.css](#src-index-ios-css)
- [src/index.web.css](#src-index-web-css)
- [src/main.tsx](#src-main-tsx)
- [src/setupTests.ts](#src-setuptests-ts)
- [src/sw.ts](#src-sw-ts)

### src/components
- [src/components/AppFooter.ios.tsx](#src-components-appfooter-ios-tsx)
- [src/components/AppFooter.pake.tsx](#src-components-appfooter-pake-tsx)
- [src/components/AppFooter.tsx](#src-components-appfooter-tsx)
- [src/components/AppFooter.web.tsx](#src-components-appfooter-web-tsx)
- [src/components/AppShell.ios.tsx](#src-components-appshell-ios-tsx)
- [src/components/AppShell.pake.tsx](#src-components-appshell-pake-tsx)
- [src/components/AppShell.tsx](#src-components-appshell-tsx)
- [src/components/AppShell.web.tsx](#src-components-appshell-web-tsx)
- [src/components/CommandPalette.tsx](#src-components-commandpalette-tsx)
- [src/components/CompactPrayerHabit.ios.tsx](#src-components-compactprayerhabit-ios-tsx)
- [src/components/CompactPrayerHabit.tsx](#src-components-compactprayerhabit-tsx)
- [src/components/CompactPrayerHabit.web.tsx](#src-components-compactprayerhabit-web-tsx)
- [src/components/DataCard.ios.tsx](#src-components-datacard-ios-tsx)
- [src/components/DataCard.tsx](#src-components-datacard-tsx)
- [src/components/DataCard.web.tsx](#src-components-datacard-web-tsx)
- [src/components/FaviconSync.tsx](#src-components-faviconsync-tsx)
- [src/components/FinanceHeroCard.ios.tsx](#src-components-financeherocard-ios-tsx)
- [src/components/FinanceHeroCard.test.tsx](#src-components-financeherocard-test-tsx)
- [src/components/FinanceHeroCard.tsx](#src-components-financeherocard-tsx)
- [src/components/FinanceHeroCard.web.tsx](#src-components-financeherocard-web-tsx)
- [src/components/FocusPiPWindow.tsx](#src-components-focuspipwindow-tsx)
- [src/components/FocusSessionManager.tsx](#src-components-focussessionmanager-tsx)
- [src/components/KeyboardShortcutsModal.tsx](#src-components-keyboardshortcutsmodal-tsx)
- [src/components/LiquidTabBar.tsx](#src-components-liquidtabbar-tsx)
- [src/components/LoadingScreen.tsx](#src-components-loadingscreen-tsx)
- [src/components/OfflineBanner.tsx](#src-components-offlinebanner-tsx)
- [src/components/PrayerBacklog.ios.tsx](#src-components-prayerbacklog-ios-tsx)
- [src/components/PrayerBacklog.tsx](#src-components-prayerbacklog-tsx)
- [src/components/PrayerBacklog.web.tsx](#src-components-prayerbacklog-web-tsx)
- [src/components/PrayerTimesWidget.tsx](#src-components-prayertimeswidget-tsx)
- [src/components/PullToRefresh.ios.tsx](#src-components-pulltorefresh-ios-tsx)
- [src/components/PullToRefresh.tsx](#src-components-pulltorefresh-tsx)
- [src/components/PullToRefresh.web.tsx](#src-components-pulltorefresh-web-tsx)
- [src/components/SwipeableRow.ios.tsx](#src-components-swipeablerow-ios-tsx)
- [src/components/SwipeableRow.pake.tsx](#src-components-swipeablerow-pake-tsx)
- [src/components/SwipeableRow.tsx](#src-components-swipeablerow-tsx)
- [src/components/SwipeableRow.web.tsx](#src-components-swipeablerow-web-tsx)
- [src/components/TaskDetailsContent.ios.tsx](#src-components-taskdetailscontent-ios-tsx)
- [src/components/TaskDetailsContent.tsx](#src-components-taskdetailscontent-tsx)
- [src/components/TaskDetailsContent.web.tsx](#src-components-taskdetailscontent-web-tsx)
- [src/components/navItems.ts](#src-components-navitems-ts)

### src/components/analytics
- [src/components/analytics/AnalyticsDeepInsights.tsx](#src-components-analytics-analyticsdeepinsights-tsx)
- [src/components/analytics/AnalyticsDigital.tsx](#src-components-analytics-analyticsdigital-tsx)
- [src/components/analytics/AnalyticsHabits.tsx](#src-components-analytics-analyticshabits-tsx)
- [src/components/analytics/AnalyticsHealthWealth.tsx](#src-components-analytics-analyticshealthwealth-tsx)
- [src/components/analytics/AnalyticsOverview.tsx](#src-components-analytics-analyticsoverview-tsx)
- [src/components/analytics/AnalyticsPoints.tsx](#src-components-analytics-analyticspoints-tsx)
- [src/components/analytics/AnalyticsReport.tsx](#src-components-analytics-analyticsreport-tsx)
- [src/components/analytics/AnimatedCounter.tsx](#src-components-analytics-animatedcounter-tsx)
- [src/components/analytics/DayDetailsModal.tsx](#src-components-analytics-daydetailsmodal-tsx)

### src/components/dashboard
- [src/components/dashboard/DashboardAnnualReview.tsx](#src-components-dashboard-dashboardannualreview-tsx)
- [src/components/dashboard/DashboardQuickView.ios.tsx](#src-components-dashboard-dashboardquickview-ios-tsx)
- [src/components/dashboard/DashboardQuickView.pake.tsx](#src-components-dashboard-dashboardquickview-pake-tsx)
- [src/components/dashboard/DashboardQuickView.tsx](#src-components-dashboard-dashboardquickview-tsx)
- [src/components/dashboard/DashboardQuickView.web.tsx](#src-components-dashboard-dashboardquickview-web-tsx)
- [src/components/dashboard/DashboardStrategic.tsx](#src-components-dashboard-dashboardstrategic-tsx)

### src/components/ui
- [src/components/ui/Button.ios.tsx](#src-components-ui-button-ios-tsx)
- [src/components/ui/Button.tsx](#src-components-ui-button-tsx)
- [src/components/ui/Button.web.tsx](#src-components-ui-button-web-tsx)
- [src/components/ui/ConfirmSheet.tsx](#src-components-ui-confirmsheet-tsx)
- [src/components/ui/DetailsSheet.tsx](#src-components-ui-detailssheet-tsx)
- [src/components/ui/Input.tsx](#src-components-ui-input-tsx)
- [src/components/ui/Modal.tsx](#src-components-ui-modal-tsx)
- [src/components/ui/index.ts](#src-components-ui-index-ts)

### src/components/wiki
- [src/components/wiki/WikiGraphView.tsx](#src-components-wiki-wikigraphview-tsx)
- [src/components/wiki/WikiMarkdown.tsx](#src-components-wiki-wikimarkdown-tsx)

### src/contexts
- [src/contexts/AuthContext.tsx](#src-contexts-authcontext-tsx)

### src/db
- [src/db/database.ts](#src-db-database-ts)
- [src/db/indexedDb.ts](#src-db-indexeddb-ts)
- [src/db/seed.ts](#src-db-seed-ts)

### src/hooks
- [src/hooks/useAnalytics.ts](#src-hooks-useanalytics-ts)
- [src/hooks/useCalendar.ts](#src-hooks-usecalendar-ts)
- [src/hooks/useConnectionStatus.ts](#src-hooks-useconnectionstatus-ts)
- [src/hooks/useDashboardUpcomingItems.test.ts](#src-hooks-usedashboardupcomingitems-test-ts)
- [src/hooks/useDashboardUpcomingItems.ts](#src-hooks-usedashboardupcomingitems-ts)
- [src/hooks/useFinance.test.ts](#src-hooks-usefinance-test-ts)
- [src/hooks/useFinance.ts](#src-hooks-usefinance-ts)
- [src/hooks/useHabits.ios.ts](#src-hooks-usehabits-ios-ts)
- [src/hooks/useHabits.ts](#src-hooks-usehabits-ts)
- [src/hooks/useHabits.web.ts](#src-hooks-usehabits-web-ts)
- [src/hooks/useHealthData.ts](#src-hooks-usehealthdata-ts)
- [src/hooks/useIcalSubscriptions.ts](#src-hooks-useicalsubscriptions-ts)
- [src/hooks/useInvestments.test.ts](#src-hooks-useinvestments-test-ts)
- [src/hooks/useInvestments.ts](#src-hooks-useinvestments-ts)
- [src/hooks/useNativeInteraction.ts](#src-hooks-usenativeinteraction-ts)
- [src/hooks/useNativeLocalNotifications.ts](#src-hooks-usenativelocalnotifications-ts)
- [src/hooks/useNotes.ts](#src-hooks-usenotes-ts)
- [src/hooks/usePakeLocalNotifications.ts](#src-hooks-usepakelocalnotifications-ts)
- [src/hooks/usePoints.ts](#src-hooks-usepoints-ts)
- [src/hooks/usePrayerHabits.ios.ts](#src-hooks-useprayerhabits-ios-ts)
- [src/hooks/usePrayerHabits.ts](#src-hooks-useprayerhabits-ts)
- [src/hooks/usePrayerHabits.web.ts](#src-hooks-useprayerhabits-web-ts)
- [src/hooks/usePrayerTimes.ts](#src-hooks-useprayertimes-ts)
- [src/hooks/usePushNotifications.ios.ts](#src-hooks-usepushnotifications-ios-ts)
- [src/hooks/usePushNotifications.pake.ts](#src-hooks-usepushnotifications-pake-ts)
- [src/hooks/usePushNotifications.ts](#src-hooks-usepushnotifications-ts)
- [src/hooks/usePushNotifications.web.ts](#src-hooks-usepushnotifications-web-ts)
- [src/hooks/useReport.test.ts](#src-hooks-usereport-test-ts)
- [src/hooks/useReport.ts](#src-hooks-usereport-ts)
- [src/hooks/useScreentime.ts](#src-hooks-usescreentime-ts)
- [src/hooks/useSleep.ts](#src-hooks-usesleep-ts)
- [src/hooks/useSyncStatus.ts](#src-hooks-usesyncstatus-ts)
- [src/hooks/useTaskCalendarFeed.ts](#src-hooks-usetaskcalendarfeed-ts)
- [src/hooks/useTasks.ios.ts](#src-hooks-usetasks-ios-ts)
- [src/hooks/useTasks.ts](#src-hooks-usetasks-ts)
- [src/hooks/useTasks.web.ts](#src-hooks-usetasks-web-ts)
- [src/hooks/useUserAppSettingsSync.ts](#src-hooks-useuserappsettingssync-ts)
- [src/hooks/useUserBanks.ts](#src-hooks-useuserbanks-ts)

### src/lib
- [src/lib/ai.ts](#src-lib-ai-ts)
- [src/lib/analytics-utils.ts](#src-lib-analytics-utils-ts)
- [src/lib/calendarExport.ts](#src-lib-calendarexport-ts)
- [src/lib/focusSessionEvents.ts](#src-lib-focussessionevents-ts)
- [src/lib/icalSubscribe.ts](#src-lib-icalsubscribe-ts)
- [src/lib/listIdFromTagIds.ts](#src-lib-listidfromtagids-ts)
- [src/lib/logger.ts](#src-lib-logger-ts)
- [src/lib/nativeBridge.ts](#src-lib-nativebridge-ts)
- [src/lib/offlineSync.ts](#src-lib-offlinesync-ts)
- [src/lib/otaUpdater.ts](#src-lib-otaupdater-ts)
- [src/lib/prayerGeocoding.ts](#src-lib-prayergeocoding-ts)
- [src/lib/prayerStatus.test.ts](#src-lib-prayerstatus-test-ts)
- [src/lib/prayerStatus.ts](#src-lib-prayerstatus-ts)
- [src/lib/push.ts](#src-lib-push-ts)
- [src/lib/queryClient.ts](#src-lib-queryclient-ts)
- [src/lib/reportSuggestions.ts](#src-lib-reportsuggestions-ts)
- [src/lib/screentimePlatform.ts](#src-lib-screentimeplatform-ts)
- [src/lib/supabase.ts](#src-lib-supabase-ts)
- [src/lib/taskInputSuggestions.ts](#src-lib-taskinputsuggestions-ts)
- [src/lib/userAppSettings.ts](#src-lib-userappsettings-ts)
- [src/lib/utils.test.ts](#src-lib-utils-test-ts)
- [src/lib/utils.ts](#src-lib-utils-ts)
- [src/lib/wikiData.ts](#src-lib-wikidata-ts)
- [src/lib/wikiStorage.ts](#src-lib-wikistorage-ts)
- [src/lib/wrapHelpers.ts](#src-lib-wraphelpers-ts)

### src/routes
- [src/routes/Analytics.tsx](#src-routes-analytics-tsx)
- [src/routes/Calendar.ios.tsx](#src-routes-calendar-ios-tsx)
- [src/routes/Calendar.pake.tsx](#src-routes-calendar-pake-tsx)
- [src/routes/Calendar.tsx](#src-routes-calendar-tsx)
- [src/routes/Calendar.web.tsx](#src-routes-calendar-web-tsx)
- [src/routes/Dashboard.tsx](#src-routes-dashboard-tsx)
- [src/routes/Finance.ios.tsx](#src-routes-finance-ios-tsx)
- [src/routes/Finance.pake.tsx](#src-routes-finance-pake-tsx)
- [src/routes/Finance.tsx](#src-routes-finance-tsx)
- [src/routes/Finance.web.tsx](#src-routes-finance-web-tsx)
- [src/routes/Focus.tsx](#src-routes-focus-tsx)
- [src/routes/Habits.ios.tsx](#src-routes-habits-ios-tsx)
- [src/routes/Habits.pake.tsx](#src-routes-habits-pake-tsx)
- [src/routes/Habits.tsx](#src-routes-habits-tsx)
- [src/routes/Habits.web.tsx](#src-routes-habits-web-tsx)
- [src/routes/Health.tsx](#src-routes-health-tsx)
- [src/routes/Landing.tsx](#src-routes-landing-tsx)
- [src/routes/Login.tsx](#src-routes-login-tsx)
- [src/routes/Notes.tsx](#src-routes-notes-tsx)
- [src/routes/Points.tsx](#src-routes-points-tsx)
- [src/routes/Screentime.ios.tsx](#src-routes-screentime-ios-tsx)
- [src/routes/Screentime.tsx](#src-routes-screentime-tsx)
- [src/routes/Screentime.web.tsx](#src-routes-screentime-web-tsx)
- [src/routes/Settings.ios.tsx](#src-routes-settings-ios-tsx)
- [src/routes/Settings.tsx](#src-routes-settings-tsx)
- [src/routes/Settings.web.tsx](#src-routes-settings-web-tsx)
- [src/routes/Signup.tsx](#src-routes-signup-tsx)
- [src/routes/Sleep.ios.tsx](#src-routes-sleep-ios-tsx)
- [src/routes/Sleep.pake.tsx](#src-routes-sleep-pake-tsx)
- [src/routes/Sleep.tsx](#src-routes-sleep-tsx)
- [src/routes/Sleep.web.tsx](#src-routes-sleep-web-tsx)
- [src/routes/Tasks.ios.tsx](#src-routes-tasks-ios-tsx)
- [src/routes/Tasks.pake.tsx](#src-routes-tasks-pake-tsx)
- [src/routes/Tasks.tsx](#src-routes-tasks-tsx)
- [src/routes/Tasks.web.tsx](#src-routes-tasks-web-tsx)
- [src/routes/WeeklyPlanner.tsx](#src-routes-weeklyplanner-tsx)
- [src/routes/Wiki.tsx](#src-routes-wiki-tsx)

### src/stores
- [src/stores/useFocusSessionStore.ts](#src-stores-usefocussessionstore-ts)
- [src/stores/useUIStore.ts](#src-stores-useuistore-ts)
- [src/stores/useWikiStore.ts](#src-stores-usewikistore-ts)

### src/types
- [src/types/schema.ts](#src-types-schema-ts)
- [src/types/wiki.ts](#src-types-wiki-ts)

### supabase
- [supabase/config.toml](#supabase-config-toml)
- [supabase/supabase_logs (1).json](#supabase-supabase-logs--1--json)

### supabase/.temp
- [supabase/.temp/linked-project.json](#supabase--temp-linked-project-json)

### supabase/functions
- [supabase/functions/deno.d.ts](#supabase-functions-deno-d-ts)
- [supabase/functions/tsconfig.json](#supabase-functions-tsconfig-json)

### supabase/functions/calendar-feed
- [supabase/functions/calendar-feed/index.ts](#supabase-functions-calendar-feed-index-ts)

### supabase/functions/calendar-notifications-dispatch
- [supabase/functions/calendar-notifications-dispatch/index.ts](#supabase-functions-calendar-notifications-dispatch-index-ts)

### supabase/functions/habit-notifications-dispatch
- [supabase/functions/habit-notifications-dispatch/index.ts](#supabase-functions-habit-notifications-dispatch-index-ts)

### supabase/functions/prayer-notifications-dispatch
- [supabase/functions/prayer-notifications-dispatch/index.ts](#supabase-functions-prayer-notifications-dispatch-index-ts)

### supabase/functions/process-sms
- [supabase/functions/process-sms/index.ts](#supabase-functions-process-sms-index-ts)
- [supabase/functions/process-sms/parser.ts](#supabase-functions-process-sms-parser-ts)

### supabase/functions/report-notification-dispatch
- [supabase/functions/report-notification-dispatch/index.ts](#supabase-functions-report-notification-dispatch-index-ts)

### supabase/functions/send-task-reminders
- [supabase/functions/send-task-reminders/index.ts](#supabase-functions-send-task-reminders-index-ts)

### supabase/functions/send-test-notification
- [supabase/functions/send-test-notification/index.ts](#supabase-functions-send-test-notification-index-ts)

### supabase/functions/sync-inbody
- [supabase/functions/sync-inbody/config.toml](#supabase-functions-sync-inbody-config-toml)
- [supabase/functions/sync-inbody/index.ts](#supabase-functions-sync-inbody-index-ts)

### supabase/functions/sync-reminders
- [supabase/functions/sync-reminders/index.ts](#supabase-functions-sync-reminders-index-ts)

### supabase/functions/upload-screentime
- [supabase/functions/upload-screentime/index.ts](#supabase-functions-upload-screentime-index-ts)

### supabase/functions/upload-screentime-chronos
- [supabase/functions/upload-screentime-chronos/index.ts](#supabase-functions-upload-screentime-chronos-index-ts)

### supabase/functions/upload-sleep
- [supabase/functions/upload-sleep/index.ts](#supabase-functions-upload-sleep-index-ts)

<a name="-agents-agents-md"></a>
### .agents/AGENTS.md

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (Markdown documentation)

**Lines:** 5

---

<a name="-agents-rules-db-optimizer-md"></a>
### .agents/rules/db-optimizer.md

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (Markdown documentation)

**Lines:** 172

---

<a name="-github-dependabot-yml"></a>
### .github/dependabot.yml

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration file)

**Lines:** 29

---

<a name="-github-workflows-backup-yaml"></a>
### .github/workflows/backup.yaml

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration file)

**Lines:** 91

---

<a name="-github-workflows-build-desktop-yml"></a>
### .github/workflows/build-desktop.yml

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration file)

**Lines:** 210

---

<a name="-github-workflows-ci-yml"></a>
### .github/workflows/ci.yml

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration file)

**Lines:** 114

---

<a name="-github-workflows-dependabot-auto-merge-yml"></a>
### .github/workflows/dependabot-auto-merge.yml

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration file)

**Lines:** 31

---

<a name="-github-workflows-ota-deploy-yml"></a>
### .github/workflows/ota-deploy.yml

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration file)

**Lines:** 148

---

<a name="-vscode-tasks-json"></a>
### .vscode/tasks.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 22

---

<a name="codebase-documentation-md"></a>
### CODEBASE_DOCUMENTATION.md

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (Markdown documentation)

**Lines:** 5883

---

<a name="codebase-srs-md"></a>
### CODEBASE_SRS.md

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (Markdown documentation)

**Lines:** 1065

---

<a name="prd-md"></a>
### PRD.md

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (Markdown documentation)

**Lines:** 832

---

<a name="readme-md"></a>
### README.md

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (Markdown documentation)

**Lines:** 127

---

<a name="api-calendar-tasks-ts"></a>
### api/calendar/tasks.ts

**File Purpose:** Vercel serverless API route. Handles server-side logic for API endpoints.

**Functions & Classes:**
- `normalizeQueryValue` (Function)
- `isValidToken` (Function)
- `sanitizeTimeZone` (Function)
- `escapeText` (Function)
- `sanitizeUrl` (Function)
- `formatUtcStamp` (Function)
- `parseDateParts` (Function)
- `parseTimeParts` (Function)
- `formatDateValue` (Function)
- `formatUtcDateTime` (Function)
- `formatLocalDateOnly` (Function)
- `getTimeZoneOffsetMs` (Function)
- `zonedDateTimeToUtc` (Function)
- `getTaskDateTimes` (Function)
- `foldLine` (Function)

**Function Details:**
- **`normalizeQueryValue`** — Utility function for normalize query value.
- **`isValidToken`** — Utility function for is valid token.
- **`sanitizeTimeZone`** — Utility function for sanitize time zone.
- **`escapeText`** — Utility function for escape text.
- **`sanitizeUrl`** — Utility function for sanitize url.

**Lines:** 434

---

<a name="api-cron-calendar-notifications-dispatch-ts"></a>
### api/cron/calendar-notifications-dispatch.ts

**File Purpose:** Vercel serverless API route. Handles server-side logic for API endpoints.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 46

---

<a name="api-cron-habit-notifications-dispatch-ts"></a>
### api/cron/habit-notifications-dispatch.ts

**File Purpose:** Vercel serverless API route. Handles server-side logic for API endpoints.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 46

---

<a name="api-cron-prayer-notifications-dispatch-ts"></a>
### api/cron/prayer-notifications-dispatch.ts

**File Purpose:** Vercel serverless API route. Handles server-side logic for API endpoints.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 46

---

<a name="api-cron-send-task-reminders-ts"></a>
### api/cron/send-task-reminders.ts

**File Purpose:** Vercel serverless API route. Handles server-side logic for API endpoints.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 47

---

<a name="api-lib-supabaseserver-ts"></a>
### api/lib/supabaseServer.ts

**File Purpose:** Vercel serverless API route. Handles server-side logic for API endpoints.

**Functions & Classes:**
- `getSupabaseAnon` (Function)
- `getSupabaseService` (Function)

**Function Details:**
- **`getSupabaseAnon`** — Utility function for get supabase anon.
- **`getSupabaseService`** — Utility function for get supabase service.

**Lines:** 39

---

<a name="api-proxy-ts"></a>
### api/proxy.ts

**File Purpose:** Vercel serverless API route. Handles server-side logic for API endpoints.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 64

---

<a name="build-docs-js"></a>
### build-docs.js

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `shouldInclude` (Function)
- `analyzeJSContent` (Function)
- `analyzeCSSContent` (Function)
- `getFilePurpose` (Function)
- `generateFileDoc` (Function)

**Function Details:**
- **`shouldInclude`** — Utility function for should include.
- **`analyzeJSContent`** — Utility function for analyze j s content.
- **`analyzeCSSContent`** — Utility function for analyze c s s content.
- **`getFilePurpose`** — Utility function for get file purpose.
- **`generateFileDoc`** — Utility function for generate file doc.

**Lines:** 395

---

<a name="capacitor-config-ts"></a>
### capacitor.config.ts

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 34

---

<a name="codemagic-yaml"></a>
### codemagic.yaml

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration file)

**Lines:** 55

---

<a name="docs-cron-md"></a>
### docs/CRON.md

**File Purpose:** Project documentation. Markdown files describing architecture, requirements, or operational procedures.

**Functions & Classes:** None (Markdown documentation)

**Lines:** 96

---

<a name="docs-prd-md"></a>
### docs/PRD.md

**File Purpose:** Project documentation. Markdown files describing architecture, requirements, or operational procedures.

**Functions & Classes:** None (Markdown documentation)

**Lines:** 828

---

<a name="docs-readme-md"></a>
### docs/README.md

**File Purpose:** Project documentation. Markdown files describing architecture, requirements, or operational procedures.

**Functions & Classes:** None (Markdown documentation)

**Lines:** 36

---

<a name="enhance-docs-js"></a>
### enhance-docs.js

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 422

---

<a name="eslint-config-js"></a>
### eslint.config.js

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 48

---

<a name="index-html"></a>
### index.html

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration file)

**Lines:** 44

---

<a name="ios-app-app-assets-xcassets-appicon-appiconset-contents-json"></a>
### ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 14

---

<a name="ios-app-app-assets-xcassets-contents-json"></a>
### ios/App/App/Assets.xcassets/Contents.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 6

---

<a name="ios-app-app-assets-xcassets-splash-imageset-contents-json"></a>
### ios/App/App/Assets.xcassets/Splash.imageset/Contents.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 23

---

<a name="ios-app-app-capacitor-config-json"></a>
### ios/App/App/capacitor.config.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 44

---

<a name="ios-app-capapp-spm-readme-md"></a>
### ios/App/CapApp-SPM/README.md

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (Markdown documentation)

**Lines:** 6

---

<a name="knip-json"></a>
### knip.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 28

---

<a name="lib-api-client-react-package-json"></a>
### lib/api-client-react/package.json

**File Purpose:** Workspace package: API client for React. Auto-generated or custom fetch wrappers for API consumption.

**Functions & Classes:** None (JSON data/config)

**Lines:** 16

---

<a name="lib-api-client-react-src-custom-fetch-ts"></a>
### lib/api-client-react/src/custom-fetch.ts

**File Purpose:** Workspace package: API client for React. Auto-generated or custom fetch wrappers for API consumption.

**Functions & Classes:**
- `setBaseUrl` (Function)
- `setAuthTokenGetter` (Function)
- `isRequest` (Function)
- `resolveMethod` (Function)
- `isUrl` (Function)
- `applyBaseUrl` (Function)
- `resolveUrl` (Function)
- `mergeHeaders` (Function)
- `getMediaType` (Function)
- `isJsonMediaType` (Function)
- `isTextMediaType` (Function)
- `hasNoBody` (Function)
- `stripBom` (Function)
- `looksLikeJson` (Function)
- `getStringField` (Function)
- `ApiError` (Class)
- `ResponseParseError` (Class)
- `CustomFetchOptions` (Type)
- `ErrorType` (Type)
- `BodyType` (Type)
- `AuthTokenGetter` (Type)

**Function Details:**
- **`setBaseUrl`** — Utility function for set base url.
- **`setAuthTokenGetter`** — Utility function for set auth token getter.
- **`isRequest`** — Utility function for is request.
- **`resolveMethod`** — Utility function for resolve method.
- **`isUrl`** — Utility function for is url.

**Lines:** 372

---

<a name="lib-api-client-react-src-generated-api-schemas-ts"></a>
### lib/api-client-react/src/generated/api.schemas.ts

**File Purpose:** Workspace package: API client for React. Auto-generated or custom fetch wrappers for API consumption.

**Functions & Classes:**
- `HealthStatus` (Interface)

**Lines:** 11

---

<a name="lib-api-client-react-src-generated-api-ts"></a>
### lib/api-client-react/src/generated/api.ts

**File Purpose:** Workspace package: API client for React. Auto-generated or custom fetch wrappers for API consumption.

**Functions & Classes:**
- `useHealthCheck` (React Hook)
- `useHealthCheck` (Function)
- `HealthCheckQueryResult` (Type)
- `HealthCheckQueryError` (Type)

**Function Details:**
- **`useHealthCheck`** — Custom React hook managing healthcheck state and side effects.
- **`useHealthCheck`** — Utility function for use health check.

**Lines:** 102

---

<a name="lib-api-client-react-src-index-ts"></a>
### lib/api-client-react/src/index.ts

**File Purpose:** Workspace package: API client for React. Auto-generated or custom fetch wrappers for API consumption.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 5

---

<a name="lib-api-client-react-tsconfig-json"></a>
### lib/api-client-react/tsconfig.json

**File Purpose:** Workspace package: API client for React. Auto-generated or custom fetch wrappers for API consumption.

**Functions & Classes:** None (JSON data/config)

**Lines:** 13

---

<a name="lib-api-spec-openapi-yaml"></a>
### lib/api-spec/openapi.yaml

**File Purpose:** Workspace package: API specification. OpenAPI schema and code generation configuration.

**Functions & Classes:** None (configuration file)

**Lines:** 37

---

<a name="lib-api-spec-orval-config-ts"></a>
### lib/api-spec/orval.config.ts

**File Purpose:** Workspace package: API specification. OpenAPI schema and code generation configuration.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 73

---

<a name="lib-api-spec-package-json"></a>
### lib/api-spec/package.json

**File Purpose:** Workspace package: API specification. OpenAPI schema and code generation configuration.

**Functions & Classes:** None (JSON data/config)

**Lines:** 12

---

<a name="lib-api-zod-package-json"></a>
### lib/api-zod/package.json

**File Purpose:** Workspace package: Zod-validated API types. Runtime type validation schemas for API contracts.

**Functions & Classes:** None (JSON data/config)

**Lines:** 13

---

<a name="lib-api-zod-src-generated-api-ts"></a>
### lib/api-zod/src/generated/api.ts

**File Purpose:** Workspace package: Zod-validated API types. Runtime type validation schemas for API contracts.

**Functions & Classes:**
- `HealthCheckResponse` (React Component)

**Function Details:**
- **`HealthCheckResponse`** — React component rendering UI for HealthCheckResponse.

**Lines:** 17

---

<a name="lib-api-zod-src-generated-types-healthstatus-ts"></a>
### lib/api-zod/src/generated/types/healthStatus.ts

**File Purpose:** Workspace package: Zod-validated API types. Runtime type validation schemas for API contracts.

**Functions & Classes:**
- `HealthStatus` (Interface)

**Lines:** 12

---

<a name="lib-api-zod-src-generated-types-index-ts"></a>
### lib/api-zod/src/generated/types/index.ts

**File Purpose:** Workspace package: Zod-validated API types. Runtime type validation schemas for API contracts.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 10

---

<a name="lib-api-zod-src-index-ts"></a>
### lib/api-zod/src/index.ts

**File Purpose:** Workspace package: Zod-validated API types. Runtime type validation schemas for API contracts.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 3

---

<a name="lib-api-zod-tsconfig-json"></a>
### lib/api-zod/tsconfig.json

**File Purpose:** Workspace package: Zod-validated API types. Runtime type validation schemas for API contracts.

**Functions & Classes:** None (JSON data/config)

**Lines:** 12

---

<a name="lib-db-drizzle-config-ts"></a>
### lib/db/drizzle.config.ts

**File Purpose:** Workspace package: Database schema and Drizzle ORM configuration for type-safe database access.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 15

---

<a name="lib-db-package-json"></a>
### lib/db/package.json

**File Purpose:** Workspace package: Database schema and Drizzle ORM configuration for type-safe database access.

**Functions & Classes:** None (JSON data/config)

**Lines:** 26

---

<a name="lib-db-src-index-ts"></a>
### lib/db/src/index.ts

**File Purpose:** Workspace package: Database schema and Drizzle ORM configuration for type-safe database access.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 17

---

<a name="lib-db-src-schema-index-ts"></a>
### lib/db/src/schema/index.ts

**File Purpose:** Workspace package: Database schema and Drizzle ORM configuration for type-safe database access.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 20

---

<a name="lib-db-tsconfig-json"></a>
### lib/db/tsconfig.json

**File Purpose:** Workspace package: Database schema and Drizzle ORM configuration for type-safe database access.

**Functions & Classes:** None (JSON data/config)

**Lines:** 13

---

<a name="package-json"></a>
### package.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 125

---

<a name="pnpm-lock-yaml"></a>
### pnpm-lock.yaml

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration file)

**Lines:** 12842

---

<a name="pnpm-workspace-yaml"></a>
### pnpm-workspace.yaml

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration file)

**Lines:** 120

---

<a name="postcss-config-js"></a>
### postcss.config.js

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 6

---

<a name="public-ios6-lite-index-html"></a>
### public/ios6-lite/index.html

**File Purpose:** Static asset. Served directly without bundling. Included in the built application.

**Functions & Classes:** None (configuration file)

**Lines:** 2492

---

<a name="public-ios6-lite-legacy-autologin-example-js"></a>
### public/ios6-lite/legacy-autologin.example.js

**File Purpose:** Static asset. Served directly without bundling. Included in the built application.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 11

---

<a name="public-ios6-lite-legacy-autologin-js"></a>
### public/ios6-lite/legacy-autologin.js

**File Purpose:** Static asset. Served directly without bundling. Included in the built application.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 6

---

<a name="public-ios6-lite-legacy-autologin-local-js"></a>
### public/ios6-lite/legacy-autologin.local.js

**File Purpose:** Static asset. Served directly without bundling. Included in the built application.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 7

---

<a name="scratch-test-marked-heading-js"></a>
### scratch/test-marked-heading.js

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 22

---

<a name="scratch-test-marked-instance-js"></a>
### scratch/test-marked-instance.js

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `wikiLinkExtension` (Function)

**Function Details:**
- **`wikiLinkExtension`** — Utility function for wiki link extension.

**Lines:** 47

---

<a name="scratch-test-marked-js"></a>
### scratch/test-marked.js

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `wikiLinkExtension` (Function)

**Function Details:**
- **`wikiLinkExtension`** — Utility function for wiki link extension.

**Lines:** 33

---

<a name="scripts-generate-tauri-updater-js"></a>
### scripts/generate-tauri-updater.js

**File Purpose:** Build/utility script. Automates development tasks, icon generation, or deployment procedures.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 71

---

<a name="scripts-package-json"></a>
### scripts/package.json

**File Purpose:** Build/utility script. Automates development tasks, icon generation, or deployment procedures.

**Functions & Classes:** None (JSON data/config)

**Lines:** 15

---

<a name="scripts-pake-inject-js"></a>
### scripts/pake-inject.js

**File Purpose:** Build/utility script. Automates development tasks, icon generation, or deployment procedures.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 3

---

<a name="scripts-patch-pake-config-js"></a>
### scripts/patch-pake-config.js

**File Purpose:** Build/utility script. Automates development tasks, icon generation, or deployment procedures.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 57

---

<a name="scripts-src-hello-ts"></a>
### scripts/src/hello.ts

**File Purpose:** Build/utility script. Automates development tasks, icon generation, or deployment procedures.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="scripts-tsconfig-json"></a>
### scripts/tsconfig.json

**File Purpose:** Build/utility script. Automates development tasks, icon generation, or deployment procedures.

**Functions & Classes:** None (JSON data/config)

**Lines:** 10

---

<a name="src-app-css"></a>
### src/App.css

**File Purpose:** Stylesheet. Provides CSS rules, animations, and theming for the application.

**Keyframes:**
- `@keyframes task-enter` — CSS animation definition
- `@keyframes checkmark-draw` — CSS animation definition

**CSS Classes/Selectors:** task-item, task-checkmark, task-checkmark__check, wiki-link, wiki-markdown, wiki-graph-canvas

**Lines:** 187

---

<a name="src-app-ios-tsx"></a>
### src/App.ios.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `ProtectedRoute` (React Component)
- `RequireGuest` (React Component)
- `UserAppSettingsBridge` (React Component)
- `ThemeSync` (React Component)
- `AppInner` (React Component)
- `App` (React Component)
- `ProtectedRoute` (Function)
- `RequireGuest` (Function)
- `UserAppSettingsBridge` (Function)
- `ThemeSync` (Function)
- `AppInner` (Function)
- `App` (Function)

**Function Details:**
- **`ProtectedRoute`** — React component rendering UI for ProtectedRoute.
- **`RequireGuest`** — React component rendering UI for RequireGuest.
- **`UserAppSettingsBridge`** — React component rendering UI for UserAppSettingsBridge.
- **`ThemeSync`** — React component rendering UI for ThemeSync.
- **`AppInner`** — React component rendering UI for AppInner.
- **`ProtectedRoute`** — Utility function for protected route.
- **`RequireGuest`** — Utility function for require guest.
- **`UserAppSettingsBridge`** — Utility function for user app settings bridge.
- **`ThemeSync`** — Utility function for theme sync.
- **`AppInner`** — Utility function for app inner.

**Lines:** 375

---

<a name="src-app-test-tsx"></a>
### src/App.test.tsx

**File Purpose:** Unit/integration tests for the corresponding implementation file.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 9

---

<a name="src-app-tsx"></a>
### src/App.tsx

**File Purpose:** Platform abstraction entry point. Delegates to platform-specific App implementation (web, iOS, or pake) via Vite's platform-resolve plugin.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 3

---

<a name="src-app-web-tsx"></a>
### src/App.web.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `ProtectedRoute` (React Component)
- `RequireGuest` (React Component)
- `PublicHome` (React Component)
- `UserAppSettingsBridge` (React Component)
- `ThemeSync` (React Component)
- `AppInner` (React Component)
- `App` (React Component)
- `ProtectedRoute` (Function)
- `RequireGuest` (Function)
- `PublicHome` (Function)
- `UserAppSettingsBridge` (Function)
- `ThemeSync` (Function)
- `AppInner` (Function)
- `App` (Function)

**Function Details:**
- **`ProtectedRoute`** — React component rendering UI for ProtectedRoute.
- **`RequireGuest`** — React component rendering UI for RequireGuest.
- **`PublicHome`** — React component rendering UI for PublicHome.
- **`UserAppSettingsBridge`** — React component rendering UI for UserAppSettingsBridge.
- **`ThemeSync`** — React component rendering UI for ThemeSync.
- **`ProtectedRoute`** — Utility function for protected route.
- **`RequireGuest`** — Utility function for require guest.
- **`PublicHome`** — Utility function for public home.
- **`UserAppSettingsBridge`** — Utility function for user app settings bridge.
- **`ThemeSync`** — Utility function for theme sync.

**Lines:** 307

---

<a name="src-components-appfooter-ios-tsx"></a>
### src/components/AppFooter.ios.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `AppFooter` (Function)

**Function Details:**
- **`AppFooter`** — Utility function for app footer.

**Lines:** 60

---

<a name="src-components-appfooter-pake-tsx"></a>
### src/components/AppFooter.pake.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `AppFooter` (Function)

**Function Details:**
- **`AppFooter`** — Utility function for app footer.

**Lines:** 62

---

<a name="src-components-appfooter-tsx"></a>
### src/components/AppFooter.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-components-appfooter-web-tsx"></a>
### src/components/AppFooter.web.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `AppFooter` (Function)

**Function Details:**
- **`AppFooter`** — Utility function for app footer.

**Lines:** 56

---

<a name="src-components-appshell-ios-tsx"></a>
### src/components/AppShell.ios.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `MobileNavLink` (React Component)
- `MobileNavLink` (Function)
- `AppShell` (Function)

**Function Details:**
- **`MobileNavLink`** — React component rendering UI for MobileNavLink.
- **`MobileNavLink`** — Utility function for mobile nav link.
- **`AppShell`** — Utility function for app shell.

**Lines:** 683

---

<a name="src-components-appshell-pake-tsx"></a>
### src/components/AppShell.pake.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `MobileNavLink` (React Component)
- `MobileNavLink` (Function)
- `AppShell` (Function)

**Function Details:**
- **`MobileNavLink`** — React component rendering UI for MobileNavLink.
- **`MobileNavLink`** — Utility function for mobile nav link.
- **`AppShell`** — Utility function for app shell.

**Lines:** 491

---

<a name="src-components-appshell-tsx"></a>
### src/components/AppShell.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-components-appshell-web-tsx"></a>
### src/components/AppShell.web.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `MobileNavLink` (React Component)
- `MobileNavLink` (Function)
- `AppShell` (Function)

**Function Details:**
- **`MobileNavLink`** — React component rendering UI for MobileNavLink.
- **`MobileNavLink`** — Utility function for mobile nav link.
- **`AppShell`** — Utility function for app shell.

**Lines:** 640

---

<a name="src-components-commandpalette-tsx"></a>
### src/components/CommandPalette.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `CommandPalette` (Function)

**Function Details:**
- **`CommandPalette`** — Utility function for command palette.

**Lines:** 228

---

<a name="src-components-compactprayerhabit-ios-tsx"></a>
### src/components/CompactPrayerHabit.ios.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `CompactPrayerHabit` (Function)

**Function Details:**
- **`CompactPrayerHabit`** — Utility function for compact prayer habit.

**Lines:** 144

---

<a name="src-components-compactprayerhabit-tsx"></a>
### src/components/CompactPrayerHabit.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-components-compactprayerhabit-web-tsx"></a>
### src/components/CompactPrayerHabit.web.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `CompactPrayerHabit` (Function)

**Function Details:**
- **`CompactPrayerHabit`** — Utility function for compact prayer habit.

**Lines:** 156

---

<a name="src-components-datacard-ios-tsx"></a>
### src/components/DataCard.ios.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `DataCard` (Function)

**Function Details:**
- **`DataCard`** — Utility function for data card.

**Lines:** 69

---

<a name="src-components-datacard-tsx"></a>
### src/components/DataCard.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-components-datacard-web-tsx"></a>
### src/components/DataCard.web.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `DataCard` (Function)

**Function Details:**
- **`DataCard`** — Utility function for data card.

**Lines:** 69

---

<a name="src-components-faviconsync-tsx"></a>
### src/components/FaviconSync.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `getFaviconFolder` (Function)
- `FaviconSync` (Function)

**Function Details:**
- **`getFaviconFolder`** — Utility function for get favicon folder.
- **`FaviconSync`** — Utility function for favicon sync.

**Lines:** 48

---

<a name="src-components-financeherocard-ios-tsx"></a>
### src/components/FinanceHeroCard.ios.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `FinanceHeroCard` (Function)

**Function Details:**
- **`FinanceHeroCard`** — Utility function for finance hero card.

**Lines:** 115

---

<a name="src-components-financeherocard-test-tsx"></a>
### src/components/FinanceHeroCard.test.tsx

**File Purpose:** Unit/integration tests for the corresponding implementation file.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 64

---

<a name="src-components-financeherocard-tsx"></a>
### src/components/FinanceHeroCard.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-components-financeherocard-web-tsx"></a>
### src/components/FinanceHeroCard.web.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `FinanceHeroCard` (Function)

**Function Details:**
- **`FinanceHeroCard`** — Utility function for finance hero card.

**Lines:** 116

---

<a name="src-components-focuspipwindow-tsx"></a>
### src/components/FocusPiPWindow.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `FocusPiPWindow` (Function)

**Function Details:**
- **`FocusPiPWindow`** — Utility function for focus pi p window.

**Lines:** 364

---

<a name="src-components-focussessionmanager-tsx"></a>
### src/components/FocusSessionManager.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `FocusSessionManager` (Function)

**Function Details:**
- **`FocusSessionManager`** — Utility function for focus session manager.

**Lines:** 136

---

<a name="src-components-keyboardshortcutsmodal-tsx"></a>
### src/components/KeyboardShortcutsModal.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `Kbd` (React Component)
- `ShortcutRow` (React Component)
- `Kbd` (Function)
- `ShortcutRow` (Function)
- `KeyboardShortcutsModal` (Function)

**Function Details:**
- **`Kbd`** — React component rendering UI for Kbd.
- **`ShortcutRow`** — React component rendering UI for ShortcutRow.
- **`Kbd`** — Utility function for kbd.
- **`ShortcutRow`** — Utility function for shortcut row.
- **`KeyboardShortcutsModal`** — Utility function for keyboard shortcuts modal.

**Lines:** 147

---

<a name="src-components-liquidtabbar-tsx"></a>
### src/components/LiquidTabBar.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `LiquidTabBar` (React Component)
- `LiquidTabBar` (Function)
- `LiquidTab` (Interface)

**Function Details:**
- **`LiquidTabBar`** — React component rendering UI for LiquidTabBar.
- **`LiquidTabBar`** — Utility function for liquid tab bar.

**Lines:** 172

---

<a name="src-components-loadingscreen-tsx"></a>
### src/components/LoadingScreen.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `LoadingScreen` (Function)

**Function Details:**
- **`LoadingScreen`** — Utility function for loading screen.

**Lines:** 27

---

<a name="src-components-offlinebanner-tsx"></a>
### src/components/OfflineBanner.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `OfflineBanner` (Function)

**Function Details:**
- **`OfflineBanner`** — Utility function for offline banner.

**Lines:** 48

---

<a name="src-components-prayerbacklog-ios-tsx"></a>
### src/components/PrayerBacklog.ios.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `toDateOnly` (Function)
- `PrayerBacklog` (Function)

**Function Details:**
- **`toDateOnly`** — Utility function for to date only.
- **`PrayerBacklog`** — Utility function for prayer backlog.

**Lines:** 332

---

<a name="src-components-prayerbacklog-tsx"></a>
### src/components/PrayerBacklog.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-components-prayerbacklog-web-tsx"></a>
### src/components/PrayerBacklog.web.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `toDateOnly` (Function)
- `PrayerBacklog` (Function)

**Function Details:**
- **`toDateOnly`** — Utility function for to date only.
- **`PrayerBacklog`** — Utility function for prayer backlog.

**Lines:** 330

---

<a name="src-components-prayertimeswidget-tsx"></a>
### src/components/PrayerTimesWidget.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `PrayerTimesWidget` (Function)

**Function Details:**
- **`PrayerTimesWidget`** — Utility function for prayer times widget.

**Lines:** 75

---

<a name="src-components-pulltorefresh-ios-tsx"></a>
### src/components/PullToRefresh.ios.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `PullToRefresh` (Function)

**Function Details:**
- **`PullToRefresh`** — Utility function for pull to refresh.

**Lines:** 177

---

<a name="src-components-pulltorefresh-tsx"></a>
### src/components/PullToRefresh.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-components-pulltorefresh-web-tsx"></a>
### src/components/PullToRefresh.web.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `PullToRefresh` (Function)

**Function Details:**
- **`PullToRefresh`** — Utility function for pull to refresh.

**Lines:** 127

---

<a name="src-components-swipeablerow-ios-tsx"></a>
### src/components/SwipeableRow.ios.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `SwipeableRow` (Function)

**Function Details:**
- **`SwipeableRow`** — Utility function for swipeable row.

**Lines:** 150

---

<a name="src-components-swipeablerow-pake-tsx"></a>
### src/components/SwipeableRow.pake.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `SwipeableRow` (Function)

**Function Details:**
- **`SwipeableRow`** — Utility function for swipeable row.

**Lines:** 130

---

<a name="src-components-swipeablerow-tsx"></a>
### src/components/SwipeableRow.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-components-swipeablerow-web-tsx"></a>
### src/components/SwipeableRow.web.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `SwipeableRow` (Function)

**Function Details:**
- **`SwipeableRow`** — Utility function for swipeable row.

**Lines:** 131

---

<a name="src-components-taskdetailscontent-ios-tsx"></a>
### src/components/TaskDetailsContent.ios.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `Row` (React Component)
- `SectionLabel` (React Component)
- `Card` (React Component)
- `Divider` (React Component)
- `Row` (Function)
- `SectionLabel` (Function)
- `Card` (Function)
- `Divider` (Function)
- `TaskDetailsContent` (Function)
- `TaskDetailsFormState` (Interface)

**Function Details:**
- **`Row`** — React component rendering UI for Row.
- **`SectionLabel`** — React component rendering UI for SectionLabel.
- **`Card`** — React component rendering UI for Card.
- **`Divider`** — React component rendering UI for Divider.
- **`Row`** — Utility function for row.
- **`SectionLabel`** — Utility function for section label.
- **`Card`** — Utility function for card.
- **`Divider`** — Utility function for divider.
- **`TaskDetailsContent`** — Utility function for task details content.

**Lines:** 1162

---

<a name="src-components-taskdetailscontent-tsx"></a>
### src/components/TaskDetailsContent.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-components-taskdetailscontent-web-tsx"></a>
### src/components/TaskDetailsContent.web.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `Row` (React Component)
- `SectionLabel` (React Component)
- `Card` (React Component)
- `Divider` (React Component)
- `Row` (Function)
- `SectionLabel` (Function)
- `Card` (Function)
- `Divider` (Function)
- `TaskDetailsContent` (Function)
- `TaskDetailsFormState` (Interface)

**Function Details:**
- **`Row`** — React component rendering UI for Row.
- **`SectionLabel`** — React component rendering UI for SectionLabel.
- **`Card`** — React component rendering UI for Card.
- **`Divider`** — React component rendering UI for Divider.
- **`Row`** — Utility function for row.
- **`SectionLabel`** — Utility function for section label.
- **`Card`** — Utility function for card.
- **`Divider`** — Utility function for divider.
- **`TaskDetailsContent`** — Utility function for task details content.

**Lines:** 1132

---

<a name="src-components-analytics-analyticsdeepinsights-tsx"></a>
### src/components/analytics/AnalyticsDeepInsights.tsx

**File Purpose:** Analytics visualization component. Renders charts, reports, and trend analysis UI.

**Functions & Classes:**
- `AnalyticsDeepInsights` (Function)

**Function Details:**
- **`AnalyticsDeepInsights`** — Utility function for analytics deep insights.

**Lines:** 283

---

<a name="src-components-analytics-analyticsdigital-tsx"></a>
### src/components/analytics/AnalyticsDigital.tsx

**File Purpose:** Analytics visualization component. Renders charts, reports, and trend analysis UI.

**Functions & Classes:**
- `AnalyticsDigital` (Function)

**Function Details:**
- **`AnalyticsDigital`** — Utility function for analytics digital.

**Lines:** 137

---

<a name="src-components-analytics-analyticshabits-tsx"></a>
### src/components/analytics/AnalyticsHabits.tsx

**File Purpose:** Analytics visualization component. Renders charts, reports, and trend analysis UI.

**Functions & Classes:**
- `AnalyticsHabits` (Function)

**Function Details:**
- **`AnalyticsHabits`** — Utility function for analytics habits.

**Lines:** 296

---

<a name="src-components-analytics-analyticshealthwealth-tsx"></a>
### src/components/analytics/AnalyticsHealthWealth.tsx

**File Purpose:** Analytics visualization component. Renders charts, reports, and trend analysis UI.

**Functions & Classes:**
- `AnalyticsHealthWealth` (Function)

**Function Details:**
- **`AnalyticsHealthWealth`** — Utility function for analytics health wealth.

**Lines:** 148

---

<a name="src-components-analytics-analyticsoverview-tsx"></a>
### src/components/analytics/AnalyticsOverview.tsx

**File Purpose:** Analytics visualization component. Renders charts, reports, and trend analysis UI.

**Functions & Classes:**
- `AnalyticsOverview` (Function)

**Function Details:**
- **`AnalyticsOverview`** — Utility function for analytics overview.

**Lines:** 201

---

<a name="src-components-analytics-analyticspoints-tsx"></a>
### src/components/analytics/AnalyticsPoints.tsx

**File Purpose:** Analytics visualization component. Renders charts, reports, and trend analysis UI.

**Functions & Classes:**
- `AnalyticsPoints` (Function)

**Function Details:**
- **`AnalyticsPoints`** — Utility function for analytics points.

**Lines:** 279

---

<a name="src-components-analytics-analyticsreport-tsx"></a>
### src/components/analytics/AnalyticsReport.tsx

**File Purpose:** Analytics visualization component. Renders charts, reports, and trend analysis UI.

**Functions & Classes:**
- `DeltaBadge` (React Component)
- `ScoreRing` (React Component)
- `Section` (React Component)
- `ExpandableCard` (React Component)
- `fmtMin` (Function)
- `fmtSec` (Function)
- `DeltaBadge` (Function)
- `ScoreRing` (Function)
- `Section` (Function)
- `ExpandableCard` (Function)
- `AnalyticsReport` (Function)

**Function Details:**
- **`DeltaBadge`** — React component rendering UI for DeltaBadge.
- **`ScoreRing`** — React component rendering UI for ScoreRing.
- **`Section`** — React component rendering UI for Section.
- **`ExpandableCard`** — React component rendering UI for ExpandableCard.
- **`fmtMin`** — Utility function for fmt min.
- **`fmtSec`** — Utility function for fmt sec.
- **`DeltaBadge`** — Utility function for delta badge.
- **`ScoreRing`** — Utility function for score ring.
- **`Section`** — Utility function for section.

**Lines:** 838

---

<a name="src-components-analytics-animatedcounter-tsx"></a>
### src/components/analytics/AnimatedCounter.tsx

**File Purpose:** Analytics visualization component. Renders charts, reports, and trend analysis UI.

**Functions & Classes:**
- `AnimatedCounter` (Function)

**Function Details:**
- **`AnimatedCounter`** — Utility function for animated counter.

**Lines:** 58

---

<a name="src-components-analytics-daydetailsmodal-tsx"></a>
### src/components/analytics/DayDetailsModal.tsx

**File Purpose:** Analytics visualization component. Renders charts, reports, and trend analysis UI.

**Functions & Classes:**
- `DayDetailsModal` (Function)
- `DayDetailsProps` (Interface)

**Function Details:**
- **`DayDetailsModal`** — Utility function for day details modal.

**Lines:** 106

---

<a name="src-components-dashboard-dashboardannualreview-tsx"></a>
### src/components/dashboard/DashboardAnnualReview.tsx

**File Purpose:** Dashboard widget/component. Displays aggregated life metrics and quick-view data panels.

**Functions & Classes:**
- `aggregateScreentimeSecondsByDate` (Function)
- `DashboardAnnualReview` (Function)

**Function Details:**
- **`aggregateScreentimeSecondsByDate`** — Utility function for aggregate screentime seconds by date.
- **`DashboardAnnualReview`** — Utility function for dashboard annual review.

**Lines:** 218

---

<a name="src-components-dashboard-dashboardquickview-ios-tsx"></a>
### src/components/dashboard/DashboardQuickView.ios.tsx

**File Purpose:** Dashboard widget/component. Displays aggregated life metrics and quick-view data panels.

**Functions & Classes:**
- `DueTodayRow` (React Component)
- `formatSleepMinutes` (Function)
- `formatDurationMinutes` (Function)
- `timeStringToMinutes` (Function)
- `isoToDayMinutes` (Function)
- `mergeSegments` (Function)
- `intersectSegments` (Function)
- `subtractSegments` (Function)
- `parseDueForSort` (Function)
- `DueTodayRow` (Function)
- `DashboardQuickView` (Function)

**Function Details:**
- **`DueTodayRow`** — React component rendering UI for DueTodayRow.
- **`formatSleepMinutes`** — Utility function for format sleep minutes.
- **`formatDurationMinutes`** — Utility function for format duration minutes.
- **`timeStringToMinutes`** — Utility function for time string to minutes.
- **`isoToDayMinutes`** — Utility function for iso to day minutes.
- **`mergeSegments`** — Utility function for merge segments.

**Lines:** 2242

---

<a name="src-components-dashboard-dashboardquickview-pake-tsx"></a>
### src/components/dashboard/DashboardQuickView.pake.tsx

**File Purpose:** Dashboard widget/component. Displays aggregated life metrics and quick-view data panels.

**Functions & Classes:**
- `DueTodayRow` (React Component)
- `formatSleepMinutes` (Function)
- `formatDurationMinutes` (Function)
- `timeStringToMinutes` (Function)
- `isoToDayMinutes` (Function)
- `mergeSegments` (Function)
- `intersectSegments` (Function)
- `subtractSegments` (Function)
- `parseDueForSort` (Function)
- `DueTodayRow` (Function)
- `DashboardQuickView` (Function)

**Function Details:**
- **`DueTodayRow`** — React component rendering UI for DueTodayRow.
- **`formatSleepMinutes`** — Utility function for format sleep minutes.
- **`formatDurationMinutes`** — Utility function for format duration minutes.
- **`timeStringToMinutes`** — Utility function for time string to minutes.
- **`isoToDayMinutes`** — Utility function for iso to day minutes.
- **`mergeSegments`** — Utility function for merge segments.

**Lines:** 1417

---

<a name="src-components-dashboard-dashboardquickview-tsx"></a>
### src/components/dashboard/DashboardQuickView.tsx

**File Purpose:** Dashboard widget/component. Displays aggregated life metrics and quick-view data panels.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-components-dashboard-dashboardquickview-web-tsx"></a>
### src/components/dashboard/DashboardQuickView.web.tsx

**File Purpose:** Dashboard widget/component. Displays aggregated life metrics and quick-view data panels.

**Functions & Classes:**
- `formatSleepMinutes` (Function)
- `formatDurationMinutes` (Function)
- `timeStringToMinutes` (Function)
- `isoToDayMinutes` (Function)
- `mergeSegments` (Function)
- `intersectSegments` (Function)
- `subtractSegments` (Function)
- `parseDueForSort` (Function)
- `DashboardQuickView` (Function)

**Function Details:**
- **`formatSleepMinutes`** — Utility function for format sleep minutes.
- **`formatDurationMinutes`** — Utility function for format duration minutes.
- **`timeStringToMinutes`** — Utility function for time string to minutes.
- **`isoToDayMinutes`** — Utility function for iso to day minutes.
- **`mergeSegments`** — Utility function for merge segments.

**Lines:** 1532

---

<a name="src-components-dashboard-dashboardstrategic-tsx"></a>
### src/components/dashboard/DashboardStrategic.tsx

**File Purpose:** Dashboard widget/component. Displays aggregated life metrics and quick-view data panels.

**Functions & Classes:**
- `horizonBounds` (Function)
- `DashboardStrategic` (Function)

**Function Details:**
- **`horizonBounds`** — Utility function for horizon bounds.
- **`DashboardStrategic`** — Utility function for dashboard strategic.

**Lines:** 121

---

<a name="src-components-navitems-ts"></a>
### src/components/navItems.ts

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `NavItem` (Interface)

**Lines:** 42

---

<a name="src-components-ui-button-ios-tsx"></a>
### src/components/ui/Button.ios.tsx

**File Purpose:** UI primitive component. Reusable design-system element used across the application.

**Functions & Classes:**
- `Button` (React Component)

**Function Details:**
- **`Button`** — React component rendering UI for Button.

**Lines:** 42

---

<a name="src-components-ui-button-tsx"></a>
### src/components/ui/Button.tsx

**File Purpose:** UI primitive component. Reusable design-system element used across the application.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-components-ui-button-web-tsx"></a>
### src/components/ui/Button.web.tsx

**File Purpose:** UI primitive component. Reusable design-system element used across the application.

**Functions & Classes:**
- `Button` (React Component)

**Function Details:**
- **`Button`** — React component rendering UI for Button.

**Lines:** 41

---

<a name="src-components-ui-confirmsheet-tsx"></a>
### src/components/ui/ConfirmSheet.tsx

**File Purpose:** UI primitive component. Reusable design-system element used across the application.

**Functions & Classes:**
- `ConfirmSheet` (Function)

**Function Details:**
- **`ConfirmSheet`** — Utility function for confirm sheet.

**Lines:** 185

---

<a name="src-components-ui-detailssheet-tsx"></a>
### src/components/ui/DetailsSheet.tsx

**File Purpose:** UI primitive component. Reusable design-system element used across the application.

**Functions & Classes:**
- `DetailsSheet` (Function)

**Function Details:**
- **`DetailsSheet`** — Utility function for details sheet.

**Lines:** 304

---

<a name="src-components-ui-input-tsx"></a>
### src/components/ui/Input.tsx

**File Purpose:** UI primitive component. Reusable design-system element used across the application.

**Functions & Classes:**
- `Input` (React Component)
- `Select` (React Component)
- `TextArea` (React Component)

**Function Details:**
- **`Input`** — React component rendering UI for Input.
- **`Select`** — React component rendering UI for Select.
- **`TextArea`** — React component rendering UI for TextArea.

**Lines:** 113

---

<a name="src-components-ui-modal-tsx"></a>
### src/components/ui/Modal.tsx

**File Purpose:** UI primitive component. Reusable design-system element used across the application.

**Functions & Classes:**
- `Modal` (Function)

**Function Details:**
- **`Modal`** — Utility function for modal.

**Lines:** 239

---

<a name="src-components-ui-index-ts"></a>
### src/components/ui/index.ts

**File Purpose:** UI primitive component. Reusable design-system element used across the application.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 6

---

<a name="src-components-wiki-wikigraphview-tsx"></a>
### src/components/wiki/WikiGraphView.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `WikiGraphView` (React Component)
- `buildGraph` (Function)
- `WikiGraphView` (Function)
- `step` (Function)

**Function Details:**
- **`WikiGraphView`** — React component rendering UI for WikiGraphView.
- **`buildGraph`** — Utility function for build graph.
- **`WikiGraphView`** — Utility function for wiki graph view.
- **`step`** — Utility function for step.

**Lines:** 359

---

<a name="src-components-wiki-wikimarkdown-tsx"></a>
### src/components/wiki/WikiMarkdown.tsx

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `WikiMarkdown` (React Component)
- `wikiLinkExtension` (Function)
- `WikiMarkdown` (Function)

**Function Details:**
- **`WikiMarkdown`** — React component rendering UI for WikiMarkdown.
- **`wikiLinkExtension`** — Utility function for wiki link extension.
- **`WikiMarkdown`** — Utility function for wiki markdown.

**Lines:** 84

---

<a name="src-contexts-authcontext-tsx"></a>
### src/contexts/AuthContext.tsx

**File Purpose:** React Context provider. Manages shared state and provides it to descendant components via React Context API.

**Functions & Classes:**
- `useAuth` (React Hook)
- `AuthProvider` (Function)
- `useAuth` (Function)

**Function Details:**
- **`useAuth`** — Custom React hook managing auth state and side effects.
- **`AuthProvider`** — Utility function for auth provider.
- **`useAuth`** — Utility function for use auth.

**Lines:** 119

---

<a name="src-db-database-ts"></a>
### src/db/database.ts

**File Purpose:** Database layer. Manages local database schema, migrations, seeding, or IndexedDB operations.

**Functions & Classes:**
- `loadDB` (Function)
- `saveDB` (Function)
- `round1` (Function)
- `now` (Function)

**Function Details:**
- **`loadDB`** — Utility function for load d b.
- **`saveDB`** — Utility function for save d b.
- **`round1`** — Utility function for round1.
- **`now`** — Utility function for now.

**Lines:** 836

---

<a name="src-db-indexeddb-ts"></a>
### src/db/indexedDb.ts

**File Purpose:** Database layer. Manages local database schema, migrations, seeding, or IndexedDB operations.

**Functions & Classes:**
- `openDb` (Function)
- `IdbQueueEntry` (Interface)

**Function Details:**
- **`openDb`** — Utility function for open db.

**Lines:** 277

---

<a name="src-db-seed-ts"></a>
### src/db/seed.ts

**File Purpose:** Database layer. Manages local database schema, migrations, seeding, or IndexedDB operations.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 45

---

<a name="src-hooks-useanalytics-ts"></a>
### src/hooks/useAnalytics.ts

**File Purpose:** Custom React hook. Encapsulates Analytics.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useAnalyticsDaily` (React Hook)
- `useAnalyticsTop` (React Hook)
- `useAnalyticsDailyRange` (React Hook)
- `dateToYmd` (Function)
- `getRangeBounds` (Function)
- `useAnalyticsDaily` (Function)
- `useAnalyticsTop` (Function)
- `useAnalyticsDailyRange` (Function)
- `AnalyticsDailyFinanceRow` (Interface)
- `AnalyticsDailySleepRow` (Interface)
- `AnalyticsDailyTasksRow` (Interface)
- `AnalyticsDailyHabitsRow` (Interface)
- `AnalyticsDailyScreentimeRow` (Interface)
- `AnalyticsTopAppRow` (Interface)
- `AnalyticsTopDomainRow` (Interface)
- `AnalyticsTopCategoryRow` (Interface)
- `AnalyticsTopMerchantRow` (Interface)
- `AnalyticsRangeDays` (Type)

**Function Details:**
- **`useAnalyticsDaily`** — Custom React hook managing analyticsdaily state and side effects.
- **`useAnalyticsTop`** — Custom React hook managing analyticstop state and side effects.
- **`useAnalyticsDailyRange`** — Custom React hook managing analyticsdailyrange state and side effects.
- **`dateToYmd`** — Utility function for date to ymd.
- **`getRangeBounds`** — Utility function for get range bounds.
- **`useAnalyticsDaily`** — Utility function for use analytics daily.
- **`useAnalyticsTop`** — Utility function for use analytics top.
- **`useAnalyticsDailyRange`** — Utility function for use analytics daily range.

**Lines:** 249

---

<a name="src-hooks-usecalendar-ts"></a>
### src/hooks/useCalendar.ts

**File Purpose:** Custom React hook. Encapsulates Calendar.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useCalendarEvents` (React Hook)
- `useCreateCalendarEvent` (React Hook)
- `useUpdateCalendarEvent` (React Hook)
- `useDeleteCalendarEvent` (React Hook)
- `useExpandedCalendarEvents` (React Hook)
- `useIcalSubscriptionEvents` (React Hook)
- `useUpcomingEvents` (React Hook)
- `useTasksForCalendar` (React Hook)
- `useCalendarEvents` (Function)
- `useCreateCalendarEvent` (Function)
- `useUpdateCalendarEvent` (Function)
- `useDeleteCalendarEvent` (Function)
- `useExpandedCalendarEvents` (Function)
- `useIcalSubscriptionEvents` (Function)
- `useUpcomingEvents` (Function)
- `useTasksForCalendar` (Function)

**Function Details:**
- **`useCalendarEvents`** — Custom React hook managing calendarevents state and side effects.
- **`useCreateCalendarEvent`** — Custom React hook managing createcalendarevent state and side effects.
- **`useUpdateCalendarEvent`** — Custom React hook managing updatecalendarevent state and side effects.
- **`useDeleteCalendarEvent`** — Custom React hook managing deletecalendarevent state and side effects.
- **`useExpandedCalendarEvents`** — Custom React hook managing expandedcalendarevents state and side effects.
- **`useCalendarEvents`** — Utility function for use calendar events.
- **`useCreateCalendarEvent`** — Utility function for use create calendar event.
- **`useUpdateCalendarEvent`** — Utility function for use update calendar event.
- **`useDeleteCalendarEvent`** — Utility function for use delete calendar event.
- **`useExpandedCalendarEvents`** — Utility function for use expanded calendar events.

**Lines:** 217

---

<a name="src-hooks-useconnectionstatus-ts"></a>
### src/hooks/useConnectionStatus.ts

**File Purpose:** Custom React hook. Encapsulates ConnectionStatus.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useConnectionStatus` (React Hook)
- `useConnectionStatus` (Function)

**Function Details:**
- **`useConnectionStatus`** — Custom React hook managing connectionstatus state and side effects.
- **`useConnectionStatus`** — Utility function for use connection status.

**Lines:** 28

---

<a name="src-hooks-usedashboardupcomingitems-test-ts"></a>
### src/hooks/useDashboardUpcomingItems.test.ts

**File Purpose:** Unit/integration tests for the corresponding implementation file.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 66

---

<a name="src-hooks-usedashboardupcomingitems-ts"></a>
### src/hooks/useDashboardUpcomingItems.ts

**File Purpose:** Custom React hook. Encapsulates DashboardUpcomingItems.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useDashboardUpcomingItems` (React Hook)
- `habitMatchesDay` (Function)
- `isHabitShownInQuickView` (Function)
- `useDashboardUpcomingItems` (Function)
- `DashboardUpcomingItem` (Interface)
- `DashboardUpcomingItemKind` (Type)

**Function Details:**
- **`useDashboardUpcomingItems`** — Custom React hook managing dashboardupcomingitems state and side effects.
- **`habitMatchesDay`** — Utility function for habit matches day.
- **`isHabitShownInQuickView`** — Utility function for is habit shown in quick view.
- **`useDashboardUpcomingItems`** — Utility function for use dashboard upcoming items.

**Lines:** 177

---

<a name="src-hooks-usefinance-test-ts"></a>
### src/hooks/useFinance.test.ts

**File Purpose:** Unit/integration tests for the corresponding implementation file.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 80

---

<a name="src-hooks-usefinance-ts"></a>
### src/hooks/useFinance.ts

**File Purpose:** Custom React hook. Encapsulates Finance.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useTransactionsRealtime` (React Hook)
- `useTransactions` (React Hook)
- `useCreateTransaction` (React Hook)
- `useUpdateTransaction` (React Hook)
- `useDeleteTransaction` (React Hook)
- `useFinancialSummary` (React Hook)
- `useCategoryBreakdown` (React Hook)
- `inferCashDirection` (Function)
- `isCashIn` (Function)
- `isCashOut` (Function)
- `transactionsKey` (Function)
- `useTransactionsRealtime` (Function)
- `filterToCurrentUser` (Function)
- `useTransactions` (Function)
- `useCreateTransaction` (Function)
- `useUpdateTransaction` (Function)
- `useDeleteTransaction` (Function)
- `useFinancialSummary` (Function)
- `computeBreakdownFromTransactions` (Function)
- `getBreakdownFromTransactions` (Function)
- `useCategoryBreakdown` (Function)

**Function Details:**
- **`useTransactionsRealtime`** — Custom React hook managing transactionsrealtime state and side effects.
- **`useTransactions`** — Custom React hook managing transactions state and side effects.
- **`useCreateTransaction`** — Custom React hook managing createtransaction state and side effects.
- **`useUpdateTransaction`** — Custom React hook managing updatetransaction state and side effects.
- **`useDeleteTransaction`** — Custom React hook managing deletetransaction state and side effects.
- **`inferCashDirection`** — Utility function for infer cash direction.
- **`isCashIn`** — Utility function for is cash in.
- **`isCashOut`** — Utility function for is cash out.
- **`transactionsKey`** — Utility function for transactions key.
- **`useTransactionsRealtime`** — Utility function for use transactions realtime.

**Lines:** 332

---

<a name="src-hooks-usehabits-ios-ts"></a>
### src/hooks/useHabits.ios.ts

**File Purpose:** Custom React hook. Encapsulates Habits logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useHabits` (React Hook)
- `useHabit` (React Hook)
- `useCreateHabit` (React Hook)
- `useUpdateHabit` (React Hook)
- `useDeleteHabit` (React Hook)
- `useUnarchiveHabit` (React Hook)
- `useHabitLogs` (React Hook)
- `useTodayHabitLogs` (React Hook)
- `useHabitAverages` (React Hook)
- `useLogHabit` (React Hook)
- `useHabitStreak` (React Hook)
- `useArchivedHabits` (React Hook)
- `useHabitStreaks` (React Hook)
- `useHabitRescuableStreaks` (React Hook)
- `useHabitInsights` (React Hook)
- `useWeeklyAdherence` (React Hook)
- `getHabitAdherenceWeight` (Function)
- `isHabitScheduledForDate` (Function)
- `clampPct` (Function)
- `useHabits` (Function)
- `useHabit` (Function)
- `useCreateHabit` (Function)
- `useUpdateHabit` (Function)
- `useDeleteHabit` (Function)
- `useUnarchiveHabit` (Function)
- `useHabitLogs` (Function)
- `useTodayHabitLogs` (Function)
- `useHabitAverages` (Function)
- `useLogHabit` (Function)
- `getHabitRescueCost` (Function)
- `getHabitStreak` (Function)
- `HabitInsight` (Interface)

**Function Details:**
- **`useHabits`** — Custom React hook managing habits state and side effects.
- **`useHabit`** — Custom React hook managing habit state and side effects.
- **`useCreateHabit`** — Custom React hook managing createhabit state and side effects.
- **`useUpdateHabit`** — Custom React hook managing updatehabit state and side effects.
- **`useDeleteHabit`** — Custom React hook managing deletehabit state and side effects.
- **`getHabitAdherenceWeight`** — Utility function for get habit adherence weight.
- **`isHabitScheduledForDate`** — Utility function for is habit scheduled for date.
- **`clampPct`** — Utility function for clamp pct.
- **`useHabits`** — Utility function for use habits.
- **`useHabit`** — Utility function for use habit.

**Lines:** 1002

---

<a name="src-hooks-usehabits-ts"></a>
### src/hooks/useHabits.ts

**File Purpose:** Custom React hook. Encapsulates Habits.ts logic for data fetching, state management, or side effects.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-hooks-usehabits-web-ts"></a>
### src/hooks/useHabits.web.ts

**File Purpose:** Custom React hook. Encapsulates Habits logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useHabits` (React Hook)
- `useHabit` (React Hook)
- `useCreateHabit` (React Hook)
- `useUpdateHabit` (React Hook)
- `useDeleteHabit` (React Hook)
- `useUnarchiveHabit` (React Hook)
- `useHabitLogs` (React Hook)
- `useTodayHabitLogs` (React Hook)
- `useHabitAverages` (React Hook)
- `useLogHabit` (React Hook)
- `useHabitStreak` (React Hook)
- `useArchivedHabits` (React Hook)
- `useHabitStreaks` (React Hook)
- `useHabitRescuableStreaks` (React Hook)
- `useHabitInsights` (React Hook)
- `useWeeklyAdherence` (React Hook)
- `getHabitAdherenceWeight` (Function)
- `isHabitScheduledForDate` (Function)
- `clampPct` (Function)
- `useHabits` (Function)
- `useHabit` (Function)
- `useCreateHabit` (Function)
- `useUpdateHabit` (Function)
- `useDeleteHabit` (Function)
- `useUnarchiveHabit` (Function)
- `useHabitLogs` (Function)
- `useTodayHabitLogs` (Function)
- `useHabitAverages` (Function)
- `useLogHabit` (Function)
- `getHabitRescueCost` (Function)
- `getHabitStreak` (Function)
- `HabitInsight` (Interface)

**Function Details:**
- **`useHabits`** — Custom React hook managing habits state and side effects.
- **`useHabit`** — Custom React hook managing habit state and side effects.
- **`useCreateHabit`** — Custom React hook managing createhabit state and side effects.
- **`useUpdateHabit`** — Custom React hook managing updatehabit state and side effects.
- **`useDeleteHabit`** — Custom React hook managing deletehabit state and side effects.
- **`getHabitAdherenceWeight`** — Utility function for get habit adherence weight.
- **`isHabitScheduledForDate`** — Utility function for is habit scheduled for date.
- **`clampPct`** — Utility function for clamp pct.
- **`useHabits`** — Utility function for use habits.
- **`useHabit`** — Utility function for use habit.

**Lines:** 999

---

<a name="src-hooks-usehealthdata-ts"></a>
### src/hooks/useHealthData.ts

**File Purpose:** Custom React hook. Encapsulates HealthData.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useInBodyScans` (React Hook)
- `useInBodyScan` (React Hook)
- `useCreateInBodyScan` (React Hook)
- `useUpdateInBodyScan` (React Hook)
- `useDeleteInBodyScan` (React Hook)
- `useHealthMetrics` (React Hook)
- `useInBodyScans` (Function)
- `useInBodyScan` (Function)
- `useCreateInBodyScan` (Function)
- `useUpdateInBodyScan` (Function)
- `useDeleteInBodyScan` (Function)
- `useHealthMetrics` (Function)

**Function Details:**
- **`useInBodyScans`** — Custom React hook managing inbodyscans state and side effects.
- **`useInBodyScan`** — Custom React hook managing inbodyscan state and side effects.
- **`useCreateInBodyScan`** — Custom React hook managing createinbodyscan state and side effects.
- **`useUpdateInBodyScan`** — Custom React hook managing updateinbodyscan state and side effects.
- **`useDeleteInBodyScan`** — Custom React hook managing deleteinbodyscan state and side effects.
- **`useInBodyScans`** — Utility function for use in body scans.
- **`useInBodyScan`** — Utility function for use in body scan.
- **`useCreateInBodyScan`** — Utility function for use create in body scan.
- **`useUpdateInBodyScan`** — Utility function for use update in body scan.
- **`useDeleteInBodyScan`** — Utility function for use delete in body scan.

**Lines:** 214

---

<a name="src-hooks-useicalsubscriptions-ts"></a>
### src/hooks/useIcalSubscriptions.ts

**File Purpose:** Custom React hook. Encapsulates IcalSubscriptions.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useIcalSubscriptions` (React Hook)
- `deriveNameFromUrl` (Function)
- `parseSubscriptions` (Function)
- `useIcalSubscriptions` (Function)
- `IcalSubscription` (Type)

**Function Details:**
- **`useIcalSubscriptions`** — Custom React hook managing icalsubscriptions state and side effects.
- **`deriveNameFromUrl`** — Utility function for derive name from url.
- **`parseSubscriptions`** — Utility function for parse subscriptions.
- **`useIcalSubscriptions`** — Utility function for use ical subscriptions.

**Lines:** 127

---

<a name="src-hooks-useinvestments-test-ts"></a>
### src/hooks/useInvestments.test.ts

**File Purpose:** Unit/integration tests for the corresponding implementation file.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 43

---

<a name="src-hooks-useinvestments-ts"></a>
### src/hooks/useInvestments.ts

**File Purpose:** Custom React hook. Encapsulates Investments.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useInvestmentAccounts` (React Hook)
- `useEnsureDefaultInvestmentAccounts` (React Hook)
- `useInvestmentTransactions` (React Hook)
- `useCreateInvestmentTransaction` (React Hook)
- `useUpdateInvestmentTransaction` (React Hook)
- `useDeleteInvestmentTransaction` (React Hook)
- `filterToCurrentUser` (Function)
- `useInvestmentAccounts` (Function)
- `useEnsureDefaultInvestmentAccounts` (Function)
- `useInvestmentTransactions` (Function)
- `useCreateInvestmentTransaction` (Function)
- `useUpdateInvestmentTransaction` (Function)
- `useDeleteInvestmentTransaction` (Function)
- `getInvestmentBreakdown` (Function)

**Function Details:**
- **`useInvestmentAccounts`** — Custom React hook managing investmentaccounts state and side effects.
- **`useEnsureDefaultInvestmentAccounts`** — Custom React hook managing ensuredefaultinvestmentaccounts state and side effects.
- **`useInvestmentTransactions`** — Custom React hook managing investmenttransactions state and side effects.
- **`useCreateInvestmentTransaction`** — Custom React hook managing createinvestmenttransaction state and side effects.
- **`useUpdateInvestmentTransaction`** — Custom React hook managing updateinvestmenttransaction state and side effects.
- **`filterToCurrentUser`** — Utility function for filter to current user.
- **`useInvestmentAccounts`** — Utility function for use investment accounts.
- **`useEnsureDefaultInvestmentAccounts`** — Utility function for use ensure default investment accounts.
- **`useInvestmentTransactions`** — Utility function for use investment transactions.
- **`useCreateInvestmentTransaction`** — Utility function for use create investment transaction.

**Lines:** 195

---

<a name="src-hooks-usenativeinteraction-ts"></a>
### src/hooks/useNativeInteraction.ts

**File Purpose:** Custom React hook. Encapsulates NativeInteraction.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useNativeInteraction` (React Hook)
- `useNativeInteraction` (Function)

**Function Details:**
- **`useNativeInteraction`** — Custom React hook managing nativeinteraction state and side effects.
- **`useNativeInteraction`** — Utility function for use native interaction.

**Lines:** 67

---

<a name="src-hooks-usenativelocalnotifications-ts"></a>
### src/hooks/useNativeLocalNotifications.ts

**File Purpose:** Custom React hook. Encapsulates NativeLocalNotifications.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useNativeLocalNotifications` (React Hook)
- `hashCode` (Function)
- `useNativeLocalNotifications` (Function)

**Function Details:**
- **`useNativeLocalNotifications`** — Custom React hook managing nativelocalnotifications state and side effects.
- **`hashCode`** — Utility function for hash code.
- **`useNativeLocalNotifications`** — Utility function for use native local notifications.

**Lines:** 58

---

<a name="src-hooks-usenotes-ts"></a>
### src/hooks/useNotes.ts

**File Purpose:** Custom React hook. Encapsulates Notes.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useNotes` (React Hook)
- `useNoteFolders` (React Hook)
- `useCreateNoteFolder` (React Hook)
- `useCreateNote` (React Hook)
- `useUpdateNote` (React Hook)
- `useDeleteNote` (React Hook)
- `normalizeNoteInput` (Function)
- `normalizeFolderName` (Function)
- `useNotes` (Function)
- `useNoteFolders` (Function)
- `useCreateNoteFolder` (Function)
- `useCreateNote` (Function)
- `useUpdateNote` (Function)
- `useDeleteNote` (Function)

**Function Details:**
- **`useNotes`** — Custom React hook managing notes state and side effects.
- **`useNoteFolders`** — Custom React hook managing notefolders state and side effects.
- **`useCreateNoteFolder`** — Custom React hook managing createnotefolder state and side effects.
- **`useCreateNote`** — Custom React hook managing createnote state and side effects.
- **`useUpdateNote`** — Custom React hook managing updatenote state and side effects.
- **`normalizeNoteInput`** — Utility function for normalize note input.
- **`normalizeFolderName`** — Utility function for normalize folder name.
- **`useNotes`** — Utility function for use notes.
- **`useNoteFolders`** — Utility function for use note folders.
- **`useCreateNoteFolder`** — Utility function for use create note folder.

**Lines:** 142

---

<a name="src-hooks-usepakelocalnotifications-ts"></a>
### src/hooks/usePakeLocalNotifications.ts

**File Purpose:** Custom React hook. Encapsulates PakeLocalNotifications.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `usePakeLocalNotifications` (React Hook)
- `generateEventInstances` (Function)
- `isHabitScheduledForDate` (Function)
- `taskTriggerDate` (Function)
- `usePakeLocalNotifications` (Function)

**Function Details:**
- **`usePakeLocalNotifications`** — Custom React hook managing pakelocalnotifications state and side effects.
- **`generateEventInstances`** — Utility function for generate event instances.
- **`isHabitScheduledForDate`** — Utility function for is habit scheduled for date.
- **`taskTriggerDate`** — Utility function for task trigger date.
- **`usePakeLocalNotifications`** — Utility function for use pake local notifications.

**Lines:** 251

---

<a name="src-hooks-usepoints-ts"></a>
### src/hooks/usePoints.ts

**File Purpose:** Custom React hook. Encapsulates Points.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `POINTS_TX_KEY` (React Component)
- `CUSTOM_REWARDS_KEY` (React Component)
- `usePointsTransactions` (React Hook)
- `usePointsBalance` (React Hook)
- `useCustomRewards` (React Hook)
- `useCreateCustomReward` (React Hook)
- `useDeleteCustomReward` (React Hook)
- `useAddPointsTransaction` (React Hook)
- `useRedeemReward` (React Hook)
- `useRescueTask` (React Hook)
- `useDailyPointsSync` (React Hook)
- `getPointsConfig` (Function)
- `savePointsConfig` (Function)
- `isDateEligibleForPoints` (Function)
- `isTaskCompletedOnTime` (Function)
- `usePointsTransactions` (Function)
- `usePointsBalance` (Function)
- `useCustomRewards` (Function)
- `useCreateCustomReward` (Function)
- `useDeleteCustomReward` (Function)
- `useAddPointsTransaction` (Function)
- `useRedeemReward` (Function)
- `useRescueTask` (Function)
- `useDailyPointsSync` (Function)
- `PointsConfig` (Interface)

**Function Details:**
- **`POINTS_TX_KEY`** — React component rendering UI for POINTS_TX_KEY.
- **`CUSTOM_REWARDS_KEY`** — React component rendering UI for CUSTOM_REWARDS_KEY.
- **`usePointsTransactions`** — Custom React hook managing pointstransactions state and side effects.
- **`usePointsBalance`** — Custom React hook managing pointsbalance state and side effects.
- **`useCustomRewards`** — Custom React hook managing customrewards state and side effects.
- **`useCreateCustomReward`** — Custom React hook managing createcustomreward state and side effects.
- **`useDeleteCustomReward`** — Custom React hook managing deletecustomreward state and side effects.
- **`getPointsConfig`** — Utility function for get points config.
- **`savePointsConfig`** — Utility function for save points config.
- **`isDateEligibleForPoints`** — Utility function for is date eligible for points.
- **`isTaskCompletedOnTime`** — Utility function for is task completed on time.
- **`usePointsTransactions`** — Utility function for use points transactions.

**Lines:** 460

---

<a name="src-hooks-useprayerhabits-ios-ts"></a>
### src/hooks/usePrayerHabits.ios.ts

**File Purpose:** Custom React hook. Encapsulates PrayerHabits logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `usePrayerTracker` (React Hook)
- `useSetPrayerStatusAtDate` (React Hook)
- `usePrayerNotificationSettings` (React Hook)
- `getPrayerStatusPenalty` (Function)
- `isPrayerOverdue` (Function)
- `usePrayerTracker` (Function)
- `useSetPrayerStatusAtDate` (Function)
- `usePrayerNotificationSettings` (Function)
- `PrayerTrackerItem` (Type)

**Function Details:**
- **`usePrayerTracker`** — Custom React hook managing prayertracker state and side effects.
- **`useSetPrayerStatusAtDate`** — Custom React hook managing setprayerstatusatdate state and side effects.
- **`usePrayerNotificationSettings`** — Custom React hook managing prayernotificationsettings state and side effects.
- **`getPrayerStatusPenalty`** — Utility function for get prayer status penalty.
- **`isPrayerOverdue`** — Utility function for is prayer overdue.
- **`usePrayerTracker`** — Utility function for use prayer tracker.
- **`useSetPrayerStatusAtDate`** — Utility function for use set prayer status at date.
- **`usePrayerNotificationSettings`** — Utility function for use prayer notification settings.

**Lines:** 830

---

<a name="src-hooks-useprayerhabits-ts"></a>
### src/hooks/usePrayerHabits.ts

**File Purpose:** Custom React hook. Encapsulates PrayerHabits.ts logic for data fetching, state management, or side effects.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-hooks-useprayerhabits-web-ts"></a>
### src/hooks/usePrayerHabits.web.ts

**File Purpose:** Custom React hook. Encapsulates PrayerHabits logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `usePrayerTracker` (React Hook)
- `useSetPrayerStatusAtDate` (React Hook)
- `usePrayerNotificationSettings` (React Hook)
- `getPrayerStatusPenalty` (Function)
- `isPrayerOverdue` (Function)
- `usePrayerTracker` (Function)
- `useSetPrayerStatusAtDate` (Function)
- `usePrayerNotificationSettings` (Function)
- `PrayerTrackerItem` (Type)

**Function Details:**
- **`usePrayerTracker`** — Custom React hook managing prayertracker state and side effects.
- **`useSetPrayerStatusAtDate`** — Custom React hook managing setprayerstatusatdate state and side effects.
- **`usePrayerNotificationSettings`** — Custom React hook managing prayernotificationsettings state and side effects.
- **`getPrayerStatusPenalty`** — Utility function for get prayer status penalty.
- **`isPrayerOverdue`** — Utility function for is prayer overdue.
- **`usePrayerTracker`** — Utility function for use prayer tracker.
- **`useSetPrayerStatusAtDate`** — Utility function for use set prayer status at date.
- **`usePrayerNotificationSettings`** — Utility function for use prayer notification settings.

**Lines:** 758

---

<a name="src-hooks-useprayertimes-ts"></a>
### src/hooks/usePrayerTimes.ts

**File Purpose:** Custom React hook. Encapsulates PrayerTimes.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `usePrayerTimes` (React Hook)
- `usePrayerTimes` (Function)
- `PrayerTimeData` (Interface)

**Function Details:**
- **`usePrayerTimes`** — Custom React hook managing prayertimes state and side effects.
- **`usePrayerTimes`** — Utility function for use prayer times.

**Lines:** 92

---

<a name="src-hooks-usepushnotifications-ios-ts"></a>
### src/hooks/usePushNotifications.ios.ts

**File Purpose:** Custom React hook. Encapsulates PushNotifications logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `usePushNotifications` (React Hook)
- `usePushNotifications` (Function)

**Function Details:**
- **`usePushNotifications`** — Custom React hook managing pushnotifications state and side effects.
- **`usePushNotifications`** — Utility function for use push notifications.

**Lines:** 145

---

<a name="src-hooks-usepushnotifications-pake-ts"></a>
### src/hooks/usePushNotifications.pake.ts

**File Purpose:** Custom React hook. Encapsulates PushNotifications logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `usePushNotifications` (React Hook)
- `usePushNotifications` (Function)

**Function Details:**
- **`usePushNotifications`** — Custom React hook managing pushnotifications state and side effects.
- **`usePushNotifications`** — Utility function for use push notifications.

**Lines:** 50

---

<a name="src-hooks-usepushnotifications-ts"></a>
### src/hooks/usePushNotifications.ts

**File Purpose:** Custom React hook. Encapsulates PushNotifications.ts logic for data fetching, state management, or side effects.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-hooks-usepushnotifications-web-ts"></a>
### src/hooks/usePushNotifications.web.ts

**File Purpose:** Custom React hook. Encapsulates PushNotifications logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `usePushNotifications` (React Hook)
- `usePushNotifications` (Function)

**Function Details:**
- **`usePushNotifications`** — Custom React hook managing pushnotifications state and side effects.
- **`usePushNotifications`** — Utility function for use push notifications.

**Lines:** 106

---

<a name="src-hooks-usereport-test-ts"></a>
### src/hooks/useReport.test.ts

**File Purpose:** Unit/integration tests for the corresponding implementation file.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 78

---

<a name="src-hooks-usereport-ts"></a>
### src/hooks/useReport.ts

**File Purpose:** Custom React hook. Encapsulates Report.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useWeeklyReport` (React Hook)
- `useMonthlyReport` (React Hook)
- `avg` (Function)
- `buildDayMetrics` (Function)
- `computeOutliers` (Function)
- `computeBestWorstDay` (Function)
- `computeWeekScore` (Function)
- `computeHabitsByDow` (Function)
- `getWeekBounds` (Function)
- `getMonthBounds` (Function)
- `dateRange` (Function)
- `useWeeklyReport` (Function)
- `useMonthlyReport` (Function)
- `emptyReport` (Function)
- `DayMetrics` (Interface)
- `Outlier` (Interface)
- `TopApp` (Interface)
- `TopCategory` (Interface)
- `ReportData` (Interface)

**Function Details:**
- **`useWeeklyReport`** — Custom React hook managing weeklyreport state and side effects.
- **`useMonthlyReport`** — Custom React hook managing monthlyreport state and side effects.
- **`avg`** — Utility function for avg.
- **`buildDayMetrics`** — Utility function for build day metrics.
- **`computeOutliers`** — Utility function for compute outliers.
- **`computeBestWorstDay`** — Utility function for compute best worst day.
- **`computeWeekScore`** — Utility function for compute week score.

**Lines:** 666

---

<a name="src-hooks-usescreentime-ts"></a>
### src/hooks/useScreentime.ts

**File Purpose:** Custom React hook. Encapsulates Screentime.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useScreentimeAppStats` (React Hook)
- `useScreentimeWebsiteStats` (React Hook)
- `useScreentimeDailySummaries` (React Hook)
- `useTodayScreentime` (React Hook)
- `useScreentimeMetrics` (React Hook)
- `isPcLockApp` (Function)
- `isBrowserApp` (Function)
- `useScreentimeAppStats` (Function)
- `useScreentimeWebsiteStats` (Function)
- `useScreentimeDailySummaries` (Function)
- `useTodayScreentime` (Function)
- `useScreentimeMetrics` (Function)

**Function Details:**
- **`useScreentimeAppStats`** — Custom React hook managing screentimeappstats state and side effects.
- **`useScreentimeWebsiteStats`** — Custom React hook managing screentimewebsitestats state and side effects.
- **`useScreentimeDailySummaries`** — Custom React hook managing screentimedailysummaries state and side effects.
- **`useTodayScreentime`** — Custom React hook managing todayscreentime state and side effects.
- **`useScreentimeMetrics`** — Custom React hook managing screentimemetrics state and side effects.
- **`isPcLockApp`** — Utility function for is pc lock app.
- **`isBrowserApp`** — Utility function for is browser app.
- **`useScreentimeAppStats`** — Utility function for use screentime app stats.
- **`useScreentimeWebsiteStats`** — Utility function for use screentime website stats.
- **`useScreentimeDailySummaries`** — Utility function for use screentime daily summaries.

**Lines:** 433

---

<a name="src-hooks-usesleep-ts"></a>
### src/hooks/useSleep.ts

**File Purpose:** Custom React hook. Encapsulates Sleep.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useSleepMetrics` (React Hook)
- `useLastNightSleepMinutes` (React Hook)
- `useSleepMinutesForDay` (React Hook)
- `useSleepStages` (React Hook)
- `stageIs` (Function)
- `groupSegmentsByNight` (Function)
- `useSleepMetrics` (Function)
- `useLastNightSleepMinutes` (Function)
- `overlapMinutesForDay` (Function)
- `useSleepMinutesForDay` (Function)
- `useSleepStages` (Function)

**Function Details:**
- **`useSleepMetrics`** — Custom React hook managing sleepmetrics state and side effects.
- **`useLastNightSleepMinutes`** — Custom React hook managing lastnightsleepminutes state and side effects.
- **`useSleepMinutesForDay`** — Custom React hook managing sleepminutesforday state and side effects.
- **`useSleepStages`** — Custom React hook managing sleepstages state and side effects.
- **`stageIs`** — Utility function for stage is.
- **`groupSegmentsByNight`** — Utility function for group segments by night.
- **`useSleepMetrics`** — Utility function for use sleep metrics.
- **`useLastNightSleepMinutes`** — Utility function for use last night sleep minutes.
- **`overlapMinutesForDay`** — Utility function for overlap minutes for day.

**Lines:** 195

---

<a name="src-hooks-usesyncstatus-ts"></a>
### src/hooks/useSyncStatus.ts

**File Purpose:** Custom React hook. Encapsulates SyncStatus.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useSyncStatus` (React Hook)
- `useSyncStatus` (Function)

**Function Details:**
- **`useSyncStatus`** — Custom React hook managing syncstatus state and side effects.
- **`useSyncStatus`** — Utility function for use sync status.

**Lines:** 53

---

<a name="src-hooks-usetaskcalendarfeed-ts"></a>
### src/hooks/useTaskCalendarFeed.ts

**File Purpose:** Custom React hook. Encapsulates TaskCalendarFeed.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useTaskCalendarFeed` (React Hook)
- `getBrowserTimeZone` (Function)
- `generateToken` (Function)
- `buildFeedUrl` (Function)
- `feedPayload` (Function)
- `useTaskCalendarFeed` (Function)
- `TaskCalendarFeed` (Interface)

**Function Details:**
- **`useTaskCalendarFeed`** — Custom React hook managing taskcalendarfeed state and side effects.
- **`getBrowserTimeZone`** — Utility function for get browser time zone.
- **`generateToken`** — Utility function for generate token.
- **`buildFeedUrl`** — Utility function for build feed url.
- **`feedPayload`** — Utility function for feed payload.
- **`useTaskCalendarFeed`** — Utility function for use task calendar feed.

**Lines:** 143

---

<a name="src-hooks-usetasks-ios-ts"></a>
### src/hooks/useTasks.ios.ts

**File Purpose:** Custom React hook. Encapsulates Tasks logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useTaskLists` (React Hook)
- `useTags` (React Hook)
- `useTasks` (React Hook)
- `useTasksByList` (React Hook)
- `useTasksByProject` (React Hook)
- `useTasksByTag` (React Hook)
- `useOverdueTasks` (React Hook)
- `useTodayTasks` (React Hook)
- `useUpcomingTasks` (React Hook)
- `useWeekTasks` (React Hook)
- `useCompletedTasks` (React Hook)
- `useCreateTask` (React Hook)
- `useCreateSubtask` (React Hook)
- `useUpdateTask` (React Hook)
- `useToggleTask` (React Hook)
- `useDeleteTask` (React Hook)
- `useCreateTaskList` (React Hook)
- `useUpdateTaskList` (React Hook)
- `useDeleteTaskList` (React Hook)
- `useCreateTag` (React Hook)
- `useUpdateTag` (React Hook)
- `useDeleteTag` (React Hook)
- `useTaskWithSubtasks` (React Hook)
- `useConvertTaskToHabit` (React Hook)
- `extractSubtasksFromDescription` (Function)
- `taskInsertPayload` (Function)
- `taskUpdatePayload` (Function)
- `useTaskLists` (Function)
- `useTags` (Function)
- `useTasks` (Function)
- `useTasksByList` (Function)
- `useTasksByProject` (Function)
- `useTasksByTag` (Function)
- `useOverdueTasks` (Function)
- `useTodayTasks` (Function)
- `useUpcomingTasks` (Function)
- `useWeekTasks` (Function)
- `useCompletedTasks` (Function)
- `useCreateTask` (Function)

**Function Details:**
- **`useTaskLists`** — Custom React hook managing tasklists state and side effects.
- **`useTags`** — Custom React hook managing tags state and side effects.
- **`useTasks`** — Custom React hook managing tasks state and side effects.
- **`useTasksByList`** — Custom React hook managing tasksbylist state and side effects.
- **`useTasksByProject`** — Custom React hook managing tasksbyproject state and side effects.
- **`extractSubtasksFromDescription`** — Utility function for extract subtasks from description.
- **`taskInsertPayload`** — Utility function for task insert payload.
- **`taskUpdatePayload`** — Utility function for task update payload.
- **`useTaskLists`** — Utility function for use task lists.
- **`useTags`** — Utility function for use tags.

**Lines:** 1146

---

<a name="src-hooks-usetasks-ts"></a>
### src/hooks/useTasks.ts

**File Purpose:** Custom React hook. Encapsulates Tasks.ts logic for data fetching, state management, or side effects.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-hooks-usetasks-web-ts"></a>
### src/hooks/useTasks.web.ts

**File Purpose:** Custom React hook. Encapsulates Tasks logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useTaskLists` (React Hook)
- `useTags` (React Hook)
- `useTasks` (React Hook)
- `useTasksByList` (React Hook)
- `useTasksByProject` (React Hook)
- `useTasksByTag` (React Hook)
- `useOverdueTasks` (React Hook)
- `useTodayTasks` (React Hook)
- `useUpcomingTasks` (React Hook)
- `useWeekTasks` (React Hook)
- `useCompletedTasks` (React Hook)
- `useCreateTask` (React Hook)
- `useCreateSubtask` (React Hook)
- `useUpdateTask` (React Hook)
- `useToggleTask` (React Hook)
- `useDeleteTask` (React Hook)
- `useCreateTaskList` (React Hook)
- `useUpdateTaskList` (React Hook)
- `useDeleteTaskList` (React Hook)
- `useCreateTag` (React Hook)
- `useUpdateTag` (React Hook)
- `useDeleteTag` (React Hook)
- `useTaskWithSubtasks` (React Hook)
- `useConvertTaskToHabit` (React Hook)
- `extractSubtasksFromDescription` (Function)
- `taskInsertPayload` (Function)
- `taskUpdatePayload` (Function)
- `useTaskLists` (Function)
- `useTags` (Function)
- `useTasks` (Function)
- `useTasksByList` (Function)
- `useTasksByProject` (Function)
- `useTasksByTag` (Function)
- `useOverdueTasks` (Function)
- `useTodayTasks` (Function)
- `useUpcomingTasks` (Function)
- `useWeekTasks` (Function)
- `useCompletedTasks` (Function)
- `useCreateTask` (Function)

**Function Details:**
- **`useTaskLists`** — Custom React hook managing tasklists state and side effects.
- **`useTags`** — Custom React hook managing tags state and side effects.
- **`useTasks`** — Custom React hook managing tasks state and side effects.
- **`useTasksByList`** — Custom React hook managing tasksbylist state and side effects.
- **`useTasksByProject`** — Custom React hook managing tasksbyproject state and side effects.
- **`extractSubtasksFromDescription`** — Utility function for extract subtasks from description.
- **`taskInsertPayload`** — Utility function for task insert payload.
- **`taskUpdatePayload`** — Utility function for task update payload.
- **`useTaskLists`** — Utility function for use task lists.
- **`useTags`** — Utility function for use tags.

**Lines:** 1139

---

<a name="src-hooks-useuserappsettingssync-ts"></a>
### src/hooks/useUserAppSettingsSync.ts

**File Purpose:** Custom React hook. Encapsulates UserAppSettingsSync.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `useUserAppSettingsSync` (React Hook)
- `useUserAppSettingsSync` (Function)

**Function Details:**
- **`useUserAppSettingsSync`** — Custom React hook managing userappsettingssync state and side effects.
- **`useUserAppSettingsSync`** — Utility function for use user app settings sync.

**Lines:** 117

---

<a name="src-hooks-useuserbanks-ts"></a>
### src/hooks/useUserBanks.ts

**File Purpose:** Custom React hook. Encapsulates UserBanks.ts logic for data fetching, state management, or side effects.

**Functions & Classes:**
- `DEFAULT_BANK_NAMES` (React Component)
- `useUserBanks` (React Hook)
- `useEnsureDefaultBanks` (React Hook)
- `useAddBank` (React Hook)
- `userBanksKey` (Function)
- `useUserBanks` (Function)
- `useEnsureDefaultBanks` (Function)
- `useAddBank` (Function)

**Function Details:**
- **`DEFAULT_BANK_NAMES`** — React component rendering UI for DEFAULT_BANK_NAMES.
- **`useUserBanks`** — Custom React hook managing userbanks state and side effects.
- **`useEnsureDefaultBanks`** — Custom React hook managing ensuredefaultbanks state and side effects.
- **`useAddBank`** — Custom React hook managing addbank state and side effects.
- **`userBanksKey`** — Utility function for user banks key.
- **`useUserBanks`** — Utility function for use user banks.
- **`useEnsureDefaultBanks`** — Utility function for use ensure default banks.
- **`useAddBank`** — Utility function for use add bank.

**Lines:** 87

---

<a name="src-index-css"></a>
### src/index.css

**File Purpose:** Global CSS stylesheet with Tailwind CSS v4 integration, theming system (dark/light/accent colors), animations, and iOS-specific styles.

**Keyframes:**
- `@keyframes modal-backdrop-in` — CSS animation definition
- `@keyframes modal-sheet-up` — CSS animation definition
- `@keyframes section-slide-in` — CSS animation definition
- `@keyframes loading-bar` — CSS animation definition
- `@keyframes report-count-up` — CSS animation definition
- `@keyframes report-section-in` — CSS animation definition
- `@keyframes report-ring-fill` — CSS animation definition

**CSS Classes/Selectors:** light, icon-touch, modal-backdrop-ios, modal-sheet-ios, 32, 72, section-slide-in, privacy-mode, recharts-wrapper, recharts-surface, recharts-tooltip-cursor, report-count-up, report-section-in, report-ring-fill, liquid-glass-card, no-scrollbar

**Lines:** 485

---

<a name="src-index-ios-css"></a>
### src/index.ios.css

**File Purpose:** Stylesheet. Provides CSS rules, animations, and theming for the application.

**Keyframes:**
- `@keyframes modal-backdrop-in` — CSS animation definition
- `@keyframes modal-sheet-up` — CSS animation definition
- `@keyframes section-slide-in` — CSS animation definition
- `@keyframes loading-bar` — CSS animation definition
- `@keyframes report-count-up` — CSS animation definition
- `@keyframes report-section-in` — CSS animation definition
- `@keyframes report-ring-fill` — CSS animation definition

**CSS Classes/Selectors:** light, icon-touch, modal-backdrop-ios, modal-sheet-ios, 32, 72, section-slide-in, privacy-mode, recharts-wrapper, recharts-surface, recharts-tooltip-cursor, report-count-up, report-section-in, report-ring-fill, liquid-glass-card, no-scrollbar

**Lines:** 485

---

<a name="src-index-web-css"></a>
### src/index.web.css

**File Purpose:** Stylesheet. Provides CSS rules, animations, and theming for the application.

**Keyframes:**
- `@keyframes modal-backdrop-in` — CSS animation definition
- `@keyframes modal-sheet-up` — CSS animation definition
- `@keyframes section-slide-in` — CSS animation definition
- `@keyframes loading-bar` — CSS animation definition
- `@keyframes report-count-up` — CSS animation definition
- `@keyframes report-section-in` — CSS animation definition
- `@keyframes report-ring-fill` — CSS animation definition

**CSS Classes/Selectors:** light, icon-touch, modal-backdrop-ios, modal-sheet-ios, 32, 72, section-slide-in, privacy-mode, recharts-wrapper, recharts-surface, recharts-tooltip-cursor, report-count-up, report-section-in, report-ring-fill, pake-platform, bg-card, no-scrollbar

**Lines:** 555

---

<a name="src-lib-ai-ts"></a>
### src/lib/ai.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `extractJSON` (Function)

**Function Details:**
- **`extractJSON`** — Utility function for extract j s o n.

**Lines:** 68

---

<a name="src-lib-analytics-utils-ts"></a>
### src/lib/analytics-utils.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `clamp` (Function)
- `pctChange` (Function)
- `sum` (Function)
- `formatSeconds` (Function)
- `formatMinutes` (Function)
- `mean` (Function)
- `stddev` (Function)
- `pearson` (Function)
- `regressionSlope` (Function)
- `regressionIntercept` (Function)
- `addDaysYmd` (Function)
- `eachDateInclusive` (Function)
- `quantile` (Function)
- `aggregateWeekly` (Function)

**Function Details:**
- **`clamp`** — Utility function for clamp.
- **`pctChange`** — Utility function for pct change.
- **`sum`** — Utility function for sum.
- **`formatSeconds`** — Utility function for format seconds.
- **`formatMinutes`** — Utility function for format minutes.

**Lines:** 148

---

<a name="src-lib-calendarexport-ts"></a>
### src/lib/calendarExport.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `toIcsDate` (Function)
- `icsEscape` (Function)
- `rrule` (Function)
- `buildIcs` (Function)
- `downloadCalendarIcs` (Function)

**Function Details:**
- **`toIcsDate`** — Utility function for to ics date.
- **`icsEscape`** — Utility function for ics escape.
- **`rrule`** — Utility function for rrule.
- **`buildIcs`** — Utility function for build ics.
- **`downloadCalendarIcs`** — Utility function for download calendar ics.

**Lines:** 96

---

<a name="src-lib-focussessionevents-ts"></a>
### src/lib/focusSessionEvents.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `requestFocusManualRecord` (Function)
- `onFocusManualRecord` (Function)

**Function Details:**
- **`requestFocusManualRecord`** — Utility function for request focus manual record.
- **`onFocusManualRecord`** — Utility function for on focus manual record.

**Lines:** 13

---

<a name="src-lib-icalsubscribe-ts"></a>
### src/lib/icalSubscribe.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `getCacheKey` (Function)
- `readIcalCache` (Function)
- `writeIcalCache` (Function)
- `unfold` (Function)
- `decodeText` (Function)
- `parsePropertyLine` (Function)
- `isDateOnlyProperty` (Function)
- `addDuration` (Function)
- `addOneDay` (Function)
- `parseDurationMinutes` (Function)
- `parseVevent` (Function)
- `parseVtodo` (Function)
- `parseIcalDate` (Function)
- `parseIcalDateTime` (Function)
- `parseIcalToEvents` (Function)
- `IcalEvent` (Interface)

**Function Details:**
- **`getCacheKey`** — Utility function for get cache key.
- **`readIcalCache`** — Utility function for read ical cache.
- **`writeIcalCache`** — Utility function for write ical cache.
- **`unfold`** — Utility function for unfold.
- **`decodeText`** — Utility function for decode text.

**Lines:** 344

---

<a name="src-lib-listidfromtagids-ts"></a>
### src/lib/listIdFromTagIds.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `listIdFromTagIds` (Function)

**Function Details:**
- **`listIdFromTagIds`** — Utility function for list id from tag ids.

**Lines:** 11

---

<a name="src-lib-logger-ts"></a>
### src/lib/logger.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `addSystemLog` (Function)
- `getSystemLogs` (Function)
- `clearSystemLogs` (Function)
- `SystemLog` (Interface)

**Function Details:**
- **`addSystemLog`** — Utility function for add system log.
- **`getSystemLogs`** — Utility function for get system logs.
- **`clearSystemLogs`** — Utility function for clear system logs.

**Lines:** 55

---

<a name="src-lib-nativebridge-ts"></a>
### src/lib/nativeBridge.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `setupDeepLinkListener` (Function)
- `hashCode` (Function)
- `generateEventInstances` (Function)
- `isHabitScheduledForDate` (Function)
- `parseTimeToMinutes` (Function)
- `isInQuietHours` (Function)
- `taskTriggerDate` (Function)
- `setupNotificationActionListeners` (Function)

**Function Details:**
- **`setupDeepLinkListener`** — Utility function for setup deep link listener.
- **`hashCode`** — Utility function for hash code.
- **`generateEventInstances`** — Utility function for generate event instances.
- **`isHabitScheduledForDate`** — Utility function for is habit scheduled for date.
- **`parseTimeToMinutes`** — Utility function for parse time to minutes.

**Lines:** 807

---

<a name="src-lib-offlinesync-ts"></a>
### src/lib/offlineSync.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `loadLastSyncFromStorage` (Function)
- `addToOfflineQueue` (Function)
- `isOnline` (Function)
- `getOfflineQueueLength` (Function)
- `getLastSyncAt` (Function)
- `QueuedOp` (Type)

**Function Details:**
- **`loadLastSyncFromStorage`** — Utility function for load last sync from storage.
- **`addToOfflineQueue`** — Utility function for add to offline queue.
- **`isOnline`** — Utility function for is online.
- **`getOfflineQueueLength`** — Utility function for get offline queue length.
- **`getLastSyncAt`** — Utility function for get last sync at.

**Lines:** 161

---

<a name="src-lib-otaupdater-ts"></a>
### src/lib/otaUpdater.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `resolveOtaBundleUrl` (Function)

**Function Details:**
- **`resolveOtaBundleUrl`** — Utility function for resolve ota bundle url.

**Lines:** 79

---

<a name="src-lib-prayergeocoding-ts"></a>
### src/lib/prayerGeocoding.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `formatOpenMeteoLabel` (Function)
- `GeocodeHit` (Type)

**Function Details:**
- **`formatOpenMeteoLabel`** — Utility function for format open meteo label.

**Lines:** 87

---

<a name="src-lib-prayerstatus-test-ts"></a>
### src/lib/prayerStatus.test.ts

**File Purpose:** Unit/integration tests for the corresponding implementation file.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 32

---

<a name="src-lib-prayerstatus-ts"></a>
### src/lib/prayerStatus.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `isPrayerStatusComplete` (Function)
- `getPrayerStatusChoices` (Function)

**Function Details:**
- **`isPrayerStatusComplete`** — Utility function for is prayer status complete.
- **`getPrayerStatusChoices`** — Utility function for get prayer status choices.

**Lines:** 10

---

<a name="src-lib-push-ts"></a>
### src/lib/push.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `urlBase64ToUint8Array` (Function)
- `isPushSupported` (Function)
- `isVapidConfigured` (Function)
- `subscriptionToJson` (Function)

**Function Details:**
- **`urlBase64ToUint8Array`** — Utility function for url base64 to uint8 array.
- **`isPushSupported`** — Utility function for is push supported.
- **`isVapidConfigured`** — Utility function for is vapid configured.
- **`subscriptionToJson`** — Utility function for subscription to json.

**Lines:** 69

---

<a name="src-lib-queryclient-ts"></a>
### src/lib/queryClient.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 18

---

<a name="src-lib-reportsuggestions-ts"></a>
### src/lib/reportSuggestions.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `groupByDow` (Function)
- `generateSuggestions` (Function)
- `Suggestion` (Interface)

**Function Details:**
- **`groupByDow`** — Utility function for group by dow.
- **`generateSuggestions`** — Utility function for generate suggestions.

**Lines:** 156

---

<a name="src-lib-screentimeplatform-ts"></a>
### src/lib/screentimePlatform.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `screentimeDateKey` (Function)
- `screentimeUiPlatform` (Function)
- `platformLabelTracked` (Function)
- `ScreentimeUiPlatform` (Type)

**Function Details:**
- **`screentimeDateKey`** — Utility function for screentime date key.
- **`screentimeUiPlatform`** — Utility function for screentime ui platform.
- **`platformLabelTracked`** — Utility function for platform label tracked.

**Lines:** 39

---

<a name="src-lib-supabase-ts"></a>
### src/lib/supabase.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 22

---

<a name="src-lib-taskinputsuggestions-ts"></a>
### src/lib/taskInputSuggestions.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `nextDayOfWeek` (Function)
- `parseTimeString` (Function)
- `mapPriorityShortcut` (Function)
- `parseTaskInput` (Function)
- `toDateString` (Function)
- `TaskInputParseResult` (Interface)
- `SuggestionTrigger` (Type)

**Function Details:**
- **`nextDayOfWeek`** — Utility function for next day of week.
- **`parseTimeString`** — Utility function for parse time string.
- **`mapPriorityShortcut`** — Utility function for map priority shortcut.
- **`parseTaskInput`** — Utility function for parse task input.
- **`toDateString`** — Utility function for to date string.

**Lines:** 514

---

<a name="src-lib-userappsettings-ts"></a>
### src/lib/userAppSettings.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `isRecord` (Function)
- `asBool` (Function)
- `asStr` (Function)
- `asStrOrNull` (Function)
- `asNum` (Function)
- `asStrArray` (Function)
- `normalizeMobileNavItems` (Function)
- `asRecordBool` (Function)
- `asPageOrder` (Function)
- `asPageVisible` (Function)
- `asDashboardMode` (Function)
- `asStrategicHorizonDays` (Function)
- `asAnnualReviewNotesByYear` (Function)
- `parsePersistedUiFromRemote` (Function)

**Function Details:**
- **`isRecord`** — Utility function for is record.
- **`asBool`** — Utility function for as bool.
- **`asStr`** — Utility function for as str.
- **`asStrOrNull`** — Utility function for as str or null.
- **`asNum`** — Utility function for as num.

**Lines:** 192

---

<a name="src-lib-utils-test-ts"></a>
### src/lib/utils.test.ts

**File Purpose:** Unit/integration tests for the corresponding implementation file.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 47

---

<a name="src-lib-utils-ts"></a>
### src/lib/utils.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `CURRENCY_SYMBOL` (React Component)
- `cn` (Function)
- `round1` (Function)
- `formatCurrency` (Function)
- `formatTime12h` (Function)
- `formatDuration` (Function)

**Function Details:**
- **`CURRENCY_SYMBOL`** — React component rendering UI for CURRENCY_SYMBOL.
- **`cn`** — Utility function for cn.
- **`round1`** — Utility function for round1.
- **`formatCurrency`** — Utility function for format currency.
- **`formatTime12h`** — Utility function for format time12h.
- **`formatDuration`** — Utility function for format duration.

**Lines:** 46

---

<a name="src-lib-wikidata-ts"></a>
### src/lib/wikiData.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `escapeRegExp` (Function)
- `normalizeTitle` (Function)
- `getSection` (Function)
- `getSubSection` (Function)
- `buildTitleSet` (Function)
- `autoLink` (Function)
- `getWikiPage` (Function)
- `searchWikiPages` (Function)
- `getWikiLinkGraph` (Function)
- `WikiDocPage` (Interface)
- `WikiGraphNodeInfo` (Interface)

**Function Details:**
- **`escapeRegExp`** — Utility function for escape reg exp.
- **`normalizeTitle`** — Utility function for normalize title.
- **`getSection`** — Utility function for get section.
- **`getSubSection`** — Utility function for get sub section.
- **`buildTitleSet`** — Utility function for build title set.

**Lines:** 413

---

<a name="src-lib-wikistorage-ts"></a>
### src/lib/wikiStorage.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `normalizeTitle` (Function)
- `loadPages` (Function)
- `savePages` (Function)
- `getAllPages` (Function)
- `getPageByTitle` (Function)
- `getPageById` (Function)
- `savePage` (Function)
- `deletePage` (Function)
- `searchPages` (Function)
- `extractWikiLinks` (Function)
- `getLinkGraph` (Function)
- `seedWikiIfEmpty` (Function)

**Function Details:**
- **`normalizeTitle`** — Utility function for normalize title.
- **`loadPages`** — Utility function for load pages.
- **`savePages`** — Utility function for save pages.
- **`getAllPages`** — Utility function for get all pages.
- **`getPageByTitle`** — Utility function for get page by title.

**Lines:** 140

---

<a name="src-lib-wraphelpers-ts"></a>
### src/lib/wrapHelpers.ts

**File Purpose:** Utility library module. Provides helper functions, client configuration, or domain-specific logic.

**Functions & Classes:**
- `getWeeklyWrapKey` (Function)
- `getMonthlyWrapKey` (Function)
- `checkWrapStatus` (Function)

**Function Details:**
- **`getWeeklyWrapKey`** — Utility function for get weekly wrap key.
- **`getMonthlyWrapKey`** — Utility function for get monthly wrap key.
- **`checkWrapStatus`** — Utility function for check wrap status.

**Lines:** 34

---

<a name="src-main-tsx"></a>
### src/main.tsx

**File Purpose:** Application entry point. Bootstraps the React root component into the DOM.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 10

---

<a name="src-routes-analytics-tsx"></a>
### src/routes/Analytics.tsx

**File Purpose:** Page-level route component for the Analytics.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Analytics` (React Component)
- `Analytics` (Function)

**Function Details:**
- **`Analytics`** — React component rendering UI for Analytics.
- **`Analytics`** — Utility function for analytics.

**Lines:** 811

---

<a name="src-routes-calendar-ios-tsx"></a>
### src/routes/Calendar.ios.tsx

**File Purpose:** Page-level route component for the Calendar module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `CalendarPage` (React Component)
- `CalendarPage` (Function)

**Function Details:**
- **`CalendarPage`** — React component rendering UI for CalendarPage.
- **`CalendarPage`** — Utility function for calendar page.

**Lines:** 1729

---

<a name="src-routes-calendar-pake-tsx"></a>
### src/routes/Calendar.pake.tsx

**File Purpose:** Page-level route component for the Calendar module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `CalendarPage` (React Component)
- `CalendarPage` (Function)

**Function Details:**
- **`CalendarPage`** — React component rendering UI for CalendarPage.
- **`CalendarPage`** — Utility function for calendar page.

**Lines:** 1733

---

<a name="src-routes-calendar-tsx"></a>
### src/routes/Calendar.tsx

**File Purpose:** Page-level route component for the Calendar.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 3

---

<a name="src-routes-calendar-web-tsx"></a>
### src/routes/Calendar.web.tsx

**File Purpose:** Page-level route component for the Calendar module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `CalendarPage` (React Component)
- `CalendarPage` (Function)

**Function Details:**
- **`CalendarPage`** — React component rendering UI for CalendarPage.
- **`CalendarPage`** — Utility function for calendar page.

**Lines:** 1708

---

<a name="src-routes-dashboard-tsx"></a>
### src/routes/Dashboard.tsx

**File Purpose:** Page-level route component for the Dashboard.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `DashboardEntryDetails` (React Component)
- `ModeBody` (React Component)
- `Dashboard` (React Component)
- `getPrayerNameFromEntry` (Function)
- `pickRandomPrayerHadith` (Function)
- `DashboardEntryDetails` (Function)
- `ModeBody` (Function)
- `parseDueDateTime` (Function)
- `Dashboard` (Function)

**Function Details:**
- **`DashboardEntryDetails`** — React component rendering UI for DashboardEntryDetails.
- **`ModeBody`** — React component rendering UI for ModeBody.
- **`Dashboard`** — React component rendering UI for Dashboard.
- **`getPrayerNameFromEntry`** — Utility function for get prayer name from entry.
- **`pickRandomPrayerHadith`** — Utility function for pick random prayer hadith.
- **`DashboardEntryDetails`** — Utility function for dashboard entry details.
- **`ModeBody`** — Utility function for mode body.
- **`parseDueDateTime`** — Utility function for parse due date time.

**Lines:** 1086

---

<a name="src-routes-finance-ios-tsx"></a>
### src/routes/Finance.ios.tsx

**File Purpose:** Page-level route component for the Finance module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Finance` (React Component)
- `Finance` (Function)

**Function Details:**
- **`Finance`** — React component rendering UI for Finance.
- **`Finance`** — Utility function for finance.

**Lines:** 1955

---

<a name="src-routes-finance-pake-tsx"></a>
### src/routes/Finance.pake.tsx

**File Purpose:** Page-level route component for the Finance module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Finance` (React Component)
- `Finance` (Function)

**Function Details:**
- **`Finance`** — React component rendering UI for Finance.
- **`Finance`** — Utility function for finance.

**Lines:** 1772

---

<a name="src-routes-finance-tsx"></a>
### src/routes/Finance.tsx

**File Purpose:** Page-level route component for the Finance.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 3

---

<a name="src-routes-finance-web-tsx"></a>
### src/routes/Finance.web.tsx

**File Purpose:** Page-level route component for the Finance module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Finance` (React Component)
- `Finance` (Function)

**Function Details:**
- **`Finance`** — React component rendering UI for Finance.
- **`Finance`** — Utility function for finance.

**Lines:** 1869

---

<a name="src-routes-focus-tsx"></a>
### src/routes/Focus.tsx

**File Purpose:** Page-level route component for the Focus.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Focus` (React Component)
- `Focus` (Function)

**Function Details:**
- **`Focus`** — React component rendering UI for Focus.
- **`Focus`** — Utility function for focus.

**Lines:** 271

---

<a name="src-routes-habits-ios-tsx"></a>
### src/routes/Habits.ios.tsx

**File Purpose:** Page-level route component for the Habits module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Habits` (React Component)
- `parseLegacyDetoxDescription` (Function)
- `getDetoxConfig` (Function)
- `getHabitType` (Function)
- `getVisibleDescription` (Function)
- `weeksSince` (Function)
- `computeDetoxTarget` (Function)
- `Habits` (Function)

**Function Details:**
- **`Habits`** — React component rendering UI for Habits.
- **`parseLegacyDetoxDescription`** — Utility function for parse legacy detox description.
- **`getDetoxConfig`** — Utility function for get detox config.
- **`getHabitType`** — Utility function for get habit type.
- **`getVisibleDescription`** — Utility function for get visible description.
- **`weeksSince`** — Utility function for weeks since.

**Lines:** 1410

---

<a name="src-routes-habits-pake-tsx"></a>
### src/routes/Habits.pake.tsx

**File Purpose:** Page-level route component for the Habits module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Habits` (React Component)
- `parseLegacyDetoxDescription` (Function)
- `getDetoxConfig` (Function)
- `getHabitType` (Function)
- `weeksSince` (Function)
- `computeDetoxTarget` (Function)
- `Habits` (Function)

**Function Details:**
- **`Habits`** — React component rendering UI for Habits.
- **`parseLegacyDetoxDescription`** — Utility function for parse legacy detox description.
- **`getDetoxConfig`** — Utility function for get detox config.
- **`getHabitType`** — Utility function for get habit type.
- **`weeksSince`** — Utility function for weeks since.
- **`computeDetoxTarget`** — Utility function for compute detox target.

**Lines:** 706

---

<a name="src-routes-habits-tsx"></a>
### src/routes/Habits.tsx

**File Purpose:** Page-level route component for the Habits.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 3

---

<a name="src-routes-habits-web-tsx"></a>
### src/routes/Habits.web.tsx

**File Purpose:** Page-level route component for the Habits module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Habits` (React Component)
- `parseLegacyDetoxDescription` (Function)
- `getDetoxConfig` (Function)
- `getHabitType` (Function)
- `getVisibleDescription` (Function)
- `weeksSince` (Function)
- `computeDetoxTarget` (Function)
- `Habits` (Function)

**Function Details:**
- **`Habits`** — React component rendering UI for Habits.
- **`parseLegacyDetoxDescription`** — Utility function for parse legacy detox description.
- **`getDetoxConfig`** — Utility function for get detox config.
- **`getHabitType`** — Utility function for get habit type.
- **`getVisibleDescription`** — Utility function for get visible description.
- **`weeksSince`** — Utility function for weeks since.

**Lines:** 1437

---

<a name="src-routes-health-tsx"></a>
### src/routes/Health.tsx

**File Purpose:** Page-level route component for the Health.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Health` (React Component)
- `DiffBadge` (React Component)
- `Health` (Function)
- `DiffBadge` (Function)

**Function Details:**
- **`Health`** — React component rendering UI for Health.
- **`DiffBadge`** — React component rendering UI for DiffBadge.
- **`Health`** — Utility function for health.
- **`DiffBadge`** — Utility function for diff badge.

**Lines:** 403

---

<a name="src-routes-landing-tsx"></a>
### src/routes/Landing.tsx

**File Purpose:** Page-level route component for the Landing.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `GoogleIcon` (React Component)
- `Counter` (React Component)
- `RotatingWord` (React Component)
- `FeatureCard` (React Component)
- `Landing` (React Component)
- `GoogleIcon` (Function)
- `Counter` (Function)
- `RotatingWord` (Function)
- `FeatureCard` (Function)
- `Landing` (Function)

**Function Details:**
- **`GoogleIcon`** — React component rendering UI for GoogleIcon.
- **`Counter`** — React component rendering UI for Counter.
- **`RotatingWord`** — React component rendering UI for RotatingWord.
- **`FeatureCard`** — React component rendering UI for FeatureCard.
- **`Landing`** — React component rendering UI for Landing.
- **`GoogleIcon`** — Utility function for google icon.
- **`Counter`** — Utility function for counter.
- **`RotatingWord`** — Utility function for rotating word.
- **`FeatureCard`** — Utility function for feature card.
- **`Landing`** — Utility function for landing.

**Lines:** 511

---

<a name="src-routes-login-tsx"></a>
### src/routes/Login.tsx

**File Purpose:** Page-level route component for the Login.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `GoogleIcon` (React Component)
- `Login` (React Component)
- `GoogleIcon` (Function)
- `Login` (Function)

**Function Details:**
- **`GoogleIcon`** — React component rendering UI for GoogleIcon.
- **`Login`** — React component rendering UI for Login.
- **`GoogleIcon`** — Utility function for google icon.
- **`Login`** — Utility function for login.

**Lines:** 164

---

<a name="src-routes-notes-tsx"></a>
### src/routes/Notes.tsx

**File Purpose:** Page-level route component for the Notes.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Notes` (React Component)
- `todayInputDate` (Function)
- `noteTitle` (Function)
- `formatNoteDate` (Function)
- `Notes` (Function)

**Function Details:**
- **`Notes`** — React component rendering UI for Notes.
- **`todayInputDate`** — Utility function for today input date.
- **`noteTitle`** — Utility function for note title.
- **`formatNoteDate`** — Utility function for format note date.
- **`Notes`** — Utility function for notes.

**Lines:** 461

---

<a name="src-routes-points-tsx"></a>
### src/routes/Points.tsx

**File Purpose:** Page-level route component for the Points.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Points` (React Component)
- `Points` (Function)

**Function Details:**
- **`Points`** — React component rendering UI for Points.
- **`Points`** — Utility function for points.

**Lines:** 370

---

<a name="src-routes-screentime-ios-tsx"></a>
### src/routes/Screentime.ios.tsx

**File Purpose:** Page-level route component for the Screentime module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Screentime` (React Component)
- `formatDurationMinutes` (Function)
- `isBrowserApp` (Function)
- `Screentime` (Function)
- `hexLighten` (Function)
- `hslToHex` (Function)

**Function Details:**
- **`Screentime`** — React component rendering UI for Screentime.
- **`formatDurationMinutes`** — Utility function for format duration minutes.
- **`isBrowserApp`** — Utility function for is browser app.
- **`Screentime`** — Utility function for screentime.
- **`hexLighten`** — Utility function for hex lighten.
- **`hslToHex`** — Utility function for hsl to hex.

**Lines:** 1367

---

<a name="src-routes-screentime-tsx"></a>
### src/routes/Screentime.tsx

**File Purpose:** Page-level route component for the Screentime.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 3

---

<a name="src-routes-screentime-web-tsx"></a>
### src/routes/Screentime.web.tsx

**File Purpose:** Page-level route component for the Screentime module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Screentime` (React Component)
- `formatDurationMinutes` (Function)
- `isBrowserApp` (Function)
- `Screentime` (Function)
- `hexLighten` (Function)
- `hslToHex` (Function)

**Function Details:**
- **`Screentime`** — React component rendering UI for Screentime.
- **`formatDurationMinutes`** — Utility function for format duration minutes.
- **`isBrowserApp`** — Utility function for is browser app.
- **`Screentime`** — Utility function for screentime.
- **`hexLighten`** — Utility function for hex lighten.
- **`hslToHex`** — Utility function for hsl to hex.

**Lines:** 1303

---

<a name="src-routes-settings-ios-tsx"></a>
### src/routes/Settings.ios.tsx

**File Purpose:** Page-level route component for the Settings module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `SettingsPage` (React Component)
- `SettingsPage` (Function)

**Function Details:**
- **`SettingsPage`** — React component rendering UI for SettingsPage.
- **`SettingsPage`** — Utility function for settings page.

**Lines:** 1541

---

<a name="src-routes-settings-tsx"></a>
### src/routes/Settings.tsx

**File Purpose:** Page-level route component for the Settings.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 3

---

<a name="src-routes-settings-web-tsx"></a>
### src/routes/Settings.web.tsx

**File Purpose:** Page-level route component for the Settings module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `SettingsPage` (React Component)
- `SettingsPage` (Function)

**Function Details:**
- **`SettingsPage`** — React component rendering UI for SettingsPage.
- **`SettingsPage`** — Utility function for settings page.

**Lines:** 1434

---

<a name="src-routes-signup-tsx"></a>
### src/routes/Signup.tsx

**File Purpose:** Page-level route component for the Signup.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `GoogleIcon` (React Component)
- `PasswordRequirement` (React Component)
- `Signup` (React Component)
- `GoogleIcon` (Function)
- `PasswordRequirement` (Function)
- `Signup` (Function)

**Function Details:**
- **`GoogleIcon`** — React component rendering UI for GoogleIcon.
- **`PasswordRequirement`** — React component rendering UI for PasswordRequirement.
- **`Signup`** — React component rendering UI for Signup.
- **`GoogleIcon`** — Utility function for google icon.
- **`PasswordRequirement`** — Utility function for password requirement.
- **`Signup`** — Utility function for signup.

**Lines:** 220

---

<a name="src-routes-sleep-ios-tsx"></a>
### src/routes/Sleep.ios.tsx

**File Purpose:** Page-level route component for the Sleep module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Sleep` (React Component)
- `buildSessions` (Function)
- `Sleep` (Function)

**Function Details:**
- **`Sleep`** — React component rendering UI for Sleep.
- **`buildSessions`** — Utility function for build sessions.
- **`Sleep`** — Utility function for sleep.

**Lines:** 624

---

<a name="src-routes-sleep-pake-tsx"></a>
### src/routes/Sleep.pake.tsx

**File Purpose:** Page-level route component for the Sleep module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Sleep` (React Component)
- `buildSessions` (Function)
- `Sleep` (Function)

**Function Details:**
- **`Sleep`** — React component rendering UI for Sleep.
- **`buildSessions`** — Utility function for build sessions.
- **`Sleep`** — Utility function for sleep.

**Lines:** 650

---

<a name="src-routes-sleep-tsx"></a>
### src/routes/Sleep.tsx

**File Purpose:** Page-level route component for the Sleep.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 3

---

<a name="src-routes-sleep-web-tsx"></a>
### src/routes/Sleep.web.tsx

**File Purpose:** Page-level route component for the Sleep module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Sleep` (React Component)
- `buildSessions` (Function)
- `Sleep` (Function)

**Function Details:**
- **`Sleep`** — React component rendering UI for Sleep.
- **`buildSessions`** — Utility function for build sessions.
- **`Sleep`** — Utility function for sleep.

**Lines:** 616

---

<a name="src-routes-tasks-ios-tsx"></a>
### src/routes/Tasks.ios.tsx

**File Purpose:** Page-level route component for the Tasks module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Tasks` (React Component)
- `TaskItem` (React Component)
- `parseDueDateTime` (Function)
- `Tasks` (Function)
- `getDefaultEditFormForNewTask` (Function)
- `TaskItem` (Function)

**Function Details:**
- **`Tasks`** — React component rendering UI for Tasks.
- **`TaskItem`** — React component rendering UI for TaskItem.
- **`parseDueDateTime`** — Utility function for parse due date time.
- **`Tasks`** — Utility function for tasks.
- **`getDefaultEditFormForNewTask`** — Utility function for get default edit form for new task.
- **`TaskItem`** — Utility function for task item.

**Lines:** 3481

---

<a name="src-routes-tasks-pake-tsx"></a>
### src/routes/Tasks.pake.tsx

**File Purpose:** Page-level route component for the Tasks module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Tasks` (React Component)
- `TaskItem` (React Component)
- `parseDueDateTime` (Function)
- `Tasks` (Function)
- `getDefaultEditFormForNewTask` (Function)
- `TaskItem` (Function)

**Function Details:**
- **`Tasks`** — React component rendering UI for Tasks.
- **`TaskItem`** — React component rendering UI for TaskItem.
- **`parseDueDateTime`** — Utility function for parse due date time.
- **`Tasks`** — Utility function for tasks.
- **`getDefaultEditFormForNewTask`** — Utility function for get default edit form for new task.
- **`TaskItem`** — Utility function for task item.

**Lines:** 2739

---

<a name="src-routes-tasks-tsx"></a>
### src/routes/Tasks.tsx

**File Purpose:** Page-level route component for the Tasks.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 3

---

<a name="src-routes-tasks-web-tsx"></a>
### src/routes/Tasks.web.tsx

**File Purpose:** Page-level route component for the Tasks module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Tasks` (React Component)
- `TaskItem` (React Component)
- `parseDueDateTime` (Function)
- `Tasks` (Function)
- `getDefaultEditFormForNewTask` (Function)
- `TaskItem` (Function)

**Function Details:**
- **`Tasks`** — React component rendering UI for Tasks.
- **`TaskItem`** — React component rendering UI for TaskItem.
- **`parseDueDateTime`** — Utility function for parse due date time.
- **`Tasks`** — Utility function for tasks.
- **`getDefaultEditFormForNewTask`** — Utility function for get default edit form for new task.
- **`TaskItem`** — Utility function for task item.

**Lines:** 2796

---

<a name="src-routes-weeklyplanner-tsx"></a>
### src/routes/WeeklyPlanner.tsx

**File Purpose:** Page-level route component for the WeeklyPlanner.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `WeeklyPlanner` (React Component)
- `MustDoList` (React Component)
- `AppointmentsList` (React Component)
- `DailyHabitsList` (React Component)
- `DailyNoteArea` (React Component)
- `SelfCareCard` (React Component)
- `WeeklyPlanner` (Function)
- `MustDoList` (Function)
- `AppointmentsList` (Function)
- `DailyHabitsList` (Function)
- `DailyNoteArea` (Function)
- `SelfCareCard` (Function)

**Function Details:**
- **`WeeklyPlanner`** — React component rendering UI for WeeklyPlanner.
- **`MustDoList`** — React component rendering UI for MustDoList.
- **`AppointmentsList`** — React component rendering UI for AppointmentsList.
- **`DailyHabitsList`** — React component rendering UI for DailyHabitsList.
- **`DailyNoteArea`** — React component rendering UI for DailyNoteArea.
- **`WeeklyPlanner`** — Utility function for weekly planner.
- **`MustDoList`** — Utility function for must do list.
- **`AppointmentsList`** — Utility function for appointments list.
- **`DailyHabitsList`** — Utility function for daily habits list.
- **`DailyNoteArea`** — Utility function for daily note area.

**Lines:** 1198

---

<a name="src-routes-wiki-tsx"></a>
### src/routes/Wiki.tsx

**File Purpose:** Page-level route component for the Wiki.tsx module. Renders the main view when navigating to this section.

**Functions & Classes:**
- `Wiki` (React Component)
- `Wiki` (Function)

**Function Details:**
- **`Wiki`** — React component rendering UI for Wiki.
- **`Wiki`** — Utility function for wiki.

**Lines:** 578

---

<a name="src-setuptests-ts"></a>
### src/setupTests.ts

**File Purpose:** Test environment setup. Imports Jest DOM matchers for Vitest compatibility.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 2

---

<a name="src-stores-usefocussessionstore-ts"></a>
### src/stores/useFocusSessionStore.ts

**File Purpose:** Zustand state store. Manages global or domain-specific client-side state.

**Functions & Classes:**
- `useFocusSessionStore` (React Hook)
- `SelectedTaskInfo` (Interface)
- `FocusPhase` (Type)

**Function Details:**
- **`useFocusSessionStore`** — Custom React hook managing focussessionstore state and side effects.

**Lines:** 97

---

<a name="src-stores-useuistore-ts"></a>
### src/stores/useUIStore.ts

**File Purpose:** Zustand state store. Manages global or domain-specific client-side state.

**Functions & Classes:**
- `DEFAULT_MOBILE_NAV` (React Component)
- `DEFAULT_DESKTOP_NAV` (React Component)
- `DASHBOARD_WIDGET_IDS` (React Component)
- `SLEEP_WIDGET_IDS` (React Component)
- `HABITS_WIDGET_IDS` (React Component)
- `ACCENT_THEMES` (React Component)
- `DASHBOARD_MODES` (React Component)
- `useUIStore` (React Hook)
- `isDashboardMode` (Function)
- `getPersistedUiSlice` (Function)
- `DashboardWidgetId` (Type)
- `SleepWidgetId` (Type)
- `HabitsWidgetId` (Type)
- `AccentTheme` (Type)
- `PrayerLocationMode` (Type)
- `DashboardMode` (Type)
- `StrategicHorizonDays` (Type)
- `PersistedUiSlice` (Type)

**Function Details:**
- **`DEFAULT_MOBILE_NAV`** — React component rendering UI for DEFAULT_MOBILE_NAV.
- **`DEFAULT_DESKTOP_NAV`** — React component rendering UI for DEFAULT_DESKTOP_NAV.
- **`DASHBOARD_WIDGET_IDS`** — React component rendering UI for DASHBOARD_WIDGET_IDS.
- **`SLEEP_WIDGET_IDS`** — React component rendering UI for SLEEP_WIDGET_IDS.
- **`HABITS_WIDGET_IDS`** — React component rendering UI for HABITS_WIDGET_IDS.
- **`useUIStore`** — Custom React hook managing uistore state and side effects.
- **`isDashboardMode`** — Utility function for is dashboard mode.
- **`getPersistedUiSlice`** — Utility function for get persisted ui slice.

**Lines:** 577

---

<a name="src-stores-usewikistore-ts"></a>
### src/stores/useWikiStore.ts

**File Purpose:** Zustand state store. Manages global or domain-specific client-side state.

**Functions & Classes:**
- `useWikiStore` (React Hook)

**Function Details:**
- **`useWikiStore`** — Custom React hook managing wikistore state and side effects.

**Lines:** 91

---

<a name="src-sw-ts"></a>
### src/sw.ts

**File Purpose:** Service Worker for PWA functionality. Handles precaching, offline navigation fallback, background sync, and push notifications.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 168

---

<a name="src-types-schema-ts"></a>
### src/types/schema.ts

**File Purpose:** TypeScript type definitions. Centralized type declarations for the application.

**Functions & Classes:**
- `InBodyScan` (Interface)
- `ScreentimeAppStat` (Interface)
- `ScreentimeWebsiteStat` (Interface)
- `ScreentimeDailySummary` (Interface)
- `SleepStage` (Interface)
- `PrayerHabit` (Interface)
- `PrayerLog` (Interface)
- `PrayerNotificationSetting` (Interface)
- `CalendarEvent` (Interface)
- `Note` (Interface)
- `NoteFolder` (Interface)
- `TaskList` (Interface)
- `Tag` (Interface)
- `Task` (Interface)
- `TaskWithSubtasks` (Interface)
- `Habit` (Interface)
- `HabitLog` (Interface)
- `Transaction` (Interface)
- `UserBank` (Interface)
- `InvestmentAccount` (Interface)
- `InvestmentTransaction` (Interface)
- `AppSettings` (Interface)
- `PointTransaction` (Interface)
- `CustomReward` (Interface)
- `SleepStageType` (Type)
- `PrayerName` (Type)
- `PrayerStatus` (Type)
- `EventType` (Type)
- `RecurrencePattern` (Type)
- `TaskPriority` (Type)
- `TaskRecurrence` (Type)
- `TaskRecurrenceEndType` (Type)
- `HabitFrequency` (Type)
- `HabitType` (Type)
- `DetoxMode` (Type)
- `TransactionType` (Type)
- `TransactionCategory` (Type)
- `CreateInput` (Type)
- `UpdateInput` (Type)

**Lines:** 412

---

<a name="src-types-wiki-ts"></a>
### src/types/wiki.ts

**File Purpose:** TypeScript type definitions. Centralized type declarations for the application.

**Functions & Classes:**
- `WikiPage` (Interface)
- `WikiLink` (Interface)
- `WikiGraphNode` (Interface)
- `WikiGraphEdge` (Interface)

**Lines:** 32

---

<a name="supabase--temp-linked-project-json"></a>
### supabase/.temp/linked-project.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 1

---

<a name="supabase-config-toml"></a>
### supabase/config.toml

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:** None (configuration file)

**Lines:** 25

---

<a name="supabase-functions-calendar-feed-index-ts"></a>
### supabase/functions/calendar-feed/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `getAllowedOrigins` (Function)
- `corsHeadersFor` (Function)
- `escapeText` (Function)
- `sanitizeUrl` (Function)
- `formatUtcStamp` (Function)
- `parseDateParts` (Function)
- `parseTimeParts` (Function)
- `formatDateValue` (Function)
- `formatUtcDateTime` (Function)
- `formatLocalDateOnly` (Function)
- `getTimeZoneOffsetMs` (Function)
- `zonedDateTimeToUtc` (Function)
- `getUsualTimeForHabit` (Function)
- `foldLine` (Function)
- `isValidToken` (Function)

**Function Details:**
- **`getAllowedOrigins`** — Utility function for get allowed origins.
- **`corsHeadersFor`** — Utility function for cors headers for.
- **`escapeText`** — Utility function for escape text.
- **`sanitizeUrl`** — Utility function for sanitize url.
- **`formatUtcStamp`** — Utility function for format utc stamp.

**Lines:** 514

---

<a name="supabase-functions-calendar-notifications-dispatch-index-ts"></a>
### supabase/functions/calendar-notifications-dispatch/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `getAllowedOrigins` (Function)
- `corsHeadersFor` (Function)
- `isEventAtTime` (Function)

**Function Details:**
- **`getAllowedOrigins`** — Utility function for get allowed origins.
- **`corsHeadersFor`** — Utility function for cors headers for.
- **`isEventAtTime`** — Utility function for is event at time.

**Lines:** 237

---

<a name="supabase-functions-deno-d-ts"></a>
### supabase/functions/deno.d.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `serve` (Function)
- `createClient` (Function)
- `get` (Function)
- `createClient` (Function)

**Function Details:**
- **`serve`** — Utility function for serve.
- **`createClient`** — Utility function for create client.
- **`get`** — Utility function for get.
- **`createClient`** — Utility function for create client.

**Lines:** 59

---

<a name="supabase-functions-habit-notifications-dispatch-index-ts"></a>
### supabase/functions/habit-notifications-dispatch/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `getAllowedOrigins` (Function)
- `corsHeadersFor` (Function)
- `toLocalDateTime` (Function)
- `normalizeMinuteOfDay` (Function)
- `parseTimeToMinutes` (Function)
- `isHabitScheduledForDay` (Function)
- `isDueNow` (Function)
- `bucketMinuteOfDay` (Function)
- `getLocalMinuteOfDay` (Function)
- `inferHabitNotifyMinute` (Function)
- `isPrayerTitle` (Function)

**Function Details:**
- **`getAllowedOrigins`** — Utility function for get allowed origins.
- **`corsHeadersFor`** — Utility function for cors headers for.
- **`toLocalDateTime`** — Utility function for to local date time.
- **`normalizeMinuteOfDay`** — Utility function for normalize minute of day.
- **`parseTimeToMinutes`** — Utility function for parse time to minutes.

**Lines:** 432

---

<a name="supabase-functions-prayer-notifications-dispatch-index-ts"></a>
### supabase/functions/prayer-notifications-dispatch/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `getAllowedOrigins` (Function)
- `corsHeadersFor` (Function)
- `toLocalDateTime` (Function)
- `parseTimeToMinutes` (Function)
- `isInQuietHours` (Function)
- `isDueNow` (Function)

**Function Details:**
- **`getAllowedOrigins`** — Utility function for get allowed origins.
- **`corsHeadersFor`** — Utility function for cors headers for.
- **`toLocalDateTime`** — Utility function for to local date time.
- **`parseTimeToMinutes`** — Utility function for parse time to minutes.
- **`isInQuietHours`** — Utility function for is in quiet hours.

**Lines:** 245

---

<a name="supabase-functions-process-sms-index-ts"></a>
### supabase/functions/process-sms/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `getMessageFromBody` (Function)
- `getUserIdFromBody` (Function)
- `isPromotionQuickFilter` (Function)
- `parseFormUrlEncoded` (Function)
- `toSchemaCategory` (Function)
- `getDefaultCategory` (Function)

**Function Details:**
- **`getMessageFromBody`** — Utility function for get message from body.
- **`getUserIdFromBody`** — Utility function for get user id from body.
- **`isPromotionQuickFilter`** — Utility function for is promotion quick filter.
- **`parseFormUrlEncoded`** — Utility function for parse form url encoded.
- **`toSchemaCategory`** — Utility function for to schema category.

**Lines:** 439

---

<a name="supabase-functions-process-sms-parser-ts"></a>
### supabase/functions/process-sms/parser.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `TransactionParser` (Class)
- `ParsedTransaction` (Interface)

**Lines:** 472

---

<a name="supabase-functions-report-notification-dispatch-index-ts"></a>
### supabase/functions/report-notification-dispatch/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `getAllowedOrigins` (Function)
- `corsHeadersFor` (Function)
- `getLocalComponents` (Function)

**Function Details:**
- **`getAllowedOrigins`** — Utility function for get allowed origins.
- **`corsHeadersFor`** — Utility function for cors headers for.
- **`getLocalComponents`** — Utility function for get local components.

**Lines:** 215

---

<a name="supabase-functions-send-task-reminders-index-ts"></a>
### supabase/functions/send-task-reminders/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `getAllowedOrigins` (Function)
- `corsHeadersFor` (Function)
- `formatInTz` (Function)

**Function Details:**
- **`getAllowedOrigins`** — Utility function for get allowed origins.
- **`corsHeadersFor`** — Utility function for cors headers for.
- **`formatInTz`** — Utility function for format in tz.

**Lines:** 248

---

<a name="supabase-functions-send-test-notification-index-ts"></a>
### supabase/functions/send-test-notification/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `getAllowedOrigins` (Function)
- `corsHeadersFor` (Function)

**Function Details:**
- **`getAllowedOrigins`** — Utility function for get allowed origins.
- **`corsHeadersFor`** — Utility function for cors headers for.

**Lines:** 142

---

<a name="supabase-functions-sync-inbody-config-toml"></a>
### supabase/functions/sync-inbody/config.toml

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:** None (configuration file)

**Lines:** 2

---

<a name="supabase-functions-sync-inbody-index-ts"></a>
### supabase/functions/sync-inbody/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:** None (configuration or re-export module)

**Lines:** 70

---

<a name="supabase-functions-sync-reminders-index-ts"></a>
### supabase/functions/sync-reminders/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `normalizeReminderId` (Function)
- `normalizeName` (Function)
- `parseRemindersInput` (Function)
- `dedupeRemindersById` (Function)
- `jsonResponse` (Function)
- `isValidUuid` (Function)
- `parseIso` (Function)
- `normalizeDate` (Function)
- `normalizeTime` (Function)
- `mapPriority` (Function)
- `normalizeCompleted` (Function)
- `normalizePriority` (Function)
- `getBearerToken` (Function)
- `normalizeToken` (Function)

**Function Details:**
- **`normalizeReminderId`** — Utility function for normalize reminder id.
- **`normalizeName`** — Utility function for normalize name.
- **`parseRemindersInput`** — Utility function for parse reminders input.
- **`dedupeRemindersById`** — Utility function for dedupe reminders by id.
- **`jsonResponse`** — Utility function for json response.

**Lines:** 574

---

<a name="supabase-functions-tsconfig-json"></a>
### supabase/functions/tsconfig.json

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:** None (JSON data/config)

**Lines:** 17

---

<a name="supabase-functions-upload-screentime-chronos-index-ts"></a>
### supabase/functions/upload-screentime-chronos/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `parseTimeToSeconds` (Function)
- `parseDurationToSeconds` (Function)
- `parseDateToDateString` (Function)
- `parseTimestamp` (Function)
- `buildUploadedAt` (Function)
- `toRecord` (Function)
- `firstString` (Function)
- `firstNumber` (Function)
- `getItemDurationSeconds` (Function)
- `getItemSessionCount` (Function)
- `minIso` (Function)
- `maxIso` (Function)
- `extractDomain` (Function)
- `isWebsiteItem` (Function)
- `categorizeApp` (Function)

**Function Details:**
- **`parseTimeToSeconds`** — Utility function for parse time to seconds.
- **`parseDurationToSeconds`** — Utility function for parse duration to seconds.
- **`parseDateToDateString`** — Utility function for parse date to date string.
- **`parseTimestamp`** — Utility function for parse timestamp.
- **`buildUploadedAt`** — Utility function for build uploaded at.

**Lines:** 1408

---

<a name="supabase-functions-upload-screentime-index-ts"></a>
### supabase/functions/upload-screentime/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `parseTimeToSeconds` (Function)
- `parseDurationToSeconds` (Function)
- `parseDateToDateString` (Function)
- `parseTimestamp` (Function)
- `buildUploadedAt` (Function)
- `toRecord` (Function)
- `firstString` (Function)
- `firstNumber` (Function)
- `getItemDurationSeconds` (Function)
- `getItemSessionCount` (Function)
- `minIso` (Function)
- `maxIso` (Function)
- `extractDomain` (Function)
- `isWebsiteItem` (Function)
- `categorizeApp` (Function)

**Function Details:**
- **`parseTimeToSeconds`** — Utility function for parse time to seconds.
- **`parseDurationToSeconds`** — Utility function for parse duration to seconds.
- **`parseDateToDateString`** — Utility function for parse date to date string.
- **`parseTimestamp`** — Utility function for parse timestamp.
- **`buildUploadedAt`** — Utility function for build uploaded at.

**Lines:** 1454

---

<a name="supabase-functions-upload-sleep-index-ts"></a>
### supabase/functions/upload-sleep/index.ts

**File Purpose:** Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.

**Functions & Classes:**
- `normalizeStage` (Function)
- `parseIso` (Function)
- `parseDuration` (Function)
- `fixUnquotedStrings` (Function)
- `parseFileContent` (Function)

**Function Details:**
- **`normalizeStage`** — Utility function for normalize stage.
- **`parseIso`** — Utility function for parse iso.
- **`parseDuration`** — Utility function for parse duration.
- **`fixUnquotedStrings`** — Utility function for fix unquoted strings.
- **`parseFileContent`** — Utility function for parse file content.

**Lines:** 267

---

<a name="supabase-supabase-logs--1--json"></a>
### supabase/supabase_logs (1).json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 8502

---

<a name="tsconfig-app-json"></a>
### tsconfig.app.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 68

---

<a name="tsconfig-base-json"></a>
### tsconfig.base.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 26

---

<a name="tsconfig-json"></a>
### tsconfig.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 8

---

<a name="tsconfig-node-json"></a>
### tsconfig.node.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 27

---

<a name="vercel-json"></a>
### vercel.json

**File Purpose:** JSON configuration or data file. Used for settings, manifests, or structured data.

**Functions & Classes:** None (JSON data/config)

**Lines:** 8

---

<a name="vite-config-ts"></a>
### vite.config.ts

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `platformResolvePlugin` (Function)

**Function Details:**
- **`platformResolvePlugin`** — Utility function for platform resolve plugin.

**Lines:** 271

---

<a name="vitest-config-ts"></a>
### vitest.config.ts

**File Purpose:** Source file. Part of the lifeOS application codebase.

**Functions & Classes:**
- `platformResolvePlugin` (Function)

**Function Details:**
- **`platformResolvePlugin`** — Utility function for platform resolve plugin.

**Lines:** 54

---

