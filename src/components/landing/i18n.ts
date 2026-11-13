/**
 * English and Arabic copy for the public pages (landing, sign in, sign up),
 * plus the small store that remembers which one the visitor picked.
 *
 * Scope: these pages only. The app itself is not translated, which is why the
 * product UI shown inside the landing's frames stays in English and
 * left-to-right in both languages: it shows the app as it really is.
 */
import { create } from 'zustand';

export type Lang = 'en' | 'ar';

const STORAGE_KEY = 'lifeos.publicLang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar')) return 'ar';
  } catch {
    // storage unavailable: fall through to English
  }
  return 'en';
}

const en = {
  langName: 'English',
  switchTo: 'العربية',
  switchLabel: 'عرض الصفحة بالعربية',
  skip: 'Skip to content',
  nav: { day: 'Your day', life: 'Use cases', assistant: 'Assistant', integrations: 'Integrations', wiki: 'Wiki', signIn: 'Sign in', start: 'Get started', sections: 'Sections', home: 'lifeOS home', clock: "Today's Hijri date and your local time" },
  hero: {
    stay: 'Stay',
    words: ['organised', 'focused', 'consistent', 'in control'],
    line2: 'every single day.',
    lead: 'Your personal operating system. Prayers, tasks, habits, money and sleep in one dashboard, with an assistant that acts on them when you say so.',
    cta: 'Create free account',
    google: 'Continue with Google',
    facts: 'Free to use. 12 modules. Source on GitHub.',
  },
  trustLabel: 'Why you can trust lifeOS with your data',
  trust: [
    { title: 'Yours alone', body: 'Every record is scoped to your account with row-level security. No tracking without your consent.' },
    { title: 'Works offline', body: 'Keep logging without a connection. It syncs when you are back online.' },
    { title: 'Privacy mode', body: 'Blur your money and screen-time numbers when someone is looking over your shoulder.' },
    { title: 'Open code', body: 'The source is public on GitHub. Read it, or host it on your own Supabase.' },
  ],
  day: {
    title: 'From Fajr to sleep, one dashboard',
    show: 'Show',
    chapters: [
      { time: 'Fajr', module: 'Prayers', title: 'Start with what matters', body: 'Log each prayer as on time, late or missed. A missed prayer goes straight into your qadaa plan.' },
      { time: 'Duha', module: 'Tasks', title: 'Plan the day', body: 'Smart task management with priorities, due dates, subtasks, and recurrence.' },
      { time: 'Dhuhr', module: 'Focus', title: 'Protect deep work', body: 'Pomodoro timer to protect deep work time and track productive sessions.' },
      { time: 'Asr', module: 'Finance', title: 'Know where money goes', body: 'Bank SMS messages become categorised transactions on their own, against the budget you set.' },
      { time: 'Maghrib', module: 'Quran & Azkar', title: 'Keep your wird', body: "Evening azkar with a counter, and a khatmah plan that tells you which pages are today's." },
      { time: 'Isha', module: 'Sleep', title: 'Close the day rested', body: 'Log sleep sessions and review quality trends to protect your recovery.' },
    ],
  },
  life: {
    title: 'Life with lifeOS',
    body: 'Built around a Muslim’s day, and useful for anyone who wants their plans and their evidence in the same place.',
    cases: [
      { title: 'A two-minute morning check', body: 'Open the dashboard and see today’s prayers, tasks, habits and how you slept, on one screen.' },
      { title: 'A qadaa plan with an end date', body: 'Say how many make-up prayers you can manage a day. lifeOS shows when you will finish, and whether you are ahead or behind.' },
      { title: 'Spending that logs itself', body: 'Forward your bank SMS messages and each one lands as a categorised transaction.' },
      { title: 'A khatmah you can keep', body: 'Plan a full reading of the Quran and get today’s pages. All 604 pages are available offline.' },
      { title: 'A weekly review with evidence', body: 'See how your sleep, screen time, habits and spending moved together over the week.' },
      { title: 'Still works on a flight', body: 'Log tasks, habits and azkar with no connection. Everything syncs when you land.' },
    ],
  },
  assistant: {
    title: 'An assistant that does the work',
    body: 'lifeOS is an agentic organiser: it can plan with you and then make the changes itself, once you approve them.',
    points: [
      'Ask in English or Arabic, by typing or by voice.',
      'It reads your tasks, habits, sleep and spending before it answers.',
      'It proposes changes as cards. Nothing runs until you press Execute.',
      'It runs on your own AI keys. Switch it off and every AI entry point disappears.',
    ],
    name: 'lifeOS Assistant',
    demo: 'demo',
    execute: 'Execute',
    done: 'Done',
    scripts: [
      {
        prompt: 'Plan my evening around Maghrib',
        reply: 'Maghrib is at 5:03 PM. You have two tasks left and evening azkar is not done. Here is a plan that keeps the prayer first.',
        actions: [
          { verb: 'Create task', detail: 'Evening azkar · 5:20 PM' },
          { verb: 'Move task', detail: 'Draft project outline · 6:45 PM' },
          { verb: 'Start focus', detail: '25 minutes after Isha' },
        ],
      },
      {
        prompt: 'Where did my money go this week?',
        reply: 'Groceries took the largest share this week, and eating out is over the budget you set. Want me to tighten it?',
        actions: [
          { verb: 'Set budget', detail: 'Eating out · weekly cap' },
          { verb: 'Add rule', detail: 'CARREFOUR is Groceries' },
        ],
      },
      {
        prompt: 'I missed Fajr twice this week',
        reply: 'Both are in your qadaa backlog now. You went to sleep after 1 AM on both nights, so an earlier wind-down is the likely fix.',
        actions: [
          { verb: 'Create task', detail: 'Qadaa Fajr · before Dhuhr' },
          { verb: 'Add habit', detail: 'In bed by 11:00 PM' },
        ],
      },
    ],
  },
  integrations: {
    title: 'Everything in one place',
    body: 'Your bank, your calendars, your phone and your browser feed lifeOS on their own, so the dashboard is already up to date when you open it.',
    feedTitle: 'What arrived today, before you opened the app',
    pause: 'Pause the feed',
    play: 'Play the feed',
    sourcesTitle: 'Nine sources feed it',
    modulesTitle: 'All of it lands in 12 modules that share one database',
    sources: [
      { title: 'Bank SMS', body: 'Forwarded bank messages become categorised transactions.' },
      { title: 'Calendar feeds', body: 'Subscribe to iCal calendars, and publish your tasks as a feed.' },
      { title: 'iOS Shortcuts', body: 'Log a cash expense from a Shortcut or a Back Tap.' },
      { title: 'Browser extension', body: 'Time per website, a web clipper, and one-tap habits. Chrome, Brave, Edge, Firefox.' },
      { title: 'Screen time', body: 'App and website usage from iOS, Windows and Linux.' },
      { title: 'Sleep data', body: 'Import sleep sessions with their stages, or log a night by hand.' },
      { title: 'InBody scans', body: 'Body composition results synced into Health.' },
      { title: 'Prayer times', body: 'Calculated for your location, with a reminder before each prayer.' },
      { title: 'AI providers', body: 'Bring your own keys; the assistant falls back across providers.' },
    ],
    events: [
      { text: 'EGP 500 at CARREFOUR, filed as Groceries', to: 'Finance' },
      { text: 'Team sync added from the work calendar', to: 'Calendar' },
      { text: 'Cash expense: EGP 35, coffee', to: 'Finance' },
      { text: '42 minutes on docs.github.com', to: 'Screen Time' },
      { text: 'Phone: 1h 10m so far today', to: 'Screen Time' },
      { text: 'Last night: 7h 12m, 1h 40m deep', to: 'Sleep' },
      { text: 'New scan: body fat down 0.8%', to: 'Bio-Metrics' },
      { text: 'Asr in 15 minutes', to: 'Habits' },
      { text: 'Brain dump organised into 3 tasks', to: 'Tasks' },
    ],
    modules: ['Tasks', 'Focus', 'Habits', 'Calendar', 'Planner', 'Notes', 'Finance', 'Sleep', 'Bio-Metrics', 'Points & Rewards', 'Screen Time', 'Analytics'],
  },
  sandbox: {
    title: 'Try it yourself',
    body: 'Click tasks and habits in this interactive mockup to see how lifeOS gamifies your day-to-day execution.',
    today: 'Today',
    tasks: 'Inbox Tasks',
    habits: 'Daily Habits',
    active: 'active',
    tracked: 'tracked',
    done: 'Done',
    days: 'days',
    taskItems: ['Ship v1.0 of lifeOS', 'Log daily sleep analysis', 'Complete 10m focus sprint'],
    habitItems: ['Morning azkar', 'Read 5 pages of Quran', '8h sleep'],
  },
  wiki: {
    title: 'Explore the lifeOS Wiki',
    body: 'Our public knowledge graph. Drag nodes to move them around, and click a node to read its specification.',
    link: 'Browse the full documentation',
  },
  close: {
    line1: 'Your personal',
    line2: 'operating system.',
    extension: 'Download the browser extension',
    desktop: 'Get the desktop app',
    source: 'Read the source on GitHub',
  },
  footer: {
    tagline: 'One dashboard for your prayers, tasks, habits, money and sleep.',
    product: 'Product',
    get: 'Get lifeOS',
    web: 'Web app',
    extension: 'Browser extension',
    desktop: 'Desktop app',
    source: 'Source code',
    more: 'More',
    docs: 'Docs & Wiki',
    platforms: 'Web, iOS, Android, desktop and browser extension',
    language: 'Language',
  },
  auth: {
    home: 'lifeOS home',
    email: 'Email',
    password: 'Password',
    show: 'Show password',
    hide: 'Hide password',
    or: 'or',
    google: 'Continue with Google',
    offline: 'Use offline, no account',
    panelLabel: 'Your personal operating system',
    panelHead: 'Prayers, tasks, habits, money and sleep.',
    panelTail: 'One dashboard.',
    facts: ['Every record is scoped to your account.', 'Keeps working offline and syncs when you are back.', 'Free to use, with the source public on GitHub.'],
    login: {
      title: 'Welcome back',
      lead: 'Sign in to pick up your day where you left it.',
      submit: 'Sign in',
      busy: 'Signing in...',
      demo: 'Try the demo account',
      demoBusy: 'Opening the demo...',
      offlineTitle: 'You are offline',
      offlineBody: 'lifeOS works offline. Open your cached tasks, habits, prayers and notes now and sign in later.',
      offlineCta: 'Continue offline',
      failed: 'Sign in failed',
      googleFailed: 'Google sign in failed',
      verifyHint: 'Just signed up? Open the verification link in your email first, then sign in.',
      switchPrompt: 'New to lifeOS?',
      switchLink: 'Create a free account',
    },
    signup: {
      title: 'Create your account',
      lead: 'Free to use. You will confirm your email before your first sign in.',
      submit: 'Create account',
      busy: 'Creating account...',
      ruleLength: 'At least 6 characters',
      tooShort: 'Password must be at least 6 characters',
      failed: 'Sign up failed',
      switchPrompt: 'Already have an account?',
      switchLink: 'Sign in',
      sentTitle: 'Check your email',
      sentLead: 'We sent a confirmation link to',
      steps: ['Open the email from lifeOS (check spam too).', 'Click the confirmation link in it.', 'Come back and sign in with your email and password.'],
      sentNote: 'You cannot sign in until your email is confirmed.',
      sentCta: 'Go to sign in',
    },
  },
};

