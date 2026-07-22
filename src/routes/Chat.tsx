import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Marked } from 'marked';
import {
  Sparkles,
  Send,
  Brain,
  Check,
  Loader2,
  Calendar,
  CheckSquare,
  Wallet,
  Activity,
  FileText,
  Moon,
  Info,
  Settings,
  AlertCircle,
  Trash2,
  User,
  Plus,
  PanelLeft,
  Copy,
  RotateCw,
  X,
  MessageSquare,
  Mic,
  MicOff,
} from 'lucide-react';
import { Button } from '../components/ui';
import { cn } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import { askAI } from '../lib/ai';

// Database queries
import { useTasks, useCreateTask } from '../hooks/useTasks';
import { useHabits } from '../hooks/useHabits';
import { useNotes, useCreateNote } from '../hooks/useNotes';
import { useTransactions, useCreateTransaction } from '../hooks/useFinance';
import { useCalendarEvents, useCreateCalendarEvent } from '../hooks/useCalendar';
import { useSleepMetrics, useSleepStages } from '../hooks/useSleep';
import { useInBodyScans } from '../hooks/useHealthData';
import { useTodayScreentime, useScreentimeAppStats } from '../hooks/useScreentime';
import { format, subDays } from 'date-fns';

interface ChatAction {
  type: 'create_task' | 'create_event' | 'create_note' | 'create_transaction';
  status: 'idle' | 'executing' | 'completed' | 'failed';
  payload: any;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actions?: ChatAction[];
}

interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'lifeos_chat_threads';

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Hello! I am your **lifeOS AI Assistant**.

I can help you review your habits, plan your day, analyze your sleep/screentime, and audit your budget. 

