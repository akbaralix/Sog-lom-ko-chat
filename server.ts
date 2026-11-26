import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  DEFAULT_FREE_SCAN_LIMIT,
  applyPackageUpgrade,
  canPerformScan,
  normalizeUzbekPhone,
  validateTelegramContact,
} from './src/lib/validation';
import {
  PRO_PACKAGES,
  buildClickCheckoutUrl,
  buildPaymeCheckoutUrl,
  getProPackage,
  uzsToTiyin,
  verifyClickSignature,
  verifyPaymeBasicAuth,
} from './src/lib/payments';
import {
  computeTelegramBackoffMs,
  computeTelegramConflictBackoffMs,
  isTelegramGetUpdatesConflict,
  isTelegramWebhookConflict,
  isTransientTelegramNetworkError,
} from './src/lib/telegramPolling';
import {
  resolvePublicWebAppUrl,
  verifyTelegramWebAppContactResponse,
  verifyTelegramWebAppInitData,
} from './src/lib/telegramWebApp';
import {
  evaluateTopicGateResponse,
  parseLightTopicGateJson,
  shouldChargeScanQuota,
} from './src/lib/plantImagePreflight';
import {
  UZ_REGIONS,
  evaluateWeatherRisk,
  normalizeAffectedSpots,
} from './src/lib/agroCatalog';
import {
  SESSION_COOKIE_NAME,
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  isHttpsRequest,
  isTrustedMutationOrigin,
  parseCookies,
} from './src/lib/sessionCookie';
import {
  buildDiagnosisChatContextPrompt,
  canSendChatMessage,
  sanitizeChatMessageText,
} from './src/lib/diagnosisChat';
import type {
  AgroOrder,
  ConsultationRequest,
  DiagnosisChatMessage,
  DiagnosisRecord,
  PaymentOrder,
  PaymentProvider,
  RecommendedClass,
  TreatmentPlan,
  UserProfile,
  WeatherRiskReport,
} from './src/types';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), '.data');
const STORE_PATH = path.resolve(DATA_DIR, 'store.json');
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
let resolvedBotUsername = (process.env.TELEGRAM_BOT_USERNAME ?? '').trim().replace(/^@/, '');

const CLICK_SERVICE_ID = (process.env.CLICK_SERVICE_ID ?? '').trim();
const CLICK_MERCHANT_ID = (process.env.CLICK_MERCHANT_ID ?? '').trim();
const CLICK_SECRET_KEY = (process.env.CLICK_SECRET_KEY ?? '').trim();
const PAYME_MERCHANT_ID = (process.env.PAYME_MERCHANT_ID ?? '').trim();
const PAYME_SECRET_KEY = (process.env.PAYME_SECRET_KEY ?? '').trim();

function isProviderLiveConfigured(provider: PaymentProvider): boolean {
  if (provider === 'click') {
    return Boolean(CLICK_SERVICE_ID && CLICK_MERCHANT_ID && CLICK_SECRET_KEY);
  }
  return Boolean(PAYME_MERCHANT_ID && PAYME_SECRET_KEY);
}

interface StoredUser extends UserProfile {
  avatarFileId?: string | null;
  telegramChatId?: number | null;
}

interface AuthChallenge {
  id: string;
  createdAt: number;
  status: 'pending' | 'verified' | 'rejected';
  expectedTelegramUserId?: number;
  error?: string;
  token?: string;
  userId?: string;
}

interface PersistedStore {
  users: Record<string, StoredUser>;
  paymentOrders?: Record<string, PaymentOrder>;
}

const users = new Map<string, StoredUser>();
const paymentOrders = new Map<string, PaymentOrder>();
const challenges = new Map<string, AuthChallenge>();
const telegramPendingByChat = new Map<number, string>();
const revokedTokens = new Set<string>();

function loadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return;
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedStore;
    if (parsed && parsed.users) {
      for (const [id, user] of Object.entries(parsed.users)) {
        users.set(id, user);
      }
    }
    if (parsed && parsed.paymentOrders) {
      for (const [id, order] of Object.entries(parsed.paymentOrders)) {
        paymentOrders.set(id, order);
      }
    }
  } catch (err) {
    console.error('Failed to load store:', err);
  }
}

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload: PersistedStore = {
      users: Object.fromEntries(users.entries()),
      paymentOrders: Object.fromEntries(paymentOrders.entries()),
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save store:', err);
  }
}

loadStore();

function signSessionToken(userId: string): string {
  const issuedAt = Date.now();
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat: issuedAt, n: nonce })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): string | null {
  if (!token || revokedTokens.has(token)) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { uid?: string };
    return typeof parsed.uid === 'string' && users.has(parsed.uid) ? parsed.uid : null;
  } catch {
    return null;
  }
}

const IMAGES_DIR = path.resolve(DATA_DIR, 'images');

function saveDiagnosisImage(id: string, mimeType: string, imageBase64: string): string | undefined {
  try {
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const filePath = path.resolve(IMAGES_DIR, `${id}.${ext}`);
    fs.writeFileSync(filePath, Buffer.from(imageBase64, 'base64'));
    return `/api/diagnoses/${encodeURIComponent(id)}/image`;
  } catch {
    return undefined;
  }
}

function findDiagnosisImageFile(id: string): { filePath: string; mimeType: string } | null {
  if (!/^[a-f0-9]+$/i.test(id)) return null;
  const candidates: Array<{ ext: string; mime: string }> = [
    { ext: 'jpg', mime: 'image/jpeg' },
    { ext: 'png', mime: 'image/png' },
    { ext: 'webp', mime: 'image/webp' },
  ];
  for (const c of candidates) {
    const p = path.resolve(IMAGES_DIR, `${id}.${c.ext}`);
    if (fs.existsSync(p)) return { filePath: p, mimeType: c.mime };
  }
  return null;
}

function toPublicDiagnosis(d: DiagnosisRecord): DiagnosisRecord {
  const hasImage = Boolean(d.imagePreview) || Boolean(findDiagnosisImageFile(d.id));
  return {
    ...d,
    imagePreview: hasImage ? `/api/diagnoses/${encodeURIComponent(d.id)}/image` : undefined,
    chatMessages: d.chatMessages ?? [],
  };
}

function toPublicUser(user: StoredUser): UserProfile {
  return {
    id: user.id,
    telegramId: user.telegramId,
    name: user.name,
    username: user.username,
    phone: user.phone,
    avatarUrl: user.avatarFileId ? `/api/auth/avatar/${encodeURIComponent(user.id)}` : user.avatarUrl,
    plan: user.plan,
    scanLimit: user.scanLimit,
    scansUsed: user.scansUsed,
    history: (user.history ?? []).map(toPublicDiagnosis),
    treatmentPlans: user.treatmentPlans ?? [],
    consultations: user.consultations ?? [],
    orders: user.orders ?? [],
    payments: (user.payments ?? []).slice(0, 15),
  };
}

function upsertTelegramUser(params: {
  telegramId: number;
  telegramChatId?: number | null;
  name: string;
  username: string | null;
  phone: string;
  avatarFileId?: string | null;
  avatarUrl?: string | null;
}): StoredUser {
  const id = `tg_${params.telegramId}`;
  const existing = users.get(id);
  const updated: StoredUser = existing
    ? {
        ...existing,
        telegramChatId:
          params.telegramChatId !== undefined ? params.telegramChatId : existing.telegramChatId,
        name: params.name,
        username: params.username,
        phone: params.phone,
        avatarFileId: params.avatarFileId !== undefined ? params.avatarFileId : existing.avatarFileId,
        avatarUrl: params.avatarUrl !== undefined ? params.avatarUrl : existing.avatarUrl,
        treatmentPlans: existing.treatmentPlans ?? [],
        consultations: existing.consultations ?? [],
        orders: existing.orders ?? [],
      }
    : {
        id,
        telegramId: params.telegramId,
        telegramChatId: params.telegramChatId ?? null,
        name: params.name,
        username: params.username,
        phone: params.phone,
        avatarFileId: params.avatarFileId ?? null,
        avatarUrl: params.avatarUrl ?? null,
        plan: 'free',
        scanLimit: DEFAULT_FREE_SCAN_LIMIT,
        scansUsed: 0,
        history: [],
        treatmentPlans: [],
        consultations: [],
        orders: [],
      };
  users.set(id, updated);
  saveStore();
  return updated;
}

interface AuthenticatedRequest extends Request {
  user?: StoredUser;
  authToken?: string;
}

function setSessionCookie(req: Request, res: Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    buildSessionCookieHeader(token, isHttpsRequest(req.headers, req.secure)),
  );
}

function clearSessionCookie(req: Request, res: Response) {
  res.setHeader(
    'Set-Cookie',
    buildClearSessionCookieHeader(isHttpsRequest(req.headers, req.secure)),
  );
}