export type Copy = typeof en;

const ar: Copy = {
  langName: 'العربية',
  switchTo: 'English',
  switchLabel: 'View this page in English',
  skip: 'انتقل إلى المحتوى',
  nav: { day: 'يومك', life: 'حالات الاستخدام', assistant: 'المساعد', integrations: 'التكاملات', wiki: 'الويكي', signIn: 'تسجيل الدخول', start: 'ابدأ الآن', sections: 'الأقسام', home: 'الصفحة الرئيسية لـ lifeOS', clock: 'التاريخ الهجري اليوم والوقت المحلي' },
  hero: {
    stay: 'كن',
    words: ['منظَّمًا', 'مركِّزًا', 'مواظبًا', 'متحكِّمًا'],
    line2: 'كل يوم بلا استثناء.',
    lead: 'نظام تشغيلك الشخصي. صلواتك ومهامك وعاداتك ومالك ونومك في لوحة واحدة، مع مساعد ينفّذ عنك حين تأذن له.',
    cta: 'أنشئ حسابًا مجانيًا',
    google: 'المتابعة بحساب Google',
    facts: 'مجاني. ١٢ وحدة. الكود متاح على GitHub.',
  },
  trustLabel: 'لماذا تأتمن lifeOS على بياناتك',
  trust: [
    { title: 'بياناتك لك وحدك', body: 'كل سجل مرتبط بحسابك فقط عبر أمان على مستوى الصف. ولا تتبّع دون موافقتك.' },
    { title: 'يعمل بلا إنترنت', body: 'واصل التسجيل دون اتصال، وتتم المزامنة عند عودتك.' },
    { title: 'وضع الخصوصية', body: 'اطمس أرقام مالك ووقت الشاشة حين ينظر أحد إلى شاشتك.' },
    { title: 'كود مفتوح', body: 'الكود المصدري منشور على GitHub. اقرأه أو شغّله على Supabase خاص بك.' },
  ],
  day: {
    title: 'من الفجر إلى النوم، لوحة واحدة',
    show: 'اعرض',
    chapters: [
      { time: 'الفجر', module: 'الصلوات', title: 'ابدأ بالأهم', body: 'سجّل كل صلاة: في وقتها أو متأخرة أو فائتة. والفائتة تدخل مباشرة في خطة القضاء.' },
      { time: 'الضحى', module: 'المهام', title: 'خطّط ليومك', body: 'إدارة ذكية للمهام بالأولويات والمواعيد والمهام الفرعية والتكرار.' },
      { time: 'الظهر', module: 'التركيز', title: 'احمِ وقت العمل العميق', body: 'مؤقت بومودورو يحمي وقت تركيزك ويسجّل جلساتك المنتجة.' },
      { time: 'العصر', module: 'المال', title: 'اعرف أين يذهب مالك', body: 'رسائل البنك تتحول تلقائيًا إلى معاملات مصنّفة، مقابل الميزانية التي حددتها.' },
      { time: 'المغرب', module: 'القرآن والأذكار', title: 'حافظ على وردك', body: 'أذكار المساء بعدّاد، وخطة ختمة تخبرك بصفحات اليوم.' },
      { time: 'العشاء', module: 'النوم', title: 'اختم يومك مرتاحًا', body: 'سجّل نومك وراجع جودته عبر الأيام لتحافظ على تعافيك.' },
    ],
  },
  life: {
    title: 'الحياة مع lifeOS',
    body: 'مبني حول يوم المسلم، ومفيد لكل من يريد خططه وما أنجزه فعلًا في مكان واحد.',
    cases: [
      { title: 'مراجعة الصباح في دقيقتين', body: 'افتح اللوحة لترى صلوات اليوم ومهامه وعاداته وكيف كان نومك، في شاشة واحدة.' },
      { title: 'خطة قضاء لها موعد انتهاء', body: 'حدّد كم صلاة قضاء تستطيع يوميًا، فيُريك lifeOS متى تنتهي، وهل أنت متقدم أم متأخر.' },
      { title: 'مصروفات تُسجَّل وحدها', body: 'حوّل رسائل البنك النصية، وكل رسالة تصير معاملة مصنّفة.' },
      { title: 'ختمة تستطيع المواظبة عليها', body: 'خطّط لختم القرآن واحصل على صفحات اليوم. الصفحات الـ٦٠٤ كلها متاحة دون إنترنت.' },
      { title: 'مراجعة أسبوعية مبنية على الأرقام', body: 'انظر كيف تحرّك نومك ووقت الشاشة وعاداتك وإنفاقك معًا خلال الأسبوع.' },
      { title: 'يعمل حتى في الطائرة', body: 'سجّل مهامك وعاداتك وأذكارك بلا اتصال. كل شيء يتزامن عند الهبوط.' },
    ],
  },
  assistant: {
    title: 'مساعد ينجز العمل',
    body: 'lifeOS منظِّم حياة وكيل: يخطّط معك ثم ينفّذ التغييرات بنفسه بعد أن توافق عليها.',
    points: [
      'اسأل بالعربية أو الإنجليزية، كتابةً أو بصوتك.',
      'يقرأ مهامك وعاداتك ونومك وإنفاقك قبل أن يجيب.',
      'يقترح التغييرات في بطاقات، ولا يُنفَّذ شيء حتى تضغط «نفِّذ».',
      'يعمل بمفاتيح الذكاء الاصطناعي الخاصة بك. أوقفه فتختفي كل مداخله.',
    ],
    name: 'مساعد lifeOS',
    demo: 'عرض تجريبي',
    execute: 'نفِّذ',
    done: 'تم',
    scripts: [
      {
        prompt: 'رتّب لي مسائي حول المغرب',
        reply: 'المغرب الساعة ٥:٠٣ م. بقيت لك مهمتان، وأذكار المساء لم تُقرأ بعد. هذه خطة تجعل الصلاة أولًا.',
        actions: [
          { verb: 'إنشاء مهمة', detail: 'أذكار المساء · ٥:٢٠ م' },
          { verb: 'نقل مهمة', detail: 'مسودة مخطط المشروع · ٦:٤٥ م' },
          { verb: 'بدء تركيز', detail: '٢٥ دقيقة بعد العشاء' },
        ],
      },
      {
        prompt: 'أين ذهب مالي هذا الأسبوع؟',
        reply: 'البقالة أخذت النصيب الأكبر هذا الأسبوع، والأكل خارج البيت تجاوز الميزانية التي حددتها. هل أضبطها لك؟',
        actions: [
          { verb: 'تحديد ميزانية', detail: 'الأكل خارج البيت · حد أسبوعي' },
          { verb: 'إضافة قاعدة', detail: 'CARREFOUR = بقالة' },
        ],
      },
      {
        prompt: 'فاتني الفجر مرتين هذا الأسبوع',
        reply: 'أُضيفتا إلى قائمة القضاء. نمت بعد الواحدة صباحًا في الليلتين، فالأرجح أن الحل هو النوم أبكر.',
        actions: [
          { verb: 'إنشاء مهمة', detail: 'قضاء الفجر · قبل الظهر' },
          { verb: 'إضافة عادة', detail: 'في السرير قبل ١١:٠٠ م' },
        ],
      },
    ],
  },
  integrations: {
    title: 'كل شيء في مكان واحد',
    body: 'بنكك وتقاويمك وهاتفك ومتصفحك تغذّي lifeOS تلقائيًا، فتجد اللوحة محدَّثة حين تفتحها.',
    feedTitle: 'ما وصل اليوم قبل أن تفتح التطبيق',
    pause: 'أوقف التحديثات',
    play: 'شغّل التحديثات',
    sourcesTitle: 'تسعة مصادر تغذّيه',
    modulesTitle: 'وكلها تصبّ في ١٢ وحدة تتشارك قاعدة بيانات واحدة',
    sources: [
      { title: 'رسائل البنك', body: 'رسائل البنك المحوَّلة تصير معاملات مصنّفة.' },
      { title: 'التقاويم', body: 'اشترك في تقاويم iCal، وانشر مهامك كتقويم.' },
      { title: 'اختصارات iOS', body: 'سجّل مصروفًا نقديًا من اختصار أو بنقرة على ظهر الهاتف.' },
      { title: 'إضافة المتصفح', body: 'وقت كل موقع، وقصّ الصفحات، وتسجيل العادات بنقرة. Chrome وBrave وEdge وFirefox.' },
      { title: 'وقت الشاشة', body: 'استخدام التطبيقات والمواقع من iOS وWindows وLinux.' },
      { title: 'بيانات النوم', body: 'استورد جلسات النوم بمراحلها، أو سجّل ليلتك يدويًا.' },
      { title: 'قياسات InBody', body: 'نتائج تكوين الجسم تتزامن مع قسم الصحة.' },
      { title: 'مواقيت الصلاة', body: 'تُحسب حسب موقعك، مع تذكير قبل كل صلاة.' },
      { title: 'مزوّدو الذكاء الاصطناعي', body: 'استخدم مفاتيحك؛ والمساعد ينتقل بين المزوّدين عند التعطل.' },
    ],
    events: [
      { text: '٥٠٠ ج.م في CARREFOUR، صُنّفت «بقالة»', to: 'المال' },
      { text: 'أُضيف اجتماع الفريق من تقويم العمل', to: 'التقويم' },
      { text: 'مصروف نقدي: ٣٥ ج.م، قهوة', to: 'المال' },
      { text: '٤٢ دقيقة على docs.github.com', to: 'وقت الشاشة' },
      { text: 'الهاتف: ساعة و١٠ دقائق حتى الآن', to: 'وقت الشاشة' },
      { text: 'الليلة الماضية: ٧ س ١٢ د، منها ١ س ٤٠ د نوم عميق', to: 'النوم' },
      { text: 'قياس جديد: الدهون انخفضت ٠٫٨٪', to: 'القياسات الحيوية' },
      { text: 'العصر بعد ١٥ دقيقة', to: 'العادات' },
      { text: 'نُظّمت الخواطر في ٣ مهام', to: 'المهام' },
    ],
    modules: ['المهام', 'التركيز', 'العادات', 'التقويم', 'المخطِّط', 'الملاحظات', 'المال', 'النوم', 'القياسات الحيوية', 'النقاط والمكافآت', 'وقت الشاشة', 'التحليلات'],
  },
  sandbox: {
    title: 'جرّبه بنفسك',
    body: 'اضغط على المهام والعادات في هذا النموذج التفاعلي لترى كيف يحوّل lifeOS إنجازك اليومي إلى لعبة.',
    today: 'اليوم',
    tasks: 'مهام الوارد',
    habits: 'العادات اليومية',
    active: 'نشطة',
    tracked: 'مسجَّلة',
    done: 'تم',
    days: 'يومًا',
    taskItems: ['إطلاق النسخة ١٫٠ من lifeOS', 'تسجيل تحليل النوم اليومي', 'إتمام جلسة تركيز ١٠ دقائق'],
    habitItems: ['أذكار الصباح', 'قراءة ٥ صفحات من القرآن', 'نوم ٨ ساعات'],
  },
  wiki: {
    title: 'استكشف ويكي lifeOS',
    body: 'خريطة معرفتنا العامة. اسحب العُقد لتحريكها، واضغط على عقدة لتقرأ مواصفاتها.',
    link: 'تصفّح التوثيق الكامل',
  },
  close: {
    line1: 'نظام تشغيلك',
    line2: 'الشخصي.',
    extension: 'نزّل إضافة المتصفح',
    desktop: 'نزّل تطبيق سطح المكتب',
    source: 'اقرأ الكود على GitHub',
  },
  footer: {
    tagline: 'لوحة واحدة لصلواتك ومهامك وعاداتك ومالك ونومك.',
    product: 'المنتج',
    get: 'احصل على lifeOS',
    web: 'تطبيق الويب',
    extension: 'إضافة المتصفح',
    desktop: 'تطبيق سطح المكتب',
    source: 'الكود المصدري',
    more: 'المزيد',
    docs: 'التوثيق والويكي',
    platforms: 'الويب وiOS وAndroid وسطح المكتب وإضافة المتصفح',
    language: 'اللغة',
  },
  auth: {
    home: 'الصفحة الرئيسية لـ lifeOS',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    show: 'إظهار كلمة المرور',
    hide: 'إخفاء كلمة المرور',
    or: 'أو',
    google: 'المتابعة بحساب Google',
    offline: 'استخدمه بلا إنترنت وبلا حساب',
    panelLabel: 'نظام تشغيلك الشخصي',
    panelHead: 'صلواتك ومهامك وعاداتك ومالك ونومك.',
    panelTail: 'لوحة واحدة.',
    facts: ['كل سجل مرتبط بحسابك فقط.', 'يعمل بلا إنترنت ويتزامن عند عودتك.', 'مجاني، والكود منشور على GitHub.'],
    login: {
      title: 'مرحبًا بعودتك',
      lead: 'سجّل الدخول لتكمل يومك من حيث توقفت.',
      submit: 'تسجيل الدخول',
      busy: 'جارٍ تسجيل الدخول...',
      demo: 'جرّب الحساب التجريبي',
      demoBusy: 'جارٍ فتح الحساب التجريبي...',
      offlineTitle: 'أنت غير متصل',
      offlineBody: 'lifeOS يعمل بلا إنترنت. افتح مهامك وعاداتك وصلواتك وملاحظاتك المحفوظة الآن، وسجّل الدخول لاحقًا.',
      offlineCta: 'المتابعة بلا اتصال',
      failed: 'تعذّر تسجيل الدخول',
      googleFailed: 'تعذّر الدخول بحساب Google',
      verifyHint: 'سجّلت للتو؟ افتح رابط التأكيد في بريدك أولًا ثم سجّل الدخول.',
      switchPrompt: 'جديد على lifeOS؟',
      switchLink: 'أنشئ حسابًا مجانيًا',
    },
    signup: {
      title: 'أنشئ حسابك',
      lead: 'مجاني. ستؤكد بريدك الإلكتروني قبل أول تسجيل دخول.',
      submit: 'إنشاء الحساب',
      busy: 'جارٍ إنشاء الحساب...',
      ruleLength: '٦ أحرف على الأقل',
      tooShort: 'كلمة المرور يجب ألا تقل عن ٦ أحرف',
      failed: 'تعذّر إنشاء الحساب',
      switchPrompt: 'لديك حساب بالفعل؟',
      switchLink: 'تسجيل الدخول',
      sentTitle: 'تحقّق من بريدك',
      sentLead: 'أرسلنا رابط التأكيد إلى',
      steps: ['افتح الرسالة الواردة من lifeOS (وتحقّق من الرسائل غير المرغوبة).', 'اضغط على رابط التأكيد فيها.', 'عُد وسجّل الدخول ببريدك وكلمة المرور.'],
      sentNote: 'لن تستطيع تسجيل الدخول قبل تأكيد بريدك.',
      sentCta: 'الذهاب لتسجيل الدخول',
    },
  },
};

const COPY: Record<Lang, Copy> = { en, ar };

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const useLangStore = create<LangState>((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // not persisted; the choice still applies for this visit
    }
    set({ lang });
  },
}));

/** The visitor's language for the public pages: copy, direction, and formatters. */
export function usePublicLang() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const rtl = lang === 'ar';
  return {
    lang,
    rtl,
    dir: (rtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    t: COPY[lang],
    toggle: () => setLang(rtl ? 'en' : 'ar'),
  };
}

/** 12-hour clock time and today's Hijri date, in the visitor's language. */
export function formatClock(now: Date, lang: Lang) {
  const time = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
  let hijri = '';
  try {
    hijri = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  } catch {
    hijri = '';
  }
  return { time, hijri };
}