Ask me to **create tasks, schedule events, write notes, or log expenses** for you, and I will generate clickable action cards directly inside our conversation!`,
  timestamp: new Date().toISOString(),
};

export default function Chat() {
  const { aiEnabled, aiApiKey, aiModel } = useUIStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Queries for default context
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const { data: notes = [] } = useNotes();
  const { data: transactions = [] } = useTransactions();
  const { data: events = [] } = useCalendarEvents();
  const sleepMetrics = useSleepMetrics(7);
  const { data: healthScans = [] } = useInBodyScans();
  const todayScreentime = useTodayScreentime();

  // Extended 90-day queries (for deep heuristic mode)
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const ninetyDaysAgoStr = useMemo(() => format(subDays(new Date(), 90), 'yyyy-MM-dd'), []);
  const { data: longSleepStages = [] } = useSleepStages(ninetyDaysAgoStr + 'T00:00:00.000Z', todayStr + 'T23:59:59.999Z');
  const { data: longScreentimeApps = [] } = useScreentimeAppStats(ninetyDaysAgoStr, todayStr);

  // Mutations
  const createTask = useCreateTask();
  const createEvent = useCreateCalendarEvent();
  const createNote = useCreateNote();
  const createTransaction = useCreateTransaction();

  // Persistent Threads State
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }

    // Default 4 initial threads so user has at least 4 threads history
    const nowIso = new Date().toISOString();
    return [
      {
        id: `thread-${Date.now()}-1`,
        title: 'New Conversation',
        createdAt: nowIso,
        updatedAt: nowIso,
        messages: [DEFAULT_WELCOME_MSG],
      },
      {
        id: `thread-${Date.now()}-2`,
        title: 'Daily Planning',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: 'Help me plan my priorities for the week.',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: 'm2',
            role: 'assistant',
            content: 'Focus on high priority tasks first, and reserve 2 hours for deep work each morning.',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
          },
        ],
      },
      {
        id: `thread-${Date.now()}-3`,
        title: 'Health & Habit Audit',
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        messages: [
          {
            id: 'm3',
            role: 'user',
            content: 'How has my sleep and habit consistency been lately?',
            timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
          },
          {
            id: 'm4',
            role: 'assistant',
            content: 'Your habit adherence is consistent at 82%, and your average sleep duration is 7.2 hours.',
            timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
          },
        ],
      },
      {
        id: `thread-${Date.now()}-4`,
        title: 'Financial Review',
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        messages: [
          {
            id: 'm5',
            role: 'user',
            content: 'Summarize my recent expenses.',
            timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
          },
          {
            id: 'm6',
            role: 'assistant',
            content: 'Your largest expenses this week were food & dining and monthly utilities.',
            timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
          },
        ],
      },
    ];
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(() => threads[0]?.id || 'default');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleVoiceDictation = (onTranscript: (text: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice dictation is not supported on this browser/device.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-EG';
      recognition.continuous = false;
      recognition.interimResults = false;
      setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          onTranscript(transcript);
        }
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const [activeSources, setActiveSources] = useState({
    tasks: true,
    calendar: true,
    habits: true,
    notes: true,
    finance: true,
    health: true,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const promptConsumedRef = useRef(false);

  const parser = useMemo(() => new Marked(), []);

  // Sync threads to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    } catch {
      // ignore
    }
  }, [threads]);

  // Active thread helper
  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === activeThreadId) || threads[0];
  }, [threads, activeThreadId]);

  const activeMessages = activeThread?.messages || [];
  const isThreadEmpty = activeMessages.length <= 1 && activeMessages[0]?.id.startsWith('welcome');

  // Scroll to bottom on message changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, isGenerating]);

  // iOS keyboard: use visualViewport to keep footer above the keyboard
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      if (footerRef.current) {
        footerRef.current.style.bottom = offset > 0 ? `${offset}px` : '';
      }
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // Create new chat thread
  const handleNewChat = () => {
    const newThreadId = `thread-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newThread: ChatThread = {
      id: newThreadId,
      title: 'New Conversation',
      createdAt: nowIso,
      updatedAt: nowIso,
      messages: [DEFAULT_WELCOME_MSG],
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThreadId);
    setSidebarOpen(false);
  };

  // Delete chat thread
  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (threads.length <= 1) return; // Keep at least one thread
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (activeThreadId === threadId) {
      const remaining = threads.filter((t) => t.id !== threadId);
      if (remaining[0]) setActiveThreadId(remaining[0].id);
    }
  };

  // Adaptive context compiler: switches from default to 90-day deep heuristic context if prompt demands it
  const compileKnowledgeContext = (query: string): string => {
    let context = '';
    const now = new Date();
    
    // Check if query explicitly asks for multi-month or extended history
    const isDeepHeuristicRequest = /(3\s*months?|90\s*days?|quarter|historical|all\s*history|deep\s*trend|deep\s*audit|شهران|ثلاثة\s*أشهر|٩٠\s*يوم)/i.test(query);

    context += `Current local time: ${now.toString()}\n`;
    context += `Today's Date: ${now.toISOString().slice(0, 10)}\n`;
    context += `Context Mode: ${isDeepHeuristicRequest ? 'EXPANDED 90-DAY HEURISTIC ANALYSIS' : 'STANDARD DEFAULT SUMMARY'}\n\n`;

    // 1. Tasks
    if (activeSources.tasks) {
      if (isDeepHeuristicRequest) {
        context += `### TASKS ARCHIVE (ALL RECENT TASKS & COMPLETED - UP TO 90 DAYS)\n`;
        tasks.slice(0, 80).forEach((t) => {
          context += `- [${t.is_completed ? 'COMPLETED' : 'ACTIVE'}] [Priority: ${t.priority || 'none'}] ${t.title}${t.due_date ? ` (Due: ${t.due_date})` : ''}\n`;
        });
      } else {
        const activeTasks = tasks.filter((t) => !t.is_completed);
        context += `### ACTIVE TASKS (${activeTasks.length})\n`;
        if (activeTasks.length === 0) {
          context += `No active tasks.\n`;
        } else {
          activeTasks.slice(0, 20).forEach((t) => {
            context += `- [${t.priority || 'no priority'}] ${t.title}${t.due_date ? ` (Due: ${t.due_date})` : ''}\n`;
          });
        }
      }
      context += `\n`;
    }

    // 2. Calendar Events
    if (activeSources.calendar) {
      const daysAhead = isDeepHeuristicRequest ? 90 : 7;
      context += `### CALENDAR EVENTS (NEXT ${daysAhead} DAYS)\n`;
      const nextBound = now.getTime() + daysAhead * 24 * 60 * 60 * 1000;
      const filteredEvents = events.filter((e) => {
        const evStart = new Date(e.start_time).getTime();
        return evStart >= now.getTime() && evStart <= nextBound;
      });

      if (filteredEvents.length === 0) {
        context += `No upcoming events scheduled.\n`;
      } else {
        filteredEvents.slice(0, isDeepHeuristicRequest ? 50 : 15).forEach((e) => {
          context += `- ${e.title} (${new Date(e.start_time).toLocaleString()} to ${new Date(e.end_time).toLocaleString()})\n`;
        });
      }
      context += `\n`;
    }

    // 3. Habits
    if (activeSources.habits) {
      context += `### HABITS STATUS\n`;
      const activeHabits = habits.filter((h) => !h.is_archived);
      if (activeHabits.length === 0) {
        context += `No active habits.\n`;
      } else {
        activeHabits.forEach((h) => {
          context += `- ${h.title} (Type: ${h.habit_type || 'standard'}, Freq: ${h.frequency}, Target: ${h.target_count}x)\n`;
        });
      }
      context += `\n`;
    }

    // 4. Notes
    if (activeSources.notes) {
      const noteCount = isDeepHeuristicRequest ? 25 : 5;
      context += `### RECENT NOTES (TOP ${noteCount})\n`;
      if (notes.length === 0) {
        context += `No notes available.\n`;
      } else {
        notes.slice(0, noteCount).forEach((n) => {
          context += `- Title: "${n.title || 'Untitled Note'}" (Date: ${n.note_date})\n  Content: ${n.body ? n.body.slice(0, 300) + '...' : 'Empty'}\n`;
        });
      }
      context += `\n`;
    }

    // 5. Finance
    if (activeSources.finance) {
      const txLimit = isDeepHeuristicRequest ? 100 : 10;
      const recentTx = transactions.slice(0, txLimit);
      const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
      const totalIncome = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);

      context += `### FINANCIAL LEDGER SUMMARY (${isDeepHeuristicRequest ? '90-DAY EXTENDED HISTORY' : 'RECENT'})\n`;
      context += `- Total logged income: $${totalIncome.toFixed(2)}\n`;
      context += `- Total logged expenses: $${totalExpense.toFixed(2)}\n`;
      context += `- Transactions list:\n`;
      
      if (recentTx.length === 0) {
        context += `  No transactions logged.\n`;
      } else {
        recentTx.forEach((t) => {
          context += `  * ${t.type.toUpperCase()}: $${Number(t.amount).toFixed(2)} - ${t.description || 'No description'} (Cat: ${t.category}, Date: ${t.date})\n`;
        });
      }
      context += `\n`;
    }

    // 6. Health, Sleep & Screentime
    if (activeSources.health) {
      context += `### DIGITAL WELLBEING & HEALTH DATA\n`;
      if (sleepMetrics) {
        context += `- Sleep Metrics (7-day): Avg ${(sleepMetrics.avgSleepMinutes / 60).toFixed(1)} hours/night across ${sleepMetrics.nightsCount} nights.\n`;
      }
      if (isDeepHeuristicRequest && longSleepStages.length > 0) {
        context += `- Extended Sleep Stage Logs: ${longSleepStages.length} recorded sleep stages in the last 90 days.\n`;
      }
      if (todayScreentime) {
        context += `- Screentime (Today): ${todayScreentime.totalMinutes} minutes active.\n`;
      }
      if (isDeepHeuristicRequest && longScreentimeApps.length > 0) {
        const totalSec = longScreentimeApps.reduce((s, a) => s + (a.total_time_seconds || 0), 0);
        context += `- 90-Day Screentime Aggregate: ${(totalSec / 3600).toFixed(1)} total active hours across apps.\n`;
      }
      const latestScan = healthScans[0];
      if (latestScan) {
        context += `- Bio-metrics Scan (${latestScan.date}): Weight ${latestScan.weight}kg, Muscle ${latestScan.skeletal_muscle_mass}kg, Body Fat ${latestScan.body_fat_percent}%\n`;
      }
      context += `\n`;
    }

    return context;
  };

  // Action tag parser
  const parseActionsFromResponse = (text: string) => {
    const actions: ChatAction[] = [];
    let cleanedContent = text;
    const matches = [...text.matchAll(/\[ACTION:(create_task|create_event|create_note|create_transaction)\|([^\]]+)\]/g)];

    matches.forEach((match) => {
      const [fullMatch, type, rawPayload] = match;
      cleanedContent = cleanedContent.replace(fullMatch, '');
      const parts = rawPayload.split('|');

      if (type === 'create_task') {
        const [title, dueDate, priority, description] = parts;
        actions.push({
          type,
          status: 'idle',
          payload: {
            title: title?.trim(),
            due_date: dueDate?.trim() || null,
            priority: (priority?.trim() || 'none') as any,
            description: description?.trim() || null,
          },
        });
      } else if (type === 'create_event') {
        const [title, startTime, endTime, description] = parts;
        actions.push({
          type,
          status: 'idle',
          payload: {
            title: title?.trim(),
            start_time: startTime?.trim(),
            end_time: endTime?.trim() || startTime?.trim(),
            description: description?.trim() || null,
            recurrence: 'none',
            type: 'Event',
            all_day: false,
          },
        });
      } else if (type === 'create_note') {
        const [title, body] = parts;
        actions.push({
          type,
          status: 'idle',
          payload: {
            title: title?.trim() || 'AI Generated Note',
            body: body?.trim() || '',
            note_date: new Date().toISOString().slice(0, 10),
          },
        });
      } else if (type === 'create_transaction') {
        const [description, amount, txType, category] = parts;
        actions.push({
          type,
          status: 'idle',
          payload: {
            description: description?.trim() || 'AI Transaction',
            amount: parseFloat(amount?.trim() || '0'),
            type: (txType?.trim() || 'expense') as any,
            category: (category?.trim() || 'other_expense') as any,
            date: new Date().toISOString().slice(0, 10),
            is_recurring: false,
          },
        });
      }
    });

    return {
      cleanedContent: cleanedContent.trim(),
      actions,
    };
  };

  // Submit query handler
  const handleSendMessage = async (textToSend?: string) => {
    const finalQuery = (textToSend || inputText).trim();
    if (!finalQuery) return;

    if (!aiEnabled || !aiApiKey) return;

    if (!textToSend) setInputText('');

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `ai-${Date.now()}`;
    const nowIso = new Date().toISOString();

    // Auto-update thread title if default
    let updatedTitle = activeThread.title;
    if (activeThread.title === 'New Conversation') {
      updatedTitle = finalQuery.slice(0, 32);
    }

    // Add user message to active thread
    const newMsgObj: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: finalQuery,
      timestamp: nowIso,
    };

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== activeThreadId) return t;
        return {
          ...t,
          title: updatedTitle,
          updatedAt: nowIso,
          messages: [...t.messages.filter((m) => m.id !== 'welcome'), newMsgObj],
        };
      })
    );

    setIsGenerating(true);

    try {
      const knowledgeContext = compileKnowledgeContext(finalQuery);

      const systemPrompt = `You are lifeOS AI, an intelligent, helpful, and privacy-focused personal life assistant. You understand English and Egyptian Arabic dialect (اللهجة المصرية). You have access to the user's workspace knowledge (tasks, habits, notes, calendar events, transactions, sleep logs, screen time, and health biometrics).

When answering, analyze the provided data context to give personalized, precise, and actionable recommendations. Maintain a professional, encouraging, and clear tone.

CRITICAL FEATURE: You can recommend action steps (tasks, calendar events, notes, transactions) for the user. When recommending them, you MUST append one or more special ACTION blocks at the very end of your response using this exact syntax:
[ACTION:create_task|Title|Due Date (YYYY-MM-DD)|Priority (none/low/medium/high)|Description]
[ACTION:create_event|Title|Start Time (ISO-8601 YYYY-MM-DDTHH:mm:ss)|End Time (ISO-8601 YYYY-MM-DDTHH:mm:ss)|Description]
[ACTION:create_note|Title|Body Content]
[ACTION:create_transaction|Description|Amount|Type (income/expense)|Category (salary/freelance/investment/other_income/food/transport/utilities/entertainment/health/education/shopping/ipn/other_expense)]

Example responses with actions:
"I noticed you have low sleep. I suggest scheduling an early bedtime event and creating a task to wind down.
[ACTION:create_task|Bedtime prep|2026-07-21|high|Turn off screens and read a book]
[ACTION:create_event|Sleep Bedtime|2026-07-21T22:00:00|2026-07-21T22:30:00|Wind down for sleep]"

Current Date/Time: ${new Date().toLocaleString()}

Use the following workspace knowledge to answer the user's queries:
${knowledgeContext}`;

      const aiResponseRaw = await askAI(systemPrompt, finalQuery);
      const { cleanedContent, actions } = parseActionsFromResponse(aiResponseRaw);

      const assistantMsgObj: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: cleanedContent,
        timestamp: new Date().toISOString(),
        actions: actions.length > 0 ? actions : undefined,
      };

      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== activeThreadId) return t;
          return {
            ...t,
            updatedAt: new Date().toISOString(),
            messages: [...t.messages, assistantMsgObj],
          };
        })
      );
    } catch (error: any) {
      console.error('AI completion error:', error);
      const errorMsgObj: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: `⚠️ **Error communicating with AI Router**: ${error.message || 'Unknown network error'}. Please check your API configuration in Settings.`,
        timestamp: new Date().toISOString(),
      };
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== activeThreadId) return t;
          return {
            ...t,
            messages: [...t.messages, errorMsgObj],
          };
        })
      );
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const prompt = searchParams.get('prompt');
    if (prompt && !promptConsumedRef.current) {
      promptConsumedRef.current = true;
      setSearchParams((p) => {
        p.delete('prompt');
        return p;
      }, { replace: true });
      void handleSendMessage(prompt);
    }
  }, [searchParams, setSearchParams]);

  // Copy message text helper
  const handleCopyText = (id: string, content: string) => {
    void navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Regenerate last assistant response
  const handleRegenerate = () => {
    const userMsgs = activeMessages.filter((m) => m.role === 'user');
    const lastUserMsg = userMsgs[userMsgs.length - 1];
    if (lastUserMsg) {
      void handleSendMessage(lastUserMsg.content);
    }
  };

  // Run database update for action cards
  const handleExecuteAction = async (messageId: string, actionIndex: number) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== activeThreadId) return t;
        return {
          ...t,
          messages: t.messages.map((m) => {
            if (m.id !== messageId || !m.actions) return m;
            const nextActs = [...m.actions];
            nextActs[actionIndex] = { ...nextActs[actionIndex], status: 'executing' };
            return { ...m, actions: nextActs };
          }),
        };
      })
    );

    const targetMessage = activeMessages.find((m) => m.id === messageId);
    const targetAction = targetMessage?.actions?.[actionIndex];
    if (!targetAction) return;

    try {
      if (targetAction.type === 'create_task') {
        await createTask.mutateAsync(targetAction.payload);
      } else if (targetAction.type === 'create_event') {
        await createEvent.mutateAsync(targetAction.payload);
      } else if (targetAction.type === 'create_note') {
        await createNote.mutateAsync(targetAction.payload);
      } else if (targetAction.type === 'create_transaction') {
        await createTransaction.mutateAsync(targetAction.payload);
      }

      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== activeThreadId) return t;
          return {
            ...t,
            messages: t.messages.map((m) => {
              if (m.id !== messageId || !m.actions) return m;
              const nextActs = [...m.actions];
              nextActs[actionIndex] = { ...nextActs[actionIndex], status: 'completed' };
              return { ...m, actions: nextActs };
            }),
          };
        })
      );
    } catch (err: any) {
      console.error('Action failed:', err);
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== activeThreadId) return t;
          return {
            ...t,
            messages: t.messages.map((m) => {
              if (m.id !== messageId || !m.actions) return m;
              const nextActs = [...m.actions];
              nextActs[actionIndex] = {
                ...nextActs[actionIndex],
                status: 'failed',
                error: err.message || 'Action failed',
              };
              return { ...m, actions: nextActs };
            }),
          };
        })
      );
    }
  };

  // Redirection onboarding card if AI settings are missing
  if (!aiEnabled || !aiApiKey) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-lg text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-bold">AI Assistant Inactive</h2>
          <p className="text-sm text-muted-foreground">
            The AI Chat Assistant is powered by your local data, but is currently disabled. Enable AI Integration and set your API Key in Settings to unlock chat insights.
          </p>
          <div className="pt-2">
            <Link to="/settings">
              <Button className="w-full gap-2 min-h-[44px]">
                <Settings size={16} />
                Configure AI in Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0 h-full w-full bg-background text-foreground overflow-hidden">
      
      {/* MINIMALIST HEADER BAR */}
      <header className="h-14 border-b border-border/40 px-4 flex items-center justify-between shrink-0 bg-background/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-2 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Toggle Sidebar & Chat History"
          >
            <PanelLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-foreground/90 truncate max-w-[200px] sm:max-w-sm">
            {activeThread.title}
          </span>
        </div>

        <button
          type="button"
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 hover:bg-secondary/60 text-xs font-semibold transition-colors min-h-[40px]"
        >
          <Plus size={14} />
          <span>New Chat</span>
        </button>
      </header>

      {/* MAIN CONVERSATION AREA - CENTERED MAX-W-3XL */}
      <main className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col px-4 py-6 space-y-6">
          
          {/* BLANK SLATE (Initial state prompt shortcuts) - Disappears on first message */}
          {isThreadEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-12 animate-in fade-in duration-500">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                <Sparkles size={24} />
              </div>
              <div className="space-y-1 max-w-md">
                <h1 className="text-xl font-bold tracking-tight">What would you like to focus on today?</h1>
                <p className="text-xs text-muted-foreground">
                  Ask me about your schedule, habits, budget, or sleep.
                </p>
              </div>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg pt-4">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => { inputRef.current?.blur(); void handleSendMessage('Review my active tasks and scheduled events today. Help me plan my day with a realistic schedule.'); }}
                  className="text-left p-3.5 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 text-xs font-medium transition-all group shadow-sm flex items-center gap-3 min-h-[48px]"
                >
                  <Calendar size={16} className="text-primary shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="line-clamp-2">📅 Plan my day & priorities</span>
                </button>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => { inputRef.current?.blur(); void handleSendMessage('نظّملي يومي ومهام بكرة واكتبلي قائمة بالخطوات القادمة'); }}
                  className="text-left p-3.5 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 text-xs font-medium transition-all group shadow-sm flex items-center gap-3 min-h-[48px]">
                  <Sparkles size={16} className="text-emerald-500 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="line-clamp-2">🇪🇬 نظّملي يومي ومهام بكرة</span>
                </button>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => { inputRef.current?.blur(); void handleSendMessage('Perform a holistic check of my habits, sleep patterns, and screentime stats from the past week.'); }}
                  className="text-left p-3.5 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 text-xs font-medium transition-all group shadow-sm flex items-center gap-3 min-h-[48px]">
                  <Activity size={16} className="text-blue-500 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="line-clamp-2">📊 Health & Habit review</span>
                </button>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => { inputRef.current?.blur(); void handleSendMessage('Review my recent transactions, income, and expenses. Audit my current spending.'); }}
                  className="text-left p-3.5 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 text-xs font-medium transition-all group shadow-sm flex items-center gap-3 min-h-[48px]">
                  <Wallet size={16} className="text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="line-clamp-2">💰 Budget & Spending audit</span>
                </button>
              </div>
            </div>
          ) : (
            /* MESSAGE STREAM */
            activeMessages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex flex-col space-y-2 animate-in fade-in duration-300',
                    isUser ? 'items-end' : 'items-start'
                  )}
                >
                  {/* Bubble */}
                  <div
                    className={cn(
                      'text-sm leading-relaxed max-w-full sm:max-w-[90%]',
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-3 shadow-sm'
                        : 'text-foreground prose prose-zinc dark:prose-invert max-w-none'
                    )}
                  >
                    {isUser ? (
                      msg.content
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: parser.parse(msg.content) as string,
                        }}
                      />
                    )}
                  </div>

                  {/* Inline Action Cards (Mixed Inputs embedded in stream) */}
                  {!isUser && msg.actions && msg.actions.length > 0 && (
                    <div className="w-full space-y-2 pt-2">
                      {msg.actions.map((act, idx) => {
                        const isExecuted = act.status === 'completed';
                        const isExecuting = act.status === 'executing';
                        const isFailed = act.status === 'failed';

                        let icon = <CheckSquare size={14} />;
                        let titleText = 'Add Task';
                        let details = act.payload.title;

                        if (act.type === 'create_event') {
                          icon = <Calendar size={14} />;
                          titleText = 'Schedule Event';
                          details = `${act.payload.title}`;
                        } else if (act.type === 'create_note') {
                          icon = <FileText size={14} />;
                          titleText = 'Save Note';
                          details = act.payload.title;
                        } else if (act.type === 'create_transaction') {
                          icon = <Wallet size={14} />;
                          titleText = `Record ${act.payload.type === 'income' ? 'Income' : 'Expense'}`;
                          details = `${act.payload.description} ($${act.payload.amount})`;
                        }

                        return (
                          <div
                            key={idx}
                            className={cn(
                              'flex items-center justify-between gap-3 p-3 rounded-xl border bg-card text-xs shadow-sm transition-all max-w-lg',
                              isExecuted
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : isFailed
                                ? 'border-destructive/30 bg-destructive/5'
                                : 'border-border/80'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={cn('p-1.5 rounded-lg shrink-0', isExecuted ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary')}>
                                {icon}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                                  {titleText}
                                </p>
                                <p className="font-medium text-foreground truncate mt-0.5">{details}</p>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant={isExecuted ? 'outline' : 'secondary'}
                              disabled={isExecuted || isExecuting}
                              onClick={() => handleExecuteAction(msg.id, idx)}
                              className={cn('h-8 px-3 text-xs font-semibold gap-1 shrink-0 min-h-[36px]', isExecuted && 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5')}
                            >
                              {isExecuting ? <Loader2 size={12} className="animate-spin" /> : isExecuted ? <Check size={12} /> : <Plus size={12} />}
                              {isExecuting ? 'Adding...' : isExecuted ? 'Added' : 'Execute'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline Message Controls (Copy / Regenerate) */}
                  {!isUser && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs pt-1 opacity-70 hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="p-1 rounded hover:bg-secondary/60 transition-colors flex items-center gap-1 min-h-[32px]"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        <span className="text-[10px]">{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRegenerate}
                        disabled={isGenerating}
                        className="p-1 rounded hover:bg-secondary/60 transition-colors flex items-center gap-1 min-h-[32px]"
                        title="Regenerate response"
                      >
                        <RotateCw size={13} className={cn(isGenerating && 'animate-spin')} />
                        <span className="text-[10px]">Retry</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isGenerating && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 animate-in fade-in">
              <Loader2 size={14} className="animate-spin text-primary" />
              <span>Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* INPUT BAR - FIXED AT BOTTOM, CENTERED */}
      <footer ref={footerRef} className="sticky bottom-0 w-full border-t border-border/40 bg-background/95 backdrop-blur-md p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3 flex justify-center shrink-0 z-20">
        <div className="w-full max-w-3xl flex items-center gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSendMessage();
              }
            }}
            placeholder=""
            className="flex-1 resize-none overflow-y-auto max-h-28 bg-secondary/30 focus:bg-background border border-border/60 focus:border-primary rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          />
          <Button
            size="icon"
            type="button"
            variant="outline"
            onClick={() => {
              handleVoiceDictation((transcript) => {
                setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
              });
            }}
            className={cn(
              "h-11 w-11 shrink-0 rounded-xl border-border/60 min-h-[44px] min-w-[44px]",
              isListening && "border-red-500 text-red-500 animate-pulse bg-red-500/10"
            )}
            title="Voice Dictate Input"
          >
            <Mic size={16} />
          </Button>
          <Button
            size="icon"
            disabled={isGenerating || !inputText.trim()}
            onClick={() => void handleSendMessage()}
            className="h-11 w-11 shrink-0 rounded-xl shadow-sm min-h-[44px] min-w-[44px]"
          >
            <Send size={16} />
          </Button>
        </div>
      </footer>

      {/* COLLAPSIBLE SIDEBAR DRAWER (SETTINGS, CHAT HISTORY 4+, KNOWLEDGE TOGGLES) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Drawer content */}
          <aside className="relative z-10 w-80 max-w-[85vw] bg-card border-r border-border h-full flex flex-col p-4 space-y-6 shadow-2xl animate-in slide-in-from-left duration-300 overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Brain size={16} className="text-primary" />
                <span>Chat & Settings</span>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* New Chat Button */}
            <Button onClick={handleNewChat} className="w-full gap-2 justify-start min-h-[44px]">
              <Plus size={16} />
              <span>New Chat</span>
            </Button>

            {/* Persistent Threads History (at least 4) */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                Chat History ({threads.length})
              </p>
              <div className="space-y-1">
                {threads.map((t) => {
                  const isActive = t.id === activeThreadId;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setActiveThreadId(t.id);
                        setSidebarOpen(false);
                      }}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-colors group',
                        isActive ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare size={14} className="shrink-0" />
                        <span className="truncate">{t.title}</span>
                      </div>
                      {threads.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteThread(t.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                          title="Delete thread"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Knowledge Sources Toggles */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                Knowledge Context
              </p>
              <div className="space-y-2">
                {[
                  { id: 'tasks', label: 'Tasks & Lists', icon: <CheckSquare size={14} /> },
                  { id: 'calendar', label: 'Calendar Events', icon: <Calendar size={14} /> },
                  { id: 'habits', label: 'Habits & Streaks', icon: <Activity size={14} /> },
                  { id: 'notes', label: 'Personal Notes', icon: <FileText size={14} /> },
                  { id: 'finance', label: 'Transactions & Balances', icon: <Wallet size={14} /> },
                  { id: 'health', label: 'Sleep & Bio-metrics', icon: <Moon size={14} /> },
                ].map((src) => (
                  <label
                    key={src.id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-secondary/40 border border-transparent hover:border-border/30 cursor-pointer text-xs font-semibold"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {src.icon}
                      <span>{src.label}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={(activeSources as any)[src.id]}
                      onChange={(e) =>
                        setActiveSources((prev) => ({ ...prev, [src.id]: e.target.checked }))
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Model & Config Info */}
            <div className="mt-auto pt-4 border-t border-border/60 space-y-2 text-xs text-muted-foreground">
              <p>Model: <strong className="text-foreground">{aiModel}</strong></p>
              <Link to="/settings" className="inline-flex items-center gap-1.5 text-primary hover:underline text-xs font-semibold">
                <Settings size={14} />
                <span>AI Configuration Settings</span>
              </Link>
            </div>

          </aside>
        </div>
      )}

    </div>
  );
}