function extractAuthToken(req: Request): { token: string | null; source: 'bearer' | 'cookie' | null } {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match && match[1].trim()) {
    return { token: match[1].trim(), source: 'bearer' };
  }
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    return { token: cookieToken, source: 'cookie' };
  }
  return { token: null, source: null };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const { token, source } = extractAuthToken(req);
  if (!token || !source) {
    res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    return;
  }

  if (
    source === 'cookie' &&
    !isTrustedMutationOrigin({ method: req.method, headers: req.headers })
  ) {
    res.status(403).json({ error: "Noto'g'ri so'rov manbai." });
    return;
  }

  const userId = verifySessionToken(token);
  if (!userId) {
    if (source === 'cookie') {
      clearSessionCookie(req, res);
    }
    res.status(401).json({ error: 'Sessiya muddati tugagan. Qayta kiring.' });
    return;
  }
  const user = users.get(userId);
  if (!user) {
    if (source === 'cookie') {
      clearSessionCookie(req, res);
    }
    res.status(401).json({ error: 'Foydalanuvchi topilmadi.' });
    return;
  }
  req.user = user;
  req.authToken = token;
  next();
}

async function telegramApiDetailed<T>(
  method: string,
  body?: Record<string, unknown>,
  options?: { timeoutMs?: number; suppressTransientErrorLog?: boolean; signal?: AbortSignal },
): Promise<{
  ok: boolean;
  result: T | null;
  errorCode?: number;
  description?: string;
  networkError?: boolean;
  aborted?: boolean;
}> {
  if (!TELEGRAM_BOT_TOKEN) return { ok: false, result: null };
  const timeoutMs = options?.timeoutMs ?? 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer);
      return { ok: false, result: null, aborted: true };
    }
    options.signal.addEventListener('abort', onParentAbort, { once: true });
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: T;
      error_code?: number;
      description?: string;
    };
    if (!data.ok) {
      return {
        ok: false,
        result: null,
        errorCode: data.error_code,
        description: data.description,
      };
    }
    return { ok: true, result: data.result ?? null };
  } catch (err) {
    if (options?.signal?.aborted) {
      return { ok: false, result: null, aborted: true };
    }
    const transient = isTransientTelegramNetworkError(err);
    if (!options?.suppressTransientErrorLog || !transient) {
      console.warn(`Telegram API network warning (${method}):`, err instanceof Error ? err.message : err);
    }
    return { ok: false, result: null, networkError: true };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener('abort', onParentAbort);
  }
}

async function telegramApi<T>(method: string, body?: Record<string, unknown>): Promise<T | null> {
  const res = await telegramApiDetailed<T>(method, body);
  if (!res.ok && res.description) {
    console.warn(`Telegram API error (${method}):`, res.description);
  }
  return res.result;
}

async function fetchTelegramAvatarFileId(telegramUserId: number): Promise<string | null> {
  interface PhotosResult {
    total_count: number;
    photos: Array<Array<{ file_id: string; width: number }>>;
  }
  const photos = await telegramApi<PhotosResult>('getUserProfilePhotos', {
    user_id: telegramUserId,
    limit: 1,
  });
  if (!photos || !photos.photos?.length || !photos.photos[0]?.length) {
    return null;
  }
  const sizes = photos.photos[0];
  return sizes[sizes.length - 1].file_id;
}

let telegramPollingStarted = false;

function startTelegramPolling() {
  if (!TELEGRAM_BOT_TOKEN || telegramPollingStarted) return;
  telegramPollingStarted = true;

  let offset = 0;
  let active = true;
  let consecutiveNetworkFailures = 0;
  let consecutiveConflicts = 0;
  const shutdownController = new AbortController();

  const waitAbortable = (ms: number) =>
    new Promise<void>((resolve) => {
      if (!active) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        shutdownController.signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      shutdownController.signal.addEventListener('abort', onAbort, { once: true });
    });

  const stop = () => {
    active = false;
    shutdownController.abort();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);

  void (async () => {
    const me = await telegramApi<{ username?: string }>('getMe');
    if (me?.username && !resolvedBotUsername) {
      resolvedBotUsername = me.username;
    }

    // Ensure any previously configured webhook is removed before polling getUpdates
    await telegramApi('deleteWebhook', { drop_pending_updates: false });

    const webAppUrl = resolvePublicWebAppUrl(process.env.APP_URL);
    if (webAppUrl) {
      await telegramApi('setChatMenuButton', {
        menu_button: {
          type: 'web_app',
          text: 'Ilovani ochish',
          web_app: { url: webAppUrl },
        },
      });
    }

    while (active) {
      try {
        interface TgUpdate {
          update_id: number;
          message?: {
            chat: { id: number };
            from?: {
              id: number;
              first_name?: string;
              last_name?: string;
              username?: string;
            };
            text?: string;
            contact?: {
              phone_number: string;
              user_id?: number;
              first_name?: string;
              last_name?: string;
            };
          };
        }

        const updatesRes = await telegramApiDetailed<TgUpdate[]>(
          'getUpdates',
          {
            offset,
            timeout: 15,
            allowed_updates: ['message'],
          },
          {
            timeoutMs: 22000,
            suppressTransientErrorLog: true,
            signal: shutdownController.signal,
          },
        );

        if (updatesRes.aborted || !active) {
          break;
        }

        if (!updatesRes.ok) {
          if (isTelegramWebhookConflict(updatesRes.errorCode, updatesRes.description)) {
            await telegramApi('deleteWebhook', { drop_pending_updates: false });
            await waitAbortable(2000);
            continue;
          }

          if (isTelegramGetUpdatesConflict(updatesRes.errorCode, updatesRes.description)) {
            consecutiveConflicts += 1;
            if (consecutiveConflicts === 1) {
              console.info(
                'Another Telegram bot instance is actively polling getUpdates; yielding with backoff.',
              );
            }
            await waitAbortable(computeTelegramConflictBackoffMs(consecutiveConflicts));
            continue;
          }

          if (updatesRes.description) {
            console.warn('Telegram API notice (getUpdates):', updatesRes.description);
          }

          if (updatesRes.networkError) {
            consecutiveNetworkFailures += 1;
            if (consecutiveNetworkFailures === 3) {
              console.warn('Telegram getUpdates network unstable; backing off retries.');
            }
            await waitAbortable(computeTelegramBackoffMs(consecutiveNetworkFailures));
          } else {
            await waitAbortable(5000);
          }
          continue;
        }

        consecutiveNetworkFailures = 0;
        consecutiveConflicts = 0;

        const updates = updatesRes.result;
        if (updates && Array.isArray(updates)) {
          for (const upd of updates) {
            offset = upd.update_id + 1;
            const msg = upd.message;
            if (!msg || !msg.from) continue;

            if (msg.text && msg.text.startsWith('/start')) {
              const parts = msg.text.trim().split(/\s+/);
              const startArg = parts[1] ?? '';
              const challengeId = startArg.startsWith('auth_') ? startArg.slice(5) : '';
              const challenge = challengeId ? challenges.get(challengeId) : undefined;

              if (startArg.startsWith('auth_')) {
                if (!challenge || challenge.status !== 'pending') {
                  await telegramApi('sendMessage', {
                    chat_id: msg.chat.id,
                    text: "Kirish havolasi eskirgan. Iltimos, Sog'lom Ko'chat ilovasidan qaytadan 'Telegram orqali kirish' tugmasini bosing.",
                  });
                  continue;
                }

                telegramPendingByChat.set(msg.from.id, challenge.id);
                await telegramApi('sendMessage', {
                  chat_id: msg.chat.id,
                  text: "Assalomu alaykum! Sog'lom Ko'chat platformasiga kirish uchun o'zingizga tegishli O'zbekiston (+998) telefon raqamingizni yuboring:",
                  reply_markup: {
                    keyboard: [[{ text: '📱 Telefon raqamimni yuborish', request_contact: true }]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                  },
                });
              } else if (webAppUrl) {
                await telegramApi('sendMessage', {
                  chat_id: msg.chat.id,
                  text: "🌱 Assalomu alaykum! Sog'lom Ko'chat Telegram ilovasiga xush kelibsiz.\n\nPastdagi tugmani bosing — telefon raqamingizni ilovaning o'zida bir bosishda tasdiqlab foydalanishingiz mumkin:",
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "🌱 Sog'lom Ko'chat ilovasini ochish", web_app: { url: webAppUrl } }],
                    ],
                  },
                });
              } else {
                await telegramApi('sendMessage', {
                  chat_id: msg.chat.id,
                  text: "🌱 Assalomu alaykum! Sog'lom Ko'chat ilovasiga kirish uchun saytda 'Telegram orqali kirish' tugmasini bosing.",
                });
              }
            } else if (msg.contact) {
              const challengeId = telegramPendingByChat.get(msg.from.id);
              const challenge = challengeId ? challenges.get(challengeId) : undefined;

              const validation = validateTelegramContact({
                phoneNumber: msg.contact.phone_number,
                contactUserId: msg.contact.user_id ?? '',
                senderUserId: msg.from.id,
              });

              if (!validation.ok || !validation.normalizedPhone) {
                if (challenge) {
                  challenge.status = 'rejected';
                  challenge.error = validation.error;
                }
                await telegramApi('sendMessage', {
                  chat_id: msg.chat.id,
                  text: `❌ ${validation.error}`,
                  reply_markup: { remove_keyboard: true },
                });
                continue;
              }

              const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ').trim() || 'Foydalanuvchi';
              const avatarFileId = await fetchTelegramAvatarFileId(msg.from.id);
              const user = upsertTelegramUser({
                telegramId: msg.from.id,
                telegramChatId: msg.chat.id,
                name: fullName,
                username: msg.from.username ?? null,
                phone: validation.normalizedPhone,
                avatarFileId,
              });

              const token = signSessionToken(user.id);
              if (
                challenge &&
                challenge.status === 'pending' &&
                (!challenge.expectedTelegramUserId || challenge.expectedTelegramUserId === msg.from.id)
              ) {
                challenge.status = 'verified';
                challenge.userId = user.id;
                challenge.token = token;
                telegramPendingByChat.delete(msg.from.id);
              }

              await telegramApi('sendMessage', {
                chat_id: msg.chat.id,
                text: "✅ Hisobingiz muvaffaqiyatli tasdiqlandi! Endi Sog'lom Ko'chat ilovasidan foydalanishingiz mumkin.",
                reply_markup: webAppUrl
                  ? {
                      remove_keyboard: true,
                      inline_keyboard: [
                        [{ text: "🌱 Ilovani ochish", web_app: { url: webAppUrl } }],
                      ],
                    }
                  : { remove_keyboard: true },
              });
            }
          }
        }
      } catch (err) {
        if (!isTransientTelegramNetworkError(err)) {
          console.warn('Telegram polling loop warning:', err instanceof Error ? err.message : err);
        }
        consecutiveNetworkFailures += 1;
        await new Promise((resolve) =>
          setTimeout(resolve, computeTelegramBackoffMs(consecutiveNetworkFailures)),
        );
      }
    }
  })();
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function createAppServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, botConfigured: Boolean(TELEGRAM_BOT_TOKEN) });
  });

  app.post('/api/auth/telegram/init', (_req, res) => {
    const id = crypto.randomBytes(12).toString('hex');
    const challenge: AuthChallenge = {
      id,
      createdAt: Date.now(),
      status: 'pending',
    };
    challenges.set(id, challenge);

    // Prune stale challenges older than 15 minutes
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const [key, value] of challenges.entries()) {
      if (value.createdAt < cutoff) challenges.delete(key);
    }

    const botUsername = resolvedBotUsername || 'SoglomKochatBot';
    const deepLink = `https://t.me/${botUsername}?start=auth_${id}`;

    res.json({
      challengeId: id,
      deepLink,
      botUsername,
      botConfigured: Boolean(TELEGRAM_BOT_TOKEN),
    });
  });

  app.get('/api/auth/telegram/status/:challengeId', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const challenge = challenges.get(req.params.challengeId);
    if (!challenge) {
      res.status(404).json({ error: 'Kirish sessiyasi topilmadi.' });
      return;
    }

    if (challenge.status === 'verified' && challenge.userId && challenge.token) {
      const user = users.get(challenge.userId);
      if (user) {
        setSessionCookie(req, res, challenge.token);
        res.json({
          status: 'verified',
          token: challenge.token,
          user: toPublicUser(user),
        });
        return;
      }
    }

    res.json({
      status: challenge.status,
      error: challenge.error ?? null,
    });
  });

  app.post('/api/auth/telegram/verify-preview', (req, res) => {
    if (TELEGRAM_BOT_TOKEN) {
      res.status(403).json({
        error: "Real Telegram bot ulangan. Iltimos, Telegram bot orqali raqamingizni yuboring.",
      });
      return;
    }

    const { challengeId, name, username, phoneNumber, isOwnContact } = req.body as {
      challengeId?: string;
      name?: string;
      username?: string;
      phoneNumber?: string;
      isOwnContact?: boolean;
    };

    if (!challengeId || !challenges.has(challengeId)) {
      res.status(400).json({ error: 'Kirish sessiyasi topilmadi. Qaytadan boshlang.' });
      return;
    }

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (cleanName.length < 2) {
      res.status(400).json({ error: 'Ismingizni kamida 2 ta harf bilan kiriting.' });
      return;
    }

    const senderTelegramId = 800000000 + Math.abs(cleanName.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 9999999;
    const contactUserId = isOwnContact ? senderTelegramId : senderTelegramId + 1;

    const validation = validateTelegramContact({
      phoneNumber: phoneNumber ?? '',
      contactUserId,
      senderUserId: senderTelegramId,
    });

    if (!validation.ok || !validation.normalizedPhone) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const cleanUsername =
      typeof username === 'string' && username.trim().length > 0
        ? username.trim().replace(/^@/, '')
        : null;

    const user = upsertTelegramUser({
      telegramId: senderTelegramId,
      name: cleanName,
      username: cleanUsername,
      phone: validation.normalizedPhone,
      avatarFileId: null,
      avatarUrl: null,
    });

    const token = signSessionToken(user.id);
    const challenge = challenges.get(challengeId)!;
    challenge.status = 'verified';
    challenge.userId = user.id;
    challenge.token = token;

    setSessionCookie(req, res, token);
    res.json({
      token,
      user: toPublicUser(user),
    });
  });

  app.post('/api/auth/telegram/webapp', async (req, res) => {
    if (!TELEGRAM_BOT_TOKEN) {
      res.status(400).json({
        code: 'BOT_NOT_CONFIGURED',
        error: "Telegram bot tokeni sozlanmagan.",
      });
      return;
    }

    const { initData } = req.body as { initData?: string };
    if (typeof initData !== 'string' || !initData.trim()) {
      res.status(400).json({ error: "Telegram Web App ma'lumotlari yuborilmadi." });
      return;
    }

    const verified = verifyTelegramWebAppInitData(initData, TELEGRAM_BOT_TOKEN);
    if (!verified) {
      res.status(401).json({ error: "Telegram Web App imzosi tasdiqlanmadi." });
      return;
    }

    const tgUser = verified.user;
    const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() || 'Foydalanuvchi';
    const existing = users.get(`tg_${tgUser.id}`);

    if (existing && normalizeUzbekPhone(existing.phone)) {
      const updated = upsertTelegramUser({
        telegramId: tgUser.id,
        telegramChatId: existing.telegramChatId ?? tgUser.id,
        name: fullName,
        username: tgUser.username ?? existing.username,
        phone: existing.phone,
        avatarUrl: tgUser.photo_url ?? existing.avatarUrl ?? null,
      });
      const token = signSessionToken(updated.id);
      setSessionCookie(req, res, token);
      res.json({
        status: 'verified',
        token,
        user: toPublicUser(updated),
      });
      return;
    }

    const challengeId = crypto.randomBytes(12).toString('hex');
    challenges.set(challengeId, {
      id: challengeId,
      createdAt: Date.now(),
      status: 'pending',
      expectedTelegramUserId: tgUser.id,
    });
    telegramPendingByChat.set(tgUser.id, challengeId);

    res.json({
      status: 'needs_phone',
      challengeId,
      telegramUser: {
        id: tgUser.id,
        name: fullName,
        username: tgUser.username ?? null,
        photoUrl: tgUser.photo_url ?? null,
      },
    });
  });

  app.post('/api/auth/telegram/webapp/contact', async (req, res) => {
    if (!TELEGRAM_BOT_TOKEN) {
      res.status(400).json({
        code: 'BOT_NOT_CONFIGURED',
        error: "Telegram bot tokeni sozlanmagan.",
      });
      return;
    }

    const { initData, contactResponse, challengeId } = req.body as {
      initData?: string;
      contactResponse?: string;
      challengeId?: string;
    };

    if (typeof initData !== 'string' || typeof contactResponse !== 'string') {
      res.status(400).json({ error: "Tasdiqlangan kontakt ma'lumotlari yetarli emas." });
      return;
    }

    const verifiedInit = verifyTelegramWebAppInitData(initData, TELEGRAM_BOT_TOKEN);
    const verifiedContact = verifyTelegramWebAppContactResponse(contactResponse, TELEGRAM_BOT_TOKEN);
    if (!verifiedInit || !verifiedContact) {
      res.status(401).json({ error: "Telegram kontakt imzosi tasdiqlanmadi." });
      return;
    }

    const validation = validateTelegramContact({
      phoneNumber: verifiedContact.phoneNumber,
      contactUserId: verifiedContact.userId,
      senderUserId: verifiedInit.user.id,
    });
    if (!validation.ok || !validation.normalizedPhone) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const tgUser = verifiedInit.user;
    const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() || 'Foydalanuvchi';
    const avatarFileId = await fetchTelegramAvatarFileId(tgUser.id);
    const user = upsertTelegramUser({
      telegramId: tgUser.id,
      telegramChatId: tgUser.id,
      name: fullName,
      username: tgUser.username ?? null,
      phone: validation.normalizedPhone,
      avatarFileId,
      avatarUrl: tgUser.photo_url ?? null,
    });

    const token = signSessionToken(user.id);
    if (challengeId && challenges.has(challengeId)) {
      const challenge = challenges.get(challengeId)!;
      if (!challenge.expectedTelegramUserId || challenge.expectedTelegramUserId === tgUser.id) {
        challenge.status = 'verified';
        challenge.userId = user.id;
        challenge.token = token;
      }
    }
    telegramPendingByChat.delete(tgUser.id);

    setSessionCookie(req, res, token);
    res.json({
      status: 'verified',
      token,
      user: toPublicUser(user),
    });
  });

  app.post('/api/auth/demo', (req, res) => {
    const user = upsertTelegramUser({
      telegramId: 777001122,
      name: 'Azizbek Karimov',
      username: 'azizbek_agro',
      phone: '+998901234567',
      avatarFileId: null,
      avatarUrl: null,
    });
    const token = signSessionToken(user.id);
    setSessionCookie(req, res, token);
    res.json({
      token,
      user: toPublicUser(user),
    });
  });

  app.get('/api/auth/avatar/:userId', async (req, res) => {
    const user = users.get(req.params.userId);
    if (!user || !user.avatarFileId || !TELEGRAM_BOT_TOKEN) {
      res.status(404).end();
      return;
    }
    const fileInfo = await telegramApi<{ file_path?: string }>('getFile', {
      file_id: user.avatarFileId,
    });
    if (!fileInfo?.file_path) {
      res.status(404).end();
      return;
    }
    try {
      const upstream = await fetch(
        `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!upstream.ok) {
        res.status(404).end();
        return;
      }
      const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(buf);
    } catch {
      res.status(502).end();
    }
  });

  app.get('/api/auth/session', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const { token, source } = extractAuthToken(req);
    if (!token) {
      res.json({ authenticated: false, user: null });
      return;
    }
    const userId = verifySessionToken(token);
    const user = userId ? users.get(userId) : undefined;
    if (!user) {
      if (source === 'cookie') {
        clearSessionCookie(req, res);
      }
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({ authenticated: true, user: toPublicUser(user) });
  });

  app.get('/api/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ user: toPublicUser(req.user!) });
  });

  app.post('/api/auth/logout', (req, res) => {
    const { token, source } = extractAuthToken(req);
    if (
      source === 'cookie' &&
      !isTrustedMutationOrigin({ method: req.method, headers: req.headers })
    ) {
      res.status(403).json({ error: "Noto'g'ri so'rov manbai." });
      return;
    }
    if (token) revokedTokens.add(token);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  function resolveReturnUrl(req: Request, orderId: string): string {
    const appUrl = (process.env.APP_URL ?? '').trim();
    if (appUrl && /^https?:\/\//i.test(appUrl) && !appUrl.includes('MY_APP_URL')) {
      const base = appUrl.replace(/\/+$/, '');
      return `${base}/?payment_order=${encodeURIComponent(orderId)}`;
    }
    const hostHeader = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost:3000').split(',')[0].trim();
    const proto = isHttpsRequest(req.headers, req.secure) ? 'https' : 'http';
    return `${proto}://${hostHeader}/?payment_order=${encodeURIComponent(orderId)}`;
  }

  function completePaidOrder(order: PaymentOrder, providerTransId?: string | null): StoredUser | null {
    const user = users.get(order.userId) ?? null;
    if (order.status === 'paid') {
      return user;
    }

    order.status = 'paid';
    order.paidAt = new Date().toISOString();
    if (providerTransId) {
      order.providerTransId = providerTransId;
    }
    paymentOrders.set(order.id, order);

    if (user) {
      const upgraded = applyPackageUpgrade(
        {
          plan: user.plan,
          scanLimit: user.scanLimit,
          scansUsed: user.scansUsed,
        },
        order.scansAdded,
      );
      user.plan = upgraded.plan;
      user.scanLimit = upgraded.scanLimit;
      user.payments = [order, ...(user.payments ?? []).filter((p) => p.id !== order.id)].slice(0, 20);
      users.set(user.id, user);

      if (TELEGRAM_BOT_TOKEN && user.telegramChatId) {
        void telegramApi('sendMessage', {
          chat_id: user.telegramChatId,
          text: `✅ To'lov qabul qilindi (${order.provider === 'click' ? 'Click' : 'Payme'})!\nTarif: ${order.packageName} (+${order.scansAdded} ta rasm tahlili)\nYangi limit: ${user.scanLimit} ta\nCheksiz AI Agronom suhbati faollashtirildi.`,
        });
      }
    }

    saveStore();
    return user;
  }

  app.get('/api/payments/packages', (_req, res) => {
    res.json({
      packages: PRO_PACKAGES,
      providers: {
        click: { liveConfigured: isProviderLiveConfigured('click') },
        payme: { liveConfigured: isProviderLiveConfigured('payme') },
      },
    });
  });

  app.post('/api/payments/create', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { packageId, provider } = req.body as {
      packageId?: string;
      provider?: string;
    };

    const pkg = getProPackage(packageId);
    if (!pkg) {
      res.status(400).json({ error: "Noto'g'ri tarif paketi tanlandi." });
      return;
    }
    if (provider !== 'click' && provider !== 'payme') {
      res.status(400).json({ error: "Iltimos, Click yoki Payme to'lov usulini tanlang." });
      return;
    }

    const orderId = `ord_${crypto.randomBytes(6).toString('hex')}`;
    const order: PaymentOrder = {
      id: orderId,
      userId: user.id,
      packageId: pkg.id,
      packageName: pkg.name,
      provider,
      amountUzs: pkg.priceUzs,
      scansAdded: pkg.scansAdded,
      status: 'pending',
      createdAt: new Date().toISOString(),
      paidAt: null,
      providerTransId: null,
    };

    paymentOrders.set(order.id, order);
    user.payments = [order, ...(user.payments ?? [])].slice(0, 20);
    users.set(user.id, user);
    saveStore();

    const liveConfigured = isProviderLiveConfigured(provider);
    const returnUrl = resolveReturnUrl(req, order.id);
    const checkoutUrl = liveConfigured
      ? provider === 'click'
        ? buildClickCheckoutUrl({
            serviceId: CLICK_SERVICE_ID,
            merchantId: CLICK_MERCHANT_ID,
            amountUzs: order.amountUzs,
            orderId: order.id,
            returnUrl,
          })
        : buildPaymeCheckoutUrl({
            merchantId: PAYME_MERCHANT_ID,
            amountUzs: order.amountUzs,
            orderId: order.id,
            returnUrl,
          })
      : null;

    res.json({
      order,
      checkoutUrl,
      liveConfigured,
      user: toPublicUser(user),
    });
  });

  app.get('/api/payments/:orderId', requireAuth, (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const order = paymentOrders.get(req.params.orderId);
    if (!order || order.userId !== req.user!.id) {
      res.status(404).json({ error: "To'lov buyurtmasi topilmadi." });
      return;
    }
    res.json({
      order,
      user: toPublicUser(req.user!),
    });
  });

  app.post('/api/payments/sandbox-confirm', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { orderId } = req.body as { orderId?: string };
    if (!orderId) {
      res.status(400).json({ error: "Buyurtma raqami ko'rsatilmagan." });
      return;
    }
    const order = paymentOrders.get(orderId);
    if (!order || order.userId !== user.id) {
      res.status(404).json({ error: "To'lov buyurtmasi topilmadi." });
      return;
    }
    if (isProviderLiveConfigured(order.provider)) {
      res.status(403).json({
        error: "Real to'lov tizimi ulangan. To'lovni Click yoki Payme sahifasida yakunlang.",
      });
      return;
    }
    if (order.status === 'cancelled') {
      res.status(400).json({ error: "Ushbu to'lov bekor qilingan." });
      return;
    }

    completePaidOrder(order, `sbx_${order.id}`);
    res.json({
      order,
      user: toPublicUser(user),
    });
  });

  app.post('/api/payments/click/prepare', (req, res) => {
    if (!CLICK_SECRET_KEY || !CLICK_SERVICE_ID) {
      res.json({ error: -8, error_note: 'Click merchant credentials not configured' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const clickTransId = String(body.click_trans_id ?? '');
    const serviceId = String(body.service_id ?? '');
    const merchantTransId = String(body.merchant_trans_id ?? '');
    const amount = String(body.amount ?? '');
    const action = String(body.action ?? '');
    const signTime = String(body.sign_time ?? '');
    const signString = String(body.sign_string ?? '');

    if (
      serviceId !== CLICK_SERVICE_ID ||
      action !== '0' ||
      !verifyClickSignature({
        clickTransId,
        serviceId,
        secretKey: CLICK_SECRET_KEY,
        merchantTransId,
        amount,
        action,
        signTime,
        signString,
      })
    ) {
      res.json({ error: -1, error_note: 'SIGN CHECK FAILED!' });
      return;
    }

    const order = paymentOrders.get(merchantTransId);
    if (!order || order.provider !== 'click') {
      res.json({ error: -5, error_note: 'Order does not exist' });
      return;
    }
    if (order.status === 'paid') {
      res.json({ error: -4, error_note: 'Already paid' });
      return;
    }
    if (order.status === 'cancelled') {
      res.json({ error: -9, error_note: 'Transaction cancelled' });
      return;
    }
    if (Math.round(Number(amount)) !== order.amountUzs) {
      res.json({ error: -2, error_note: 'Incorrect parameter amount' });
      return;
    }

    res.json({
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      merchant_prepare_id: order.id,
      error: 0,
      error_note: 'Success',
    });
  });

  app.post('/api/payments/click/complete', (req, res) => {
    if (!CLICK_SECRET_KEY || !CLICK_SERVICE_ID) {
      res.json({ error: -8, error_note: 'Click merchant credentials not configured' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const clickTransId = String(body.click_trans_id ?? '');
    const serviceId = String(body.service_id ?? '');
    const merchantTransId = String(body.merchant_trans_id ?? '');
    const merchantPrepareId = String(body.merchant_prepare_id ?? '');
    const amount = String(body.amount ?? '');
    const action = String(body.action ?? '');
    const signTime = String(body.sign_time ?? '');
    const signString = String(body.sign_string ?? '');
    const clickError = Number(body.error ?? 0);

    if (
      serviceId !== CLICK_SERVICE_ID ||
      action !== '1' ||
      !verifyClickSignature({
        clickTransId,
        serviceId,
        secretKey: CLICK_SECRET_KEY,
        merchantTransId,
        merchantPrepareId,
        amount,
        action,
        signTime,
        signString,
      })
    ) {
      res.json({ error: -1, error_note: 'SIGN CHECK FAILED!' });
      return;
    }

    const order = paymentOrders.get(merchantTransId);
    if (!order || order.provider !== 'click' || merchantPrepareId !== order.id) {
      res.json({ error: -6, error_note: 'Transaction does not exist' });
      return;
    }
    if (order.status === 'paid') {
      res.json({ error: -4, error_note: 'Already paid' });
      return;
    }
    if (order.status === 'cancelled' || clickError < 0) {
      order.status = 'cancelled';
      paymentOrders.set(order.id, order);
      saveStore();
      res.json({ error: -9, error_note: 'Transaction cancelled' });
      return;
    }
    if (Math.round(Number(amount)) !== order.amountUzs) {
      res.json({ error: -2, error_note: 'Incorrect parameter amount' });
      return;
    }

    completePaidOrder(order, clickTransId);
    res.json({
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      merchant_confirm_id: order.id,
      error: 0,
      error_note: 'Success',
    });
  });

  app.post('/api/payments/payme', (req, res) => {
    const rpcBody = (req.body ?? {}) as {
      id?: number | string | null;
      method?: string;
      params?: Record<string, unknown>;
    };
    const rpcId = rpcBody.id ?? null;

    if (!verifyPaymeBasicAuth(req.headers.authorization, PAYME_SECRET_KEY)) {
      res.json({
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32504, message: 'Insufficient privilege to perform this method.' },
      });
      return;
    }

    const params = rpcBody.params ?? {};
    const method = rpcBody.method;

    const findByPaymeTxId = (txId: string): PaymentOrder | undefined => {
      for (const ord of paymentOrders.values()) {
        if (ord.provider === 'payme' && ord.providerTransId === txId) return ord;
      }
      return undefined;
    };

    if (method === 'CheckPerformTransaction') {
      const account = (params.account ?? {}) as { order_id?: string };
      const order = account.order_id ? paymentOrders.get(String(account.order_id)) : undefined;
      if (!order || order.provider !== 'payme') {
        res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31050, message: 'Order not found' } });
        return;
      }
      if (order.status !== 'pending') {
        res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31051, message: 'Order already processed' } });
        return;
      }
      if (Number(params.amount) !== uzsToTiyin(order.amountUzs)) {
        res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31001, message: 'Invalid amount' } });
        return;
      }
      res.json({ jsonrpc: '2.0', id: rpcId, result: { allow: true } });
      return;
    }

    if (method === 'CreateTransaction') {
      const txId = String(params.id ?? '');
      const existingByTx = findByPaymeTxId(txId);
      if (existingByTx) {
        if (existingByTx.paymeState !== 1) {
          res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31008, message: 'Invalid transaction state' } });
          return;
        }
        res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            create_time: existingByTx.paymeCreateTime ?? Date.now(),
            transaction: existingByTx.id,
            state: existingByTx.paymeState ?? 1,
          },
        });
        return;
      }

      const account = (params.account ?? {}) as { order_id?: string };
      const order = account.order_id ? paymentOrders.get(String(account.order_id)) : undefined;
      if (!order || order.provider !== 'payme') {
        res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31050, message: 'Order not found' } });
        return;
      }
      if (order.status !== 'pending' || (order.providerTransId && order.providerTransId !== txId)) {
        res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31008, message: 'Order unavailable' } });
        return;
      }
      if (Number(params.amount) !== uzsToTiyin(order.amountUzs)) {
        res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31001, message: 'Invalid amount' } });
        return;
      }

      order.providerTransId = txId;
      order.paymeState = 1;
      order.paymeCreateTime = Number(params.time ?? Date.now());
      paymentOrders.set(order.id, order);
      saveStore();

      res.json({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          create_time: order.paymeCreateTime,
          transaction: order.id,
          state: 1,
        },
      });
      return;
    }

    if (method === 'PerformTransaction') {
      const txId = String(params.id ?? '');
      const order = findByPaymeTxId(txId);
      if (!order) {
        res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31003, message: 'Transaction not found' } });
        return;
      }
      if (order.paymeState === 2) {
        res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            transaction: order.id,
            perform_time: order.paymePerformTime ?? Date.now(),
            state: 2,
          },
        });
        return;
      }
      if (order.paymeState !== 1) {
        res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31008, message: 'Cannot perform transaction' } });
        return;
      }
      order.paymeState = 2;
      order.paymePerformTime = Date.now();
      completePaidOrder(order, txId);
      res.json({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          transaction: order.id,
          perform_time: order.paymePerformTime,
          state: 2,
        },
      });
      return;
    }

    if (method === 'CancelTransaction') {
      const txId = String(params.id ?? '');
      const order = findByPaymeTxId(txId);
      if (!order) {
        res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31003, message: 'Transaction not found' } });
        return;
      }
      if (order.paymeState === -1 || order.paymeState === -2) {
        res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            transaction: order.id,
            cancel_time: order.paymeCancelTime ?? Date.now(),
            state: order.paymeState,
          },
        });
        return;
      }
      if (order.paymeState === 2) {
        res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31007, message: 'Cannot cancel completed order' } });
        return;
      }
      order.paymeState = -1;
      order.paymeCancelTime = Date.now();
      order.paymeCancelReason = Number(params.reason ?? 1);
      order.status = 'cancelled';
      paymentOrders.set(order.id, order);
      saveStore();
      res.json({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          transaction: order.id,
          cancel_time: order.paymeCancelTime,
          state: -1,
        },
      });
      return;
    }

    if (method === 'CheckTransaction') {
      const txId = String(params.id ?? '');
      const order = findByPaymeTxId(txId);
      if (!order) {
        res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -31003, message: 'Transaction not found' } });
        return;
      }
      res.json({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          create_time: order.paymeCreateTime ?? 0,
          perform_time: order.paymePerformTime ?? 0,
          cancel_time: order.paymeCancelTime ?? 0,
          transaction: order.id,
          state: order.paymeState ?? 1,
          reason: order.paymeCancelReason ?? null,
        },
      });
      return;
    }

    if (method === 'GetStatement') {
      const from = Number(params.from ?? 0);
      const to = Number(params.to ?? Date.now());
      const transactions = [...paymentOrders.values()]
        .filter(
          (o) =>
            o.provider === 'payme' &&
            o.providerTransId &&
            (o.paymeCreateTime ?? 0) >= from &&
            (o.paymeCreateTime ?? 0) <= to,
        )
        .map((o) => ({
          id: o.providerTransId,
          time: o.paymeCreateTime ?? 0,
          amount: uzsToTiyin(o.amountUzs),
          account: { order_id: o.id },
          create_time: o.paymeCreateTime ?? 0,
          perform_time: o.paymePerformTime ?? 0,
          cancel_time: o.paymeCancelTime ?? 0,
          transaction: o.id,
          state: o.paymeState ?? 1,
          reason: o.paymeCancelReason ?? null,
        }));
      res.json({ jsonrpc: '2.0', id: rpcId, result: { transactions } });
      return;
    }

    res.json({ jsonrpc: '2.0', id: rpcId, error: { code: -32601, message: 'Method not found' } });
  });

  app.post('/api/profile/upgrade-pro', requireAuth, (_req: AuthenticatedRequest, res) => {
    res.status(402).json({
      error: "Iltimos, Click yoki Payme orqali Pro tarif paketini tanlab to'lovni amalga oshiring.",
    });
  });

  const weatherCache = new Map<string, { report: WeatherRiskReport; cachedAt: number }>();

  app.get('/api/weather/risk', async (req, res) => {
    const requestedRegion = typeof req.query.region === 'string' ? req.query.region : 'toshkent';
    const region = UZ_REGIONS.find((r) => r.id === requestedRegion) ?? UZ_REGIONS[0];

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let communityAlertsCount = 0;
    for (const u of users.values()) {
      for (const h of u.history ?? []) {
        if (
          h.healthStatus !== 'healthy' &&
          new Date(h.createdAt).getTime() >= weekAgo
        ) {
          communityAlertsCount += 1;
        }
      }
    }

    const cached = weatherCache.get(region.id);
    if (cached && Date.now() - cached.cachedAt < 15 * 60 * 1000) {
      res.json({
        ...cached.report,
        communityAlertsCount,
      });
      return;
    }

    let temperatureC = region.baselineTemp;
    let humidityPct = region.baselineHumidity;
    let rainProbabilityPct = 20;
    let liveSource = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}&current=temperature_2m,relative_humidity_2m&hourly=precipitation_probability&forecast_days=1`;
      const wxRes = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (wxRes.ok) {
        const wxData = (await wxRes.json()) as {
          current?: { temperature_2m?: number; relative_humidity_2m?: number };
          hourly?: { precipitation_probability?: number[] };
        };
        if (typeof wxData.current?.temperature_2m === 'number') {
          temperatureC = wxData.current.temperature_2m;
          liveSource = true;
        }
        if (typeof wxData.current?.relative_humidity_2m === 'number') {
          humidityPct = wxData.current.relative_humidity_2m;
        }
        const probs = wxData.hourly?.precipitation_probability;
        if (Array.isArray(probs) && probs.length > 0) {
          rainProbabilityPct = Math.max(...probs.slice(0, 12).map((n) => Number(n) || 0));
        }
      }
    } catch {
      // Fallback to deterministic regional baseline
    }

    const report = evaluateWeatherRisk({
      region,
      temperatureC,
      humidityPct,
      rainProbabilityPct,
      communityAlertsCount,
      liveSource,
    });
    weatherCache.set(region.id, { report, cachedAt: Date.now() });
    res.json(report);
  });

  app.post('/api/treatments/start', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { diagnosisId } = req.body as { diagnosisId?: string };
    if (!diagnosisId) {
      res.status(400).json({ error: 'Tashxis ID raqami kerak.' });
      return;
    }
    const diagnosis = (user.history ?? []).find((h) => h.id === diagnosisId);
    if (!diagnosis) {
      res.status(404).json({ error: 'Tashxis topilmadi.' });
      return;
    }

    const plans = user.treatmentPlans ?? [];
    const existing = plans.find((p) => p.diagnosisId === diagnosisId && p.status === 'active');
    if (existing) {
      res.json({ plan: existing, user: toPublicUser(user) });
      return;
    }

    const now = Date.now();
    const plan: TreatmentPlan = {
      id: crypto.randomBytes(6).toString('hex'),
      diagnosisId,
      productName: diagnosis.productName,
      diseaseName: diagnosis.diseaseName,
      createdAt: new Date(now).toISOString(),
      nextCheckAt: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
      intervalDays: 3,
      status: 'active',
      checkInDays: [3, 7],
      followUpDiagnosisId: null,
    };

    user.treatmentPlans = [plan, ...plans].slice(0, 20);
    users.set(user.id, user);
    saveStore();

    if (TELEGRAM_BOT_TOKEN && user.telegramChatId) {
      void telegramApi('sendMessage', {
        chat_id: user.telegramChatId,
        text: `🌱 Davolash nazorati yoqildi!\nO'simlik: ${diagnosis.productName}${diagnosis.diseaseName ? ` (${diagnosis.diseaseName})` : ''}\n\n3 va 7 kundan so'ng bargning yangi rasmini tekshirish uchun eslatma yuboraman.`,
      });
    }

    res.json({ plan, user: toPublicUser(user) });
  });

  app.post('/api/consultations', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { diagnosisId, note } = req.body as { diagnosisId?: string; note?: string };
    if (!diagnosisId) {
      res.status(400).json({ error: 'Tashxis ID raqami kerak.' });
      return;
    }
    const diagnosis = (user.history ?? []).find((h) => h.id === diagnosisId);
    if (!diagnosis) {
      res.status(404).json({ error: 'Tashxis topilmadi.' });
      return;
    }

    const cleanNote = typeof note === 'string' ? note.trim().slice(0, 300) : '';
    const consultation: ConsultationRequest = {
      id: crypto.randomBytes(6).toString('hex'),
      diagnosisId,
      productName: diagnosis.productName,
      diseaseName: diagnosis.diseaseName,
      note: cleanNote || "Qo'shimcha izoh kiritilmadi",
      createdAt: new Date().toISOString(),
      status: 'pending',
      agronomistName: "Rustamjon Xoliqov · Agronom",
      agronomistResponse: null,
    };

    user.consultations = [consultation, ...(user.consultations ?? [])].slice(0, 20);
    users.set(user.id, user);
    saveStore();

    if (TELEGRAM_BOT_TOKEN && user.telegramChatId) {
      void telegramApi('sendMessage', {
        chat_id: user.telegramChatId,
        text: `👨‍🌾 So'rovingiz agronomga yuborildi!\nO'simlik: ${diagnosis.productName}\nMutaxassis: ${consultation.agronomistName}\nTasdiqlangan javob tayyor bo'lishi bilan shu botda xabar beramiz.`,
      });
    }

    res.json({ consultation, user: toPublicUser(user) });
  });

  app.post('/api/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { itemType, itemName, quantityLabel, region, phone } = req.body as {
      itemType?: 'preparation' | 'seedling';
      itemName?: string;
      quantityLabel?: string;
      region?: string;
      phone?: string;
    };

    const cleanItem = typeof itemName === 'string' ? itemName.trim().slice(0, 100) : '';
    const cleanQty = typeof quantityLabel === 'string' ? quantityLabel.trim().slice(0, 60) : '';
    const cleanRegion = typeof region === 'string' ? region.trim().slice(0, 80) : '';
    if (!cleanItem || !cleanRegion) {
      res.status(400).json({ error: "Mahsulot nomi va hududni kiriting." });
      return;
    }

    const normalizedPhone = phone ? normalizeUzbekPhone(phone) : user.phone;
    if (!normalizedPhone) {
      res.status(400).json({ error: "Faqat O'zbekiston (+998) telefon raqami qabul qilinadi." });
      return;
    }

    const order: AgroOrder = {
      id: crypto.randomBytes(6).toString('hex'),
      itemType: itemType === 'seedling' ? 'seedling' : 'preparation',
      itemName: cleanItem,
      quantityLabel: cleanQty || '1 dona',
      region: cleanRegion,
      phone: normalizedPhone,
      createdAt: new Date().toISOString(),
      status: 'submitted',
    };

    user.orders = [order, ...(user.orders ?? [])].slice(0, 20);
    users.set(user.id, user);
    saveStore();

    if (TELEGRAM_BOT_TOKEN && user.telegramChatId) {
      void telegramApi('sendMessage', {
        chat_id: user.telegramChatId,
        text: `📦 Buyurtmangiz qabul qilindi!\nMahsulot: ${order.itemName} (${order.quantityLabel})\nHudud: ${order.region}\nHamkor agro-do'kon operatorimiz ${order.phone} raqamingizga bog'lanadi.`,
      });
    }

    res.json({ order, user: toPublicUser(user) });
  });

  app.post('/api/diagnose', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const quota = canPerformScan({ scanLimit: user.scanLimit, scansUsed: user.scansUsed });
    if (!quota.allowed) {
      res.status(403).json({
        code: 'LIMIT_REACHED',
        error: "Tekshiruv limitingiz tugadi (10/10). Limitni oshirish uchun Pro versiyaga o'ting.",
      });
      return;
    }

    const { imageBase64, mimeType, parentDiagnosisId } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      parentDiagnosisId?: string;
    };

    const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!mimeType || !allowedMimes.has(mimeType)) {
      res.status(400).json({ error: "Iltimos, JPG, PNG yoki WEBP formatidagi rasm yuklang." });
      return;
    }

    if (typeof imageBase64 !== 'string' || imageBase64.length < 50 || imageBase64.length > 10_000_000) {
      res.status(400).json({ error: "Rasm ma'lumoti noto'g'ri yoki hajmi juda katta." });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: "Gemini API kaliti sozlanmagan. Iltimos, Settings > Secrets bo'limida GEMINI_API_KEY ni kiriting.",
      });
      return;
    }

    try {
      const imagePart = {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      };

      // Stage B: ultra-lightweight topic gate (gemini-3.1-flash-lite) before heavy schema diagnosis
      // Keeps AI load minimal and preserves user quota on off-topic uploads.
      try {
        const topicGateRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: {
            parts: [
              imagePart,
              {
                text: "Rasmda ko'chat, gul, barg, daraxt, xona/bog' o'simligi, meva, sabzavot, ekin yoki tuproqdagi nihol bormi? Agar shularning birortasi bo'lsa isPlantOrAgro: true. Agar odam, hujjat, ekran, mashina, bino, hayvon, uy jihozi yoki boshqa agro mavzudan tashqari tasvir bo'lsa isPlantOrAgro: false va detectedSubjectUz ga 1-3 so'zda nima ko'ringanini yozing (o'zbek lotin alifbosida).",
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isPlantOrAgro: { type: Type.BOOLEAN },
                detectedSubjectUz: { type: Type.STRING },
              },
              required: ['isPlantOrAgro'],
            },
          },
        });

        const parsedGate = parseLightTopicGateJson(topicGateRes.text ?? '');
        if (parsedGate && !parsedGate.isPlantOrAgro) {
          const gateDecision = evaluateTopicGateResponse({
            isPlantOrAgro: false,
            detectedSubject: parsedGate.detectedSubjectUz,
          });
          const remainingScans = Math.max(0, user.scanLimit - user.scansUsed);
          res.status(gateDecision.httpStatus).json({
            code: gateDecision.code,
            error: gateDecision.message,
            detectedSubject: gateDecision.detectedSubject,
            limitPreserved: true,
            remainingScans,
            scanLimit: user.scanLimit,
          });
          return;
        }
      } catch (gateErr) {
        const gateMsg = gateErr instanceof Error ? gateErr.message : '';
        console.warn('Lightweight topic gate skipped:', gateMsg.slice(0, 140));
      }

      const contents = {
        parts: [
          imagePart,
          {
            text: "Ushbu rasmni diqqat bilan tahlil qiling. Agar rasmda ko'chat, gul, o'simlik, barg, meva yoki agro mahsulot bo'lsa: uning nomini, hozirgi ahvolini, unda kasallik yoki zararkunanda bor-yo'qligini aniqlang. Agar kasal bo'lsa, aniq nima qilish kerakligini bosqichma-bosqich yozing va rasmdagi zararlangan/kasallik sezilgan aniq nuqtalarni `affectedSpots` massivida foiz koordinatalari bilan (xPercent: 0..100 chapdan o'ngga, yPercent: 0..100 tepadan pastga, max 3 ta nuqta) ko'rsating. Agar sog'lom bo'lsa, `affectedSpots` bo'sh massiv [] bo'lsin va dehqon/bog'bonga iliq motivatsiya bering. Agar rasmda umuman o'simlik/gul/ko'chat/meva bo'lmasa isPlantOrAgro ni false qiling. Barcha javoblar faqat o'zbek tilida (lotin alifbosida) bo'lsin.",
          },
        ],
      };

      const baseConfig = {
        systemInstruction:
          "Siz tajribali o'zbekistonlik agronom va o'simliklar himoyasi mutaxassisisiz. Javobingiz aniq, amaliy, tushunarli va do'stona bo'lsin.",
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isPlantOrAgro: {
              type: Type.BOOLEAN,
              description: "Rasmda ko'chat, o'simlik, meva, sabzavot yoki agro mahsulot bormi?",
            },
            productName: {
              type: Type.STRING,
              description: "O'simlik, ko'chat yoki agro mahsulot nomi (o'zbek tilida).",
            },
            healthStatus: {
              type: Type.STRING,
              description: "Faqat bittasi: healthy, diseased, yoki attention",
            },
            recommendedClass: {
              type: Type.STRING,
              description: "Faqat bittasi: fungicide, insecticide, bactericide, nutrient, yoki none",
            },
            conditionSummary: {
              type: Type.STRING,
              description: "Hozirgi ahvoli haqida 2-3 jumlalik aniq xulosa.",
            },
            diseaseName: {
              type: Type.STRING,
              description: "Aniqlangan kasallik yoki zararkunanda nomi; agar sog'lom bo'lsa bo'sh satr.",
            },
            affectedSpots: {
              type: Type.ARRAY,
              description: "Rasmdagi zararlangan yoki kasallik alomati bor aniq nuqtalar (sog'lom bo'lsa bo'sh).",
              items: {
                type: Type.OBJECT,
                properties: {
                  label: {
                    type: Type.STRING,
                    description: "Zararlangan nuqtaning qisqa nomi (2-4 so'z, o'zbek tilida).",
                  },
                  xPercent: {
                    type: Type.NUMBER,
                    description: "Gorizontal koordinata 0 dan 100 gacha (chapdan o'ngga foiz).",
                  },
                  yPercent: {
                    type: Type.NUMBER,
                    description: "Vertikal koordinata 0 dan 100 gacha (tepadan pastga foiz).",
                  },
                  severity: {
                    type: Type.STRING,
                    description: "high yoki medium",
                  },
                },
                required: ['label', 'xPercent', 'yPercent', 'severity'],
              },
            },
            treatmentSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Kasal bo'lsa nima qilish kerakligi haqida aniq 3-4 ta amaliy qadam.",
            },
            preventionTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Kasallikni oldini olish va parvarish bo'yicha 2-3 ta tavsiya.",
            },
            motivationMessage: {
              type: Type.STRING,
              description: "Agar sog'lom bo'lsa yaxshi motivatsiya, kasal bo'lsa dalda beruvchi iliq so'z.",
            },
          },
          required: [
            'isPlantOrAgro',
            'productName',
            'healthStatus',
            'recommendedClass',
            'conditionSummary',
            'diseaseName',
            'affectedSpots',
            'treatmentSteps',
            'preventionTips',
            'motivationMessage',
          ],
        },
      };

      const attempts: Array<{ model: string; useLowThinking: boolean }> = [
        { model: 'gemini-4-hydrogen', useLowThinking: true },
        { model: 'gemini-3.1-flash-lite', useLowThinking: false },
        { model: 'gemini-4-hydrogen', useLowThinking: true },
        { model: 'gemini-3.1-flash-lite', useLowThinking: false },
      ];

      let response;
      for (let i = 0; i < attempts.length; i++) {
        const current = attempts[i];
        try {
          response = await ai.models.generateContent({
            model: current.model,
            contents,
            config: current.useLowThinking
              ? { ...baseConfig, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : baseConfig,
          });
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          console.warn(`Gemini attempt ${i + 1} (${current.model}) failed:`, msg.slice(0, 180));
          const isTransient =
            msg.includes('503') ||
            msg.includes('UNAVAILABLE') ||
            msg.includes('429') ||
            msg.includes('500') ||
            msg.includes('404');
          if (!isTransient || i === attempts.length - 1) {
            throw err;
          }
          await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)));
        }
      }

      const rawText = (response?.text ?? '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(rawText) as {
        isPlantOrAgro?: boolean;
        productName?: string;
        healthStatus?: string;
        recommendedClass?: string;
        conditionSummary?: string;
        diseaseName?: string;
        affectedSpots?: Array<{
          label?: string;
          xPercent?: number;
          yPercent?: number;
          severity?: string;
        }>;
        treatmentSteps?: string[];
        preventionTips?: string[];
        motivationMessage?: string;
      };

      const gateFallback = evaluateTopicGateResponse({
        isPlantOrAgro: parsed.isPlantOrAgro !== false,
        detectedSubject: parsed.productName,
      });
      if (!gateFallback.allowed) {
        const remainingScans = Math.max(0, user.scanLimit - user.scansUsed);
        res.status(gateFallback.httpStatus).json({
          code: gateFallback.code,
          error: gateFallback.message,
          detectedSubject: gateFallback.detectedSubject,
          limitPreserved: true,
          remainingScans,
          scanLimit: user.scanLimit,
        });
        return;
      }

      const normalizedStatus: DiagnosisRecord['healthStatus'] =
        parsed.healthStatus === 'diseased'
          ? 'diseased'
          : parsed.healthStatus === 'attention'
            ? 'attention'
            : 'healthy';

      const validClasses = new Set<RecommendedClass>([
        'fungicide',
        'insecticide',
        'bactericide',
        'nutrient',
        'none',
      ]);
      const recommendedClass: RecommendedClass = validClasses.has(
        parsed.recommendedClass as RecommendedClass,
      )
        ? (parsed.recommendedClass as RecommendedClass)
        : 'none';

      const affectedSpots =
        normalizedStatus === 'healthy' ? [] : normalizeAffectedSpots(parsed.affectedSpots);

      const diagId = crypto.randomBytes(6).toString('hex');
      const savedImageUrl = saveDiagnosisImage(diagId, mimeType, imageBase64);

      const diagnosis: DiagnosisRecord = {
        id: diagId,
        createdAt: new Date().toISOString(),
        productName: parsed.productName || "Noma'lum o'simlik",
        isPlantOrAgro: true,
        healthStatus: normalizedStatus,
        recommendedClass,
        conditionSummary: parsed.conditionSummary || "Tahlil yakunlandi.",
        diseaseName: parsed.diseaseName && parsed.diseaseName.trim() ? parsed.diseaseName.trim() : null,
        affectedSpots,
        treatmentSteps: Array.isArray(parsed.treatmentSteps) ? parsed.treatmentSteps : [],
        preventionTips: Array.isArray(parsed.preventionTips) ? parsed.preventionTips : [],
        motivationMessage:
          parsed.motivationMessage ||
          "Mehnatlaringiz samarasi albatta ko'rinadi — bog'ingiz doimo yashnasin!",
        imagePreview: savedImageUrl,
        parentDiagnosisId: typeof parentDiagnosisId === 'string' && parentDiagnosisId ? parentDiagnosisId : null,
      };

      if (shouldChargeScanQuota({ isPlantOrAgro: diagnosis.isPlantOrAgro, diagnosisSucceeded: true })) {
        user.scansUsed += 1;
      }
      user.history = [diagnosis, ...user.history].slice(0, 20);
      if (parentDiagnosisId && Array.isArray(user.treatmentPlans)) {
        user.treatmentPlans = user.treatmentPlans.map((plan) =>
          plan.diagnosisId === parentDiagnosisId
            ? {
                ...plan,
                followUpDiagnosisId: diagnosis.id,
                status: normalizedStatus === 'healthy' ? 'completed' : plan.status,
              }
            : plan,
        );
      }
      users.set(user.id, user);
      saveStore();

      res.json({
        diagnosis: toPublicDiagnosis(diagnosis),
        user: toPublicUser(user),
      });
    } catch (err) {
      console.error('Gemini diagnosis error:', err);
      const rawMsg = err instanceof Error ? err.message : '';
      if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE')) {
        res.status(503).json({
          error: "AI xizmati hozir juda band. Bir necha soniyadan so'ng qayta urinib ko'ring.",
        });
        return;
      }
      res.status(502).json({
        error: "Rasmni tahlil qilishda vaqtinchalik xatolik yuz berdi. Qayta urinib ko'ring.",
      });
    }
  });

  app.post('/api/diagnoses/:id/chat', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const diagId = req.params.id;
    const diagnosis = (user.history ?? []).find((h) => h.id === diagId);
    if (!diagnosis) {
      res.status(404).json({ error: 'Tashxis topilmadi.' });
      return;
    }

    const cleanMessage = sanitizeChatMessageText((req.body as { message?: unknown })?.message);
    if (!cleanMessage) {
      res.status(400).json({ error: 'Iltimos, savolingizni kiriting.' });
      return;
    }

    const existingMessages = diagnosis.chatMessages ?? [];
    const userMessageCount = existingMessages.filter((m) => m.role === 'user').length;
    const quota = canSendChatMessage({ plan: user.plan, userMessageCount });
    if (!quota.allowed) {
      res.status(403).json({
        code: 'CHAT_LIMIT_REACHED',
        error: "Bepul tarifda ushbu tashxis bo'yicha 5 ta savol limiti tugadi. Cheksiz suhbat uchun Pro versiyaga o'ting.",
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: "Gemini API kaliti sozlanmagan.",
      });
      return;
    }

    try {
      const historyContents = existingMessages.slice(-12).map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.text }],
      }));
      historyContents.push({
        role: 'user' as const,
        parts: [{ text: cleanMessage }],
      });

      const systemInstruction = buildDiagnosisChatContextPrompt(diagnosis);
      const attempts: Array<{ model: string; useLowThinking: boolean }> = [
        { model: 'gemini-4-hydrogen', useLowThinking: true },
        { model: 'gemini-3.1-flash-lite', useLowThinking: false },
        { model: 'gemini-4-hydrogen', useLowThinking: true },
        { model: 'gemini-3.1-flash-lite', useLowThinking: false },
      ];

      let response;
      for (let i = 0; i < attempts.length; i++) {
        const current = attempts[i];
        try {
          response = await ai.models.generateContent({
            model: current.model,
            contents: historyContents,
            config: current.useLowThinking
              ? { systemInstruction, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : { systemInstruction },
          });
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          const status = (err as { status?: number })?.status;
          console.warn(
            `Gemini chat attempt ${i + 1} (${current.model}, status=${status ?? 'n/a'}) failed:`,
            msg.slice(0, 180),
          );
          const isTransient =
            status === 503 ||
            status === 429 ||
            status === 500 ||
            status === 404 ||
            msg.includes('503') ||
            msg.includes('UNAVAILABLE') ||
            msg.includes('429') ||
            msg.includes('RESOURCE_EXHAUSTED') ||
            msg.includes('500') ||
            msg.includes('404');
          if (!isTransient || i === attempts.length - 1) {
            throw err;
          }
          await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)));
        }
      }

      const replyText = (response?.text ?? '').trim();
      if (!replyText) {
        res.status(502).json({ error: "AI javob qaytara olmadi. Qayta urinib ko'ring." });
        return;
      }

      const now = Date.now();
      const userMsg: DiagnosisChatMessage = {
        id: crypto.randomBytes(6).toString('hex'),
        role: 'user',
        text: cleanMessage,
        createdAt: new Date(now).toISOString(),
      };
      const assistantMsg: DiagnosisChatMessage = {
        id: crypto.randomBytes(6).toString('hex'),
        role: 'assistant',
        text: replyText,
        createdAt: new Date(now + 1).toISOString(),
      };

      diagnosis.chatMessages = [...existingMessages, userMsg, assistantMsg].slice(-40);
      users.set(user.id, user);
      saveStore();

      res.json({
        message: assistantMsg,
        diagnosis: toPublicDiagnosis(diagnosis),
        user: toPublicUser(user),
      });
    } catch (err) {
      console.error('Gemini chat error:', err);
      const rawMsg = err instanceof Error ? err.message : '';
      const status = (err as { status?: number })?.status;
      if (
        status === 503 ||
        status === 429 ||
        rawMsg.includes('503') ||
        rawMsg.includes('UNAVAILABLE') ||
        rawMsg.includes('429') ||
        rawMsg.includes('RESOURCE_EXHAUSTED')
      ) {
        res.status(503).json({
          error: "AI agronom hozir band. Bir necha soniyadan so'ng qayta urinib ko'ring.",
        });
        return;
      }
      res.status(502).json({
        error: "Javob olishda vaqtinchalik xatolik yuz berdi. Qayta urinib ko'ring.",
      });
    }
  });

  app.get('/api/diagnoses/:id/image', requireAuth, (req: AuthenticatedRequest, res) => {
    const diagId = req.params.id;
    const item = (req.user!.history ?? []).find((h) => h.id === diagId);
    if (!item) {
      res.status(404).end();
      return;
    }

    const diskFile = findDiagnosisImageFile(diagId);
    if (diskFile) {
      res.setHeader('Content-Type', diskFile.mimeType);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.sendFile(diskFile.filePath);
      return;
    }

    if (item.imagePreview && item.imagePreview.startsWith('data:')) {
      const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(item.imagePreview);
      if (match) {
        res.setHeader('Content-Type', match[1]);
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.send(Buffer.from(match[2], 'base64'));
        return;
      }
    }

    res.status(404).end();
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    if (hmrDisabled) {
      app.get('/@vite/client', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
  }
  sheetsMap.delete(id);
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (!url || (url[0] !== '.' && url[0] !== '/')) return url;
  const pathname = url.replace(/[?#].*$/, '');
  const parsed = new URL(url, 'http://vite.dev');
  return \`\${pathname}?\${queryToInject}\${parsed.search ? '&' + parsed.search.slice(1) : ''}\${parsed.hash || ''}\`;
}
export class ErrorOverlay {}
`);
      });
    }

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  startTelegramPolling();

  if (TELEGRAM_BOT_TOKEN) {
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const user of users.values()) {
        if (!user.telegramChatId || !Array.isArray(user.treatmentPlans)) continue;
        for (const plan of user.treatmentPlans) {
          if (plan.status !== 'active') continue;
          const dueMs = new Date(plan.nextCheckAt).getTime();
          if (Number.isFinite(dueMs) && dueMs <= now) {
            void telegramApi('sendMessage', {
              chat_id: user.telegramChatId,
              text: `🔔 Qayta tekshiruv vaqti keldi!\nO'simlik: ${plan.productName}\nDavolash samarasini ko'rish uchun Sog'lom Ko'chat ilovasida bargning yangi rasmini tekshiring.`,
            });
            plan.nextCheckAt = new Date(now + 4 * 24 * 60 * 60 * 1000).toISOString();
            changed = true;
          }
        }
      }
      if (changed) saveStore();
    }, 5 * 60 * 1000);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Sog'lom Ko'chat server running on http://0.0.0.0:${PORT}`);
  });
}

createAppServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
