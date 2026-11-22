#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(ROOT_DIR, 'catalog');
const CURATED_JSON_PATH = path.join(CATALOG_DIR, 'curated-stations.json');
const STATIONS_JSON_PATH = path.join(CATALOG_DIR, 'stations.json');
const REPORT_MD_PATH = path.join(CATALOG_DIR, 'report.md');

const RADIO_BROWSER_MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://fr1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];

const USER_AGENT = 'IslamicRadio/2.0';
const PROBE_CONCURRENCY = 20;
const PROBE_TIMEOUT_MS = 8000;
const MIN_STREAM_BYTES = 1024;
const TARGET_MIN_STATIONS = 120;
const TARGET_MAX_STATIONS = 220;
const MAX_PER_COUNTRY = 12;
const MAX_RECITER_STATIONS = 70;

// mp3quran.net publishes ~170 24/7 single-reciter radio channels (HTTPS, MP3)
const MP3QURAN_RADIOS_API = 'https://mp3quran.net/api/v3/radios';

// Well-known reciters get priority when trimming the reciter channel list
const FAMOUS_RECITERS = [
  'alafasi', 'afasy', 'sudais', 'shuraim', 'minshawi', 'husary', 'hussary', 'abdulbasit',
  'abdul basit', 'abdelbasset', 'maher', 'muaiqly', 'ghamdi', 'ajmi', 'ajamy', 'dosari',
  'dossari', 'huthaifi', 'hudhaifi', 'shatri', 'basfar', 'ayyub', 'ayoub', 'tablawi',
  'mustafa ismail', 'jibreel', 'jebril', 'qatami', 'qahtani', 'banna', 'ibrahim al-akhdar',
  'akhdar', 'rifai', 'juhany', 'juhani', 'ali jaber', 'yasser', 'idrees abkar', 'abkar',
  'nasser al qatami', 'fares abbad', 'shaatree', 'hani ar-rifai', 'salah bukhatir',
  'bukhatir', 'khalid al-jalil', 'jaleel', 'mansour al-salimi', 'raad al kurdi',
  'العفاسي', 'السديس', 'الشريم', 'المنشاوي', 'الحصري', 'عبدالباسط', 'عبد الباسط',
  'المعيقلي', 'الغامدي', 'العجمي', 'الدوسري', 'الحذيفي', 'الشاطري', 'بصفر', 'أيوب',
  'الطبلاوي', 'مصطفى إسماعيل', 'جبريل', 'القطامي', 'البنا', 'الأخضر', 'الرفاعي',
  'الجهني', 'علي جابر', 'أبكر', 'عباد', 'بخاطر', 'الجليل', 'السالمي', 'الكردي',
];

// Thematic mp3quran channels that are lectures / adhkar rather than recitation
const MP3QURAN_THEMATIC_RE =
  /(tafsir|tafseer|seerah|siyra|sira|athkar|adhkar|azkar|ruqyah|roqya|fatwa|fatawa|hadith|stories|qasas|تفسير|السيرة|سيرة|أذكار|اذكار|الرقية|رقية|فتاوى|فتاوي|حديث|قصص|دروس)/i;

const ISLAMIC_COUNTRIES = [
  'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'YE',
  'EG', 'JO', 'PS', 'LB', 'SY', 'IQ',
  'MA', 'TN', 'DZ', 'LY', 'SD', 'MR',
  'TR', 'PK', 'MY', 'ID', 'BD',
  'US', 'GB', 'CA', 'FR', 'DE', 'NL', 'BE', 'SE', 'ZA', 'NG', 'AU',
];

const FLAGSHIP_NAME_QUERIES = [
  'quran', 'koran', 'coran', 'قرآن', 'القرآن', 'islam', 'islamic', 'إسلام', 'muslim',
  'sunnah', 'السنة', 'nasheed', 'anasheed', 'أناشيد', 'اناشيد', 'makkah', 'mecca', 'مكة',
  'madinah', 'medina', 'المدينة', 'hadith', 'tafsir', 'dawah', 'iqra', 'noor', 'نور',
];

const COUNTRY_META = {
  SA: { code: 'SA', name: 'Saudi Arabia', nameAr: 'السعودية', flag: '🇸🇦' },
  AE: { code: 'AE', name: 'United Arab Emirates', nameAr: 'الإمارات', flag: '🇦🇪' },
  KW: { code: 'KW', name: 'Kuwait', nameAr: 'الكويت', flag: '🇰🇼' },
  QA: { code: 'QA', name: 'Qatar', nameAr: 'قطر', flag: '🇶🇦' },
  BH: { code: 'BH', name: 'Bahrain', nameAr: 'البحرين', flag: '🇧🇭' },
  OM: { code: 'OM', name: 'Oman', nameAr: 'عُمان', flag: '🇴🇲' },
  YE: { code: 'YE', name: 'Yemen', nameAr: 'اليمن', flag: '🇾🇪' },
  EG: { code: 'EG', name: 'Egypt', nameAr: 'مصر', flag: '🇪🇬' },
  JO: { code: 'JO', name: 'Jordan', nameAr: 'الأردن', flag: '🇯🇴' },
  PS: { code: 'PS', name: 'Palestine', nameAr: 'فلسطين', flag: '🇵🇸' },
  LB: { code: 'LB', name: 'Lebanon', nameAr: 'لبنان', flag: '🇱🇧' },
  SY: { code: 'SY', name: 'Syria', nameAr: 'سوريا', flag: '🇸🇾' },
  IQ: { code: 'IQ', name: 'Iraq', nameAr: 'العراق', flag: '🇮🇶' },
  MA: { code: 'MA', name: 'Morocco', nameAr: 'المغرب', flag: '🇲🇦' },
  TN: { code: 'TN', name: 'Tunisia', nameAr: 'تونس', flag: '🇹🇳' },
  DZ: { code: 'DZ', name: 'Algeria', nameAr: 'الجزائر', flag: '🇩🇿' },
  LY: { code: 'LY', name: 'Libya', nameAr: 'ليبيا', flag: '🇱🇾' },
  SD: { code: 'SD', name: 'Sudan', nameAr: 'السودان', flag: '🇸🇩' },
  MR: { code: 'MR', name: 'Mauritania', nameAr: 'موريتانيا', flag: '🇲🇷' },
  SO: { code: 'SO', name: 'Somalia', nameAr: 'الصومال', flag: '🇸🇴' },
  TR: { code: 'TR', name: 'Türkiye', nameAr: 'تركيا', flag: '🇹🇷' },
  PK: { code: 'PK', name: 'Pakistan', nameAr: 'باكستان', flag: '🇵🇰' },
  BD: { code: 'BD', name: 'Bangladesh', nameAr: 'بنغلاديش', flag: '🇧🇩' },
  MY: { code: 'MY', name: 'Malaysia', nameAr: 'ماليزيا', flag: '🇲🇾' },
  ID: { code: 'ID', name: 'Indonesia', nameAr: 'إندونيسيا', flag: '🇮🇩' },
  US: { code: 'US', name: 'United States', nameAr: 'الولايات المتحدة', flag: '🇺🇸' },
  CA: { code: 'CA', name: 'Canada', nameAr: 'كندا', flag: '🇨🇦' },
  GB: { code: 'GB', name: 'United Kingdom', nameAr: 'المملكة المتحدة', flag: '🇬🇧' },
  FR: { code: 'FR', name: 'France', nameAr: 'فرنسا', flag: '🇫🇷' },
  DE: { code: 'DE', name: 'Germany', nameAr: 'ألمانيا', flag: '🇩🇪' },
  NL: { code: 'NL', name: 'Netherlands', nameAr: 'هولندا', flag: '🇳🇱' },
  BE: { code: 'BE', name: 'Belgium', nameAr: 'بلجيكا', flag: '🇧🇪' },
  SE: { code: 'SE', name: 'Sweden', nameAr: 'السويد', flag: '🇸🇪' },
  ZA: { code: 'ZA', name: 'South Africa', nameAr: 'جنوب أفريقيا', flag: '🇿🇦' },
  NG: { code: 'NG', name: 'Nigeria', nameAr: 'نيجيريا', flag: '🇳🇬' },
  AU: { code: 'AU', name: 'Australia', nameAr: 'أستراليا', flag: '🇦🇺' },
  INTL: { code: 'INTL', name: 'Worldwide', nameAr: 'عالمي', flag: '🌍' },
};

const CATEGORIES = [
  { id: 'quran', label: 'Holy Quran Radio', labelAr: 'إذاعات القرآن الكريم' },
  { id: 'reciters', label: 'Reciters 24/7', labelAr: 'القراء' },
  { id: 'lectures', label: 'Lectures & Tafsir', labelAr: 'دروس وتفسير' },
  { id: 'nasheed', label: 'Nasheeds', labelAr: 'أناشيد' },
  { id: 'world', label: 'Islamic Radio Worldwide', labelAr: 'إذاعات إسلامية حول العالم' },
];

const ARABIC_SCRIPT_RE = /[\u0600-\u06FF]/;

// A station must match at least one of these to be considered Islamic
const ISLAMIC_KEYWORDS_RE =
  /(quran|qur'an|qur’an|koran|coran|kuran|kur'an|islam(?!abad)|muslim|moslem|sunnah|sunna|hadith|tafsir|tafseer|seerah|nasheed|nashid|anasheed|nasyid|dawah|da'wah|dakwah|masjid|mosque|ramadan|ramadhan|ilahi|adhan|azan|athan|tilawat|tilawah|recitation|deen|iman|imaan|tawheed|salafi|ilm|ummah|qasida|naat|zikr|dhikr|athkar|adhkar|azkar|ruqyah|قرآن|القرآن|القران|إسلام|اسلام|إسلامية|اسلامية|السنة|سنة|حديث|تفسير|السيرة|أناشيد|اناشيد|نشيد|مكة|المدينة|المسجد|تلاوة|تلاوات|ترتيل|تراتيل|القارئ|أذكار|اذكار|رقية|فتاوى|دعوة|الايمان|الإيمان)/i;

// Never include these (non-Islamic matches, political/militant, or off-topic)
const EXCLUDE_KEYWORDS_RE =
  /(christian|church|gospel|jesus|bible|catholic|evangel|kirche|église|eglise|hindu|bhajan|sikh|gurbani|jewish|torah|buddh|المقاومة|resistance|jihad|حزب|militia|metal|rock|techno|dance|club|hits|pop music|love songs|bollywood|tarab|andalou|amazigh|berber|hamedina|film music|humor|politics)/i;

const SUPPORTED_CODECS = new Set(['MP3', 'AAC', 'AAC+', 'MP4', 'HLS']);
const BLOCKED_CODECS = new Set(['OGG', 'OPUS', 'WMA', 'FLAC']);

const EPHEMERAL_URL_RE =
  /(surfernetwork\.com|[?&](zt|token|exp|expires|sig|signature|hdnea|auth|rj-tok|rj-ttl)=|chunklist_w\d+)/i;

const ZENO_URL_RE = /^https?:\/\/(?:stream-\d+|node-\d+|stream)\.zeno\.fm\/([a-z0-9]+)(?:[/?].*)?$/i;

function normalizeZenoUrl(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  const match = trimmed.match(ZENO_URL_RE);
  if (match) {
    return `https://stream.zeno.fm/${match[1]}`;
  }
  return trimmed;
}

async function fetchJsonWithMirror(pathAndQuery) {
  let lastErr;
  for (const base of RADIO_BROWSER_MIRRORS) {
    const url = `${base}${pathAndQuery}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} from ${url}`);
          continue;
        }
        return await res.json();
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
      }
    }
  }
  throw lastErr ?? new Error(`All mirrors failed for ${pathAndQuery}`);
}

function normalizeUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = normalizeZenoUrl(raw.trim());
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:') return null;
    u.hostname = u.hostname.toLowerCase();
    const normalizedPath = u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${u.host}${normalizedPath}${u.search}`;
  } catch {
    return null;
  }
}

function selectCandidateUrls(raw) {
  const candidates = [];
  for (const field of [raw.url, raw.url_resolved]) {
    if (!field || typeof field !== 'string') continue;
    const cleaned = normalizeZenoUrl(field.trim());
    if (!cleaned) continue;
    if (cleaned.startsWith('https://') && !EPHEMERAL_URL_RE.test(cleaned)) {
      candidates.push(cleaned);
    } else if (cleaned.startsWith('http://') && !EPHEMERAL_URL_RE.test(cleaned)) {
      candidates.push(cleaned.replace(/^http:\/\//i, 'https://'));
    }
  }
  return Array.from(new Set(candidates));
}

function cleanStationName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[\r\n\t\u00A0]+/g, ' ')
    .replace(/^(?:[A-Z]{2}|AR)\s*[:\-–]+\s*/i, '')
    .replace(/^[\s.\-|:•_*#]+|[\s\-|:•_*#]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (s.length > 90) {
    s = `${s.slice(0, 87).trim()}...`;
  }
  return s;
}

function slugify(str) {
  const ascii = str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || 'station';
}

function normalizeNameForDedup(name) {
  return cleanStationName(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function isIslamicRelevant(station) {
  const urlStr = `${station.url || ''} ${station.url_resolved || ''}`.toLowerCase();
  const combinedText = `${station.name || ''} ${station.tags || ''} ${urlStr}`.toLowerCase();
  if (EXCLUDE_KEYWORDS_RE.test(combinedText)) {
    return false;
  }
  return ISLAMIC_KEYWORDS_RE.test(combinedText);
}

function prefilterCandidate(raw) {
  const urlCandidates = selectCandidateUrls(raw);
  if (urlCandidates.length === 0) {
    return { ok: false, reason: 'non-https-or-ephemeral' };
  }

  if (!isIslamicRelevant(raw)) {
    return { ok: false, reason: 'non-islamic' };
  }

  const codec = (raw.codec || '').trim().toUpperCase();
  const isHlsHint = raw.hls === 1 || urlCandidates.some((u) => /\.m3u8(\?|$)/i.test(u));

  if (BLOCKED_CODECS.has(codec) && !isHlsHint) {
    return { ok: false, reason: `blocked-codec:${codec}` };
  }

  if (codec && codec !== 'UNKNOWN' && !SUPPORTED_CODECS.has(codec) && !isHlsHint) {
    return { ok: false, reason: `unsupported-codec:${codec}` };
  }

  const name = cleanStationName(raw.name);
  if (!name || name.length < 2) {
    return { ok: false, reason: 'empty-name' };
  }

  return { ok: true, urlCandidates };
}

function inferCodecFromContentType(contentType, fallbackCodec, isHls) {
  if (isHls) return 'HLS';
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('mpegurl') || ct.includes('m3u')) return 'HLS';
  if (ct.includes('aacp')) return 'AAC+';
  if (ct.includes('aac')) return 'AAC';
  if (ct.includes('mp4')) return 'MP4';
  if (ct.includes('mpeg') || ct.includes('mp3')) return 'MP3';
  const fb = (fallbackCodec || '').toUpperCase();
  if (SUPPORTED_CODECS.has(fb)) return fb;
  return 'MP3';
}

function extractFirstHlsEntry(manifestText, baseUrl) {
  const lines = manifestText.split(/\r?\n/).map((l) => l.trim());
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    try {
      return new URL(line, baseUrl).toString();
    } catch {
      return null;
    }
  }
  return null;
}

async function verifyHlsVariant(variantUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(variantUrl, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) return false;
    if (!res.url.startsWith('https://')) return false;
    const text = await res.text();
    return text.trimStart().startsWith('#EXTM3U');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function chooseDurableStreamUrl(originalUrl, finalUrl) {
  const normalizedOriginal = normalizeZenoUrl(originalUrl);
  if (!finalUrl || !finalUrl.startsWith('https://')) return normalizedOriginal;
  if (EPHEMERAL_URL_RE.test(finalUrl)) {
    return normalizedOriginal;
  }
  return normalizeZenoUrl(finalUrl);
}

async function probeStream(url, fallbackCodec = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const start = Date.now();
  let reader;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Icy-MetaData': '1',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, reason: `http-${res.status}` };
    }

    const finalUrl = res.url || url;
    if (!finalUrl.startsWith('https://')) {
      return { ok: false, reason: 'redirected-to-http' };
    }

    const durableUrl = chooseDurableStreamUrl(url, finalUrl);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const icyName = res.headers.get('icy-name')?.trim() || null;
    const icyBr = res.headers.get('icy-br')?.trim() || null;
    const hasIcyHeader = Boolean(icyName || icyBr || res.headers.get('icy-metaint'));

    const isM3uUrl = /\.m3u8(\?|$)/i.test(finalUrl) || /\.m3u8(\?|$)/i.test(url);
    const isHlsContentType =
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/x-mpegurl') ||
      contentType.includes('audio/mpegurl') ||
      contentType.includes('audio/x-mpegurl');

    const isAudioContentType =
      contentType.includes('audio/mpeg') ||
      contentType.includes('audio/mp3') ||
      contentType.includes('audio/x-mpeg') ||
      contentType.includes('audio/aac') ||
      contentType.includes('audio/aacp') ||
      contentType.includes('audio/mp4') ||
      (contentType.includes('application/octet-stream') && hasIcyHeader);

    const explicitlyRejected =
      contentType.includes('text/html') ||
      contentType.includes('application/json') ||
      contentType.includes('application/xml') ||
      contentType.includes('image/') ||
      (contentType.includes('text/plain') && !isM3uUrl);

    if (explicitlyRejected) {
      return { ok: false, reason: `bad-content-type:${contentType.split(';')[0]}` };
    }

    if (!isHlsContentType && !isM3uUrl && !isAudioContentType) {
      return { ok: false, reason: `unsupported-content-type:${contentType.split(';')[0] || 'none'}` };
    }

    if (!res.body) {
      return { ok: false, reason: 'no-body' };
    }

    reader = res.body.getReader();

    if (isHlsContentType || isM3uUrl) {
      let text = '';
      const decoder = new TextDecoder();
      while (text.length < 32768) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) text += decoder.decode(value, { stream: true });
        if (text.includes('#EXTM3U') && /\.(m3u8|ts|aac|m4s|mp4)/i.test(text)) {
          break;
        }
      }
      await reader.cancel().catch(() => {});
      const trimmed = text.trimStart();
      if (!trimmed.startsWith('#EXTM3U')) {
        return { ok: false, reason: 'invalid-hls-manifest' };
      }
      const firstEntry = extractFirstHlsEntry(trimmed, finalUrl);
      if (!firstEntry) {
        return { ok: false, reason: 'empty-hls-manifest' };
      }
      if (/\.m3u8(\?|$)/i.test(firstEntry)) {
        const variantOk = await verifyHlsVariant(firstEntry);
        if (!variantOk) {
          return { ok: false, reason: 'broken-hls-variant' };
        }
      }
      const latencyMs = Date.now() - start;
      return {
        ok: true,
        streamUrl: durableUrl,
        contentType: contentType.split(';')[0],
        isHls: true,
        icyName,
        codec: 'HLS',
        latencyMs,
      };
    }

    let totalBytes = 0;
    while (totalBytes < MIN_STREAM_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) totalBytes += value.byteLength;
    }
    await reader.cancel().catch(() => {});

    if (totalBytes < MIN_STREAM_BYTES) {
      return { ok: false, reason: `insufficient-bytes:${totalBytes}` };
    }

    const latencyMs = Date.now() - start;
    return {
      ok: true,
      streamUrl: durableUrl,
      contentType: contentType.split(';')[0],
      isHls: false,
      icyName,
      codec: inferCodecFromContentType(contentType, fallbackCodec, false),
      latencyMs,
    };
  } catch (err) {
    return { ok: false, reason: err?.name === 'AbortError' ? 'timeout' : 'network-error' };
  } finally {
    clearTimeout(timer);
    if (reader) {
      reader.cancel().catch(() => {});
    }
    controller.abort();
  }
}

async function runWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const idx = nextIndex++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function categorizeStation(name, tagsStr, streamUrl = '', language = '') {
  const hay = `${name} ${tagsStr} ${streamUrl}`.toLowerCase();
  const lang = (language || '').toLowerCase();
  const hasArabic = ARABIC_SCRIPT_RE.test(name) || /arab/.test(lang) || /arab/.test(hay);

  // 1. Nasheeds
  if (/(nasheed|nashid|anasheed|nasyid|naat|qasida|qasidah|ilahi|islamic music|islam music|islamic، classical|أناشيد|اناشيد|نشيد|إنشاد|انشاد|مدائح|مديح)/.test(hay)) {
    return 'nasheed';
  }

  // 2. Lectures, tafsir, seerah, hadith, fatwa, adhkar
  if (
    /(lecture|tafsir|tafseer|seerah|sira\b|siyra|hadith|fatwa|fatawa|fiqh|dars|durus|khutbah|khutba|sermon|athkar|adhkar|azkar|ruqyah|roqya|stories|qasas|دروس|درس|محاضرات|تفسير|السيرة|سيرة|حديث|فتاوى|فتاوي|الفقه|خطب|خطبة|أذكار|اذكار|رقية|قصص)/.test(
      hay
    )
  ) {
    return 'lectures';
  }

  // 3. Single-reciter 24/7 channels
  if (
    /(qurango\.net\/radio|mp3quran|mp3islam\.com\/listen|\breciter\b|القارئ|الشيخ)/.test(hay) ||
    FAMOUS_RECITERS.some((r) => hay.includes(r))
  ) {
    return 'reciters';
  }

  // 4. Live Holy Quran stations (national / general Quran radio)
  if (/(quran|qur'an|qur’an|koran|coran|kuran|قرآن|القرآن|القران|تلاوة|تلاوات|ترتيل|تراتيل)/.test(hay)) {
    return 'quran';
  }

  // 5. Islamic stations worldwide (English, French, Urdu, Malay, etc.)
  return hasArabic ? 'quran' : 'world';
}

function normalizeCountry(rawCode) {
  const cc = (rawCode || '').trim().toUpperCase();
  if (COUNTRY_META[cc]) {
    return COUNTRY_META[cc];
  }
  return COUNTRY_META.INTL;
}

function normalizeLogoUrl(rawFavicon) {
  if (!rawFavicon || typeof rawFavicon !== 'string') return null;
  const trimmed = rawFavicon.trim();
  if (!trimmed.startsWith('https://')) return null;
  if (/facebook\.com\/(?:photo|favicon)/i.test(trimmed)) return null;
  if (/instagram\.com\/favicon/i.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function parseTags(rawTags, category) {
  const rawList = Array.isArray(rawTags)
    ? rawTags
    : (rawTags || '').split(',');
  const tokens = rawList
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => t.length >= 2 && t.length <= 28 && t !== 'classical');
  const unique = Array.from(new Set([category, ...tokens]));
  return unique.slice(0, 6);
}

async function loadCuratedEntries() {
  try {
    const raw = await fs.readFile(CURATED_JSON_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function probeCuratedEntries(entries, failureReasons) {
  const results = await runWithConcurrency(entries, PROBE_CONCURRENCY, async (entry) => {
    const allUrls = [entry.streamUrl, ...(entry.fallbackUrls || [])]
      .map((u) => normalizeUrl(u))
      .filter((u) => Boolean(u) && !EPHEMERAL_URL_RE.test(u));

    const verifiedUrls = [];
    let primaryProbe = null;
    for (const candidate of allUrls) {
      const res = await probeStream(candidate, entry.codec || '');
      if (res.ok) {
        if (!primaryProbe) {
          primaryProbe = res;
        } else {
          verifiedUrls.push(res.streamUrl);
        }
      } else {
        failureReasons.set(`curated:${res.reason}`, (failureReasons.get(`curated:${res.reason}`) || 0) + 1);
      }
    }

    if (!primaryProbe) {
      console.warn(`Curated station skipped (offline): ${entry.name}`);
      return null;
    }

    const country = normalizeCountry(entry.countryCode);
    const station = {
      id: entry.id || `curated-${country.code.toLowerCase()}-${slugify(entry.name)}`,
      name: cleanStationName(entry.name),
      countryCode: country.code,
      country: country.name,
      countryAr: country.nameAr,
      flag: country.flag,
      category: entry.category || categorizeStation(entry.name, (entry.tags || []).join(','), primaryProbe.streamUrl),
      streamUrl: primaryProbe.streamUrl,
      codec: primaryProbe.codec,
      bitrate: Number(entry.bitrate) > 0 ? Number(entry.bitrate) : 128,
      isHls: primaryProbe.isHls,
      logoUrl: normalizeLogoUrl(entry.logoUrl),
      tags: parseTags(entry.tags, entry.category || 'world'),
      latencyMs: primaryProbe.latencyMs,
      featured: entry.featured !== false,
    };

    if (verifiedUrls.length > 0) {
      station.fallbackUrls = Array.from(new Set(verifiedUrls.filter((u) => u !== station.streamUrl)));
    }

    return station;
  });

  return results.filter(Boolean);
}

function selectBalancedCatalog(curatedStations, discoveredStations, reciterStations = []) {
  const selected = [];
  const selectedIds = new Set();
  const countryCounts = new Map();

  function addStation(st, forceInclude = false) {
    if (selectedIds.has(st.id)) return false;
    const ccCount = countryCounts.get(st.countryCode) || 0;
    // Reciter channels are "Worldwide" and capped separately
    if (!forceInclude && st.countryCode !== 'INTL' && ccCount >= MAX_PER_COUNTRY) return false;
    selected.push(st);
    selectedIds.add(st.id);
    countryCounts.set(st.countryCode, ccCount + 1);
    return true;
  }

  for (const st of curatedStations) {
    addStation(st, true);
  }

  // Reciter channels from mp3quran (already ranked, famous reciters first)
  let reciterCount = selected.filter((s) => s.category === 'reciters').length;
  for (const st of reciterStations) {
    if (reciterCount >= MAX_RECITER_STATIONS) break;
    if (addStation(st, true) && st.category === 'reciters') reciterCount++;
  }

  const scored = [...discoveredStations].sort((a, b) => {
    const scoreA = a._score - a.latencyMs * 0.02;
    const scoreB = b._score - b.latencyMs * 0.02;
    return scoreB - scoreA;
  });

  // Pass 1: Guarantee coverage for each non-reciter category
  const CATEGORY_TARGETS = { quran: 40, lectures: 25, nasheed: 15, world: 40, reciters: 0 };
  for (const cat of CATEGORIES) {
    let taken = selected.filter((s) => s.category === cat.id).length;
    const catTarget = CATEGORY_TARGETS[cat.id] ?? 20;
    for (const st of scored) {
      if (taken >= catTarget) break;
      if (st.category === cat.id && addStation(st)) {
        taken++;
      }
    }
  }

  // Pass 2: Top stations from every represented country (up to 4 per country)
  const countries = Array.from(new Set(scored.map((s) => s.countryCode)));
  for (const cc of countries) {
    let taken = countryCounts.get(cc) || 0;
    for (const st of scored) {
      if (st.countryCode === cc && taken < 4 && addStation(st)) {
        taken++;
      }
    }
  }

  // Pass 3: Fill up to TARGET_MAX_STATIONS by score
  for (const st of scored) {
    if (selected.length >= TARGET_MAX_STATIONS) break;
    if (st.category === 'reciters' && reciterCount >= MAX_RECITER_STATIONS) continue;
    if (addStation(st) && st.category === 'reciters') reciterCount++;
  }

  return selected.map(({ _score, ...clean }) => clean);
}

/**
 * Fetches mp3quran.net's 24/7 single-reciter radio channels (English + Arabic names)
 * and probes them. Famous reciters are ranked first.
 */
async function fetchMp3QuranReciters(failureReasons, seenFinalUrls, usedIds) {
  async function getRadios(language) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${MP3QURAN_RADIOS_API}?language=${language}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.radios) ? json.radios : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  const [eng, ar] = await Promise.all([getRadios('eng'), getRadios('ar')]);
  if (eng.length === 0 && ar.length === 0) {
    console.warn('Warning: mp3quran.net radios API returned no data.');
    return [];
  }
  const arById = new Map(ar.map((r) => [r.id, r]));
  const base = eng.length > 0 ? eng : ar;

  const entries = base
    .map((r) => {
      const arName = (arById.get(r.id)?.name || '').trim();
      const enName = (r.name || '').trim();
      const rawUrl = normalizeUrl(r.url || arById.get(r.id)?.url || '');
      if (!rawUrl) return null;
      // backup.qurango.net intermittently returns HTTP 500; qurango.net is the primary edge
      const url = rawUrl.replace('://backup.qurango.net/', '://qurango.net/');
      const backupUrl = url !== rawUrl ? rawUrl : null;
      let name = enName && arName && enName !== arName ? `${enName} ${arName}` : enName || arName;
      if (/_mojawwad\b/i.test(url)) name += ' (Mujawwad)';
      else if (/_warsh\b/i.test(url)) name += ' (Warsh)';
      else if (/_qalon\b/i.test(url)) name += ' (Qalun)';
      else if (/_aldouri\b/i.test(url)) name += ' (Al-Douri)';
      else if (/_assosi\b/i.test(url)) name += ' (Al-Susi)';
      const hay = `${enName} ${arName}`.toLowerCase();
      const famous = FAMOUS_RECITERS.some((k) => hay.includes(k));
      const thematic = MP3QURAN_THEMATIC_RE.test(hay);
      return { id: r.id, name: cleanStationName(name), url, backupUrl, famous, thematic };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.famous) - Number(a.famous) || Number(b.thematic) - Number(a.thematic));

  console.log(`mp3quran.net: ${entries.length} radio channels, probing...`);
  const probed = await runWithConcurrency(entries, PROBE_CONCURRENCY, async (entry) => {
    let res = await probeStream(entry.url, 'MP3');
    let usedBackup = false;
    if (!res.ok && entry.backupUrl) {
      res = await probeStream(entry.backupUrl, 'MP3');
      usedBackup = res.ok;
    }
    if (!res.ok) {
      failureReasons.set(`mp3quran:${res.reason}`, (failureReasons.get(`mp3quran:${res.reason}`) || 0) + 1);
      return null;
    }
    const finalNorm = normalizeUrl(res.streamUrl) || res.streamUrl;
    if (seenFinalUrls.has(finalNorm)) return null;
    seenFinalUrls.add(finalNorm);
    let id = `mp3quran-${entry.id}`;
    let suffix = 2;
    while (usedIds.has(id)) id = `mp3quran-${entry.id}-${suffix++}`;
    usedIds.add(id);
    const category = entry.thematic ? 'lectures' : 'reciters';
    const country = COUNTRY_META.INTL;
    return {
      id,
      name: entry.name,
      countryCode: country.code,
      country: country.name,
      countryAr: country.nameAr,
      flag: country.flag,
      category,
      streamUrl: res.streamUrl,
      codec: res.codec,
      bitrate: 128,
      isHls: res.isHls,
      logoUrl: null,
      tags: [category, 'quran', 'mp3quran'],
      latencyMs: res.latencyMs,
      ...(entry.backupUrl && !usedBackup ? { fallbackUrls: [entry.backupUrl] } : {}),
      _score: entry.famous ? 100 : 0,
    };
  });
  return probed.filter(Boolean);
}

function generateReport({ mode, totalCandidates, prefilterStats, probeResults, curatedCount, finalStations, failureReasons }) {
  const byCategory = {};
  for (const cat of CATEGORIES) {
    byCategory[cat.id] = 0;
  }
  const byCountry = new Map();
  for (const st of finalStations) {
    byCategory[st.category] = (byCategory[st.category] || 0) + 1;
    const key = `${st.flag} ${st.country} (${st.countryCode})`;
    byCountry.set(key, (byCountry.get(key) || 0) + 1);
  }

  const lines = [
    `# Islamic Radio — Station Catalog Verification Report`,
    ``,
    `- **Generated:** ${new Date().toISOString()}`,
    `- **Mode:** ${mode}`,
    `- **Curated flagship stations live:** ${curatedCount}`,
    `- **Total candidates evaluated:** ${totalCandidates}`,
    `- **Passed pre-filter (HTTPS + compatible codec + Islamic content):** ${prefilterStats.passed}`,
    `- **Live probe passed:** ${probeResults.passed}`,
    `- **Live probe failed:** ${probeResults.failed}`,
    `- **Final catalog count:** ${finalStations.length}`,
    ``,
    `## Breakdown by Category`,
    `| Category | Count |`,
    `| :--- | ---: |`,
    ...CATEGORIES.map((c) => `| ${c.label} (\`${c.id}\`) | ${byCategory[c.id] || 0} |`),
    ``,
    `## Breakdown by Country`,
    `| Country | Count |`,
    `| :--- | ---: |`,
    ...Array.from(byCountry.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `| ${k} | ${v} |`),
    ``,
  ];

  if (failureReasons.size > 0) {
    lines.push(`## Probe Failure Reasons`, `| Reason | Count |`, `| :--- | ---: |`);
    for (const [reason, count] of Array.from(failureReasons.entries()).sort((a, b) => b[1] - a[1])) {
      lines.push(`| \`${reason}\` | ${count} |`);
    }
    lines.push('');
  }

  lines.push(
    `## Curated & Top Verified Stations`,
    `| Name | Country | Category | Codec | Latency |`,
    `| :--- | :--- | :--- | :--- | ---: |`,
    ...finalStations.slice(0, 35).map(
      (s) =>
        `| ${s.name.replace(/\|/g, '/')} | ${s.flag} ${s.country} | \`${s.category}\` | ${s.codec} | ${s.latencyMs}ms |`
    ),
    ''
  );

  return lines.join('\n');
}

async function verifyExistingCatalog() {
  const failureReasons = new Map();
  const curatedEntries = await loadCuratedEntries();
  console.log(`Probing ${curatedEntries.length} curated stations...`);
  const curatedLive = await probeCuratedEntries(curatedEntries, failureReasons);

  const raw = await fs.readFile(STATIONS_JSON_PATH, 'utf8');
  const existing = JSON.parse(raw);
  const existingStations = existing.stations || [];

  const curatedIds = new Set(curatedLive.map((s) => s.id));
  const curatedUrls = new Set(curatedLive.map((s) => normalizeUrl(s.streamUrl)).filter(Boolean));
  const toCheck = existingStations.filter(
    (s) => !curatedIds.has(s.id) && !curatedUrls.has(normalizeUrl(s.streamUrl))
  );

  console.log(`Verifying ${toCheck.length} existing non-curated stations...`);
  let passedCount = curatedLive.length;
  let failedCount = curatedEntries.length - curatedLive.length;

  const probed = await runWithConcurrency(toCheck, PROBE_CONCURRENCY, async (st) => {
    const urlsToTry = [st.streamUrl, ...(st.fallbackUrls || [])]
      .map((u) => normalizeUrl(u))
      .filter(Boolean);

    let winner = null;
    const validFallbacks = [];
    for (const u of urlsToTry) {
      const res = await probeStream(u, st.codec);
      if (res.ok) {
        if (!winner) winner = res;
        else validFallbacks.push(res.streamUrl);
      } else {
        failureReasons.set(res.reason, (failureReasons.get(res.reason) || 0) + 1);
      }
    }

    if (!winner) {
      failedCount++;
      return null;
    }
    passedCount++;

    const updatedStation = {
      ...st,
      streamUrl: winner.streamUrl,
      codec: winner.codec,
      isHls: winner.isHls,
      latencyMs: winner.latencyMs,
    };
    if (validFallbacks.length > 0) {
      updatedStation.fallbackUrls = Array.from(new Set(validFallbacks.filter((u) => u !== winner.streamUrl)));
    } else {
      delete updatedStation.fallbackUrls;
    }
    return updatedStation;
  });

  const validStations = [...curatedLive, ...probed.filter(Boolean)];
  const updated = {
    version: existing.version || 1,
    updatedAt: new Date().toISOString(),
    stationCount: validStations.length,
    categories: CATEGORIES,
    stations: validStations,
  };

  await fs.mkdir(CATALOG_DIR, { recursive: true });
  await fs.writeFile(STATIONS_JSON_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');

  const report = generateReport({
    mode: 'verify-only',
    totalCandidates: curatedEntries.length + toCheck.length,
    prefilterStats: { passed: curatedEntries.length + toCheck.length },
    probeResults: { passed: passedCount, failed: failedCount },
    curatedCount: curatedLive.length,
    finalStations: validStations,
    failureReasons,
  });
  await fs.writeFile(REPORT_MD_PATH, report, 'utf8');

  console.log(`Verification complete: ${validStations.length} alive (${curatedLive.length} curated), ${failedCount} removed.`);
}

async function curateCatalog() {
  const failureReasons = new Map();
  const curatedEntries = await loadCuratedEntries();
  console.log(`Probing ${curatedEntries.length} curated flagship stations...`);
  const curatedLive = await probeCuratedEntries(curatedEntries, failureReasons);
  console.log(`Curated live: ${curatedLive.length}/${curatedEntries.length}`);

  const RB = '&hidebroken=true&order=clickcount&reverse=true';
  const queries = [
    ...['quran', 'koran', 'coran', 'islam', 'islamic', 'muslim', 'nasheed', 'nasheeds', 'anasheed',
      'sunnah', 'hadith', 'tafsir', 'islamic radio', 'quran radio', 'religious', 'religion', 'dawah',
      'lectures', 'القرآن الكريم', 'اسلامية', 'أناشيد'].map((tag) => ({
      path: `/json/stations/search?tag=${encodeURIComponent(tag)}&limit=150${RB}`,
    })),
    ...ISLAMIC_COUNTRIES.map((cc) => ({
      path: `/json/stations/search?countrycode=${cc}&tag=islam&limit=40${RB}`,
    })),
    ...ISLAMIC_COUNTRIES.map((cc) => ({
      path: `/json/stations/search?countrycode=${cc}&tag=quran&limit=40${RB}`,
    })),
    ...FLAGSHIP_NAME_QUERIES.map((term) => ({
      path: `/json/stations/search?name=${encodeURIComponent(term)}&limit=60${RB}`,
    })),
  ];

  console.log(`Fetching candidates from Radio-Browser (${queries.length} queries)...`);
  const seenUrls = new Set();
  const seenFinalUrls = new Set();
  const seenNameCountry = new Set();
  const usedIds = new Set();

  for (const st of curatedLive) {
    const norm = normalizeUrl(st.streamUrl);
    if (norm) {
      seenUrls.add(norm);
      seenFinalUrls.add(norm);
    }
    for (const fb of st.fallbackUrls || []) {
      const normFb = normalizeUrl(fb);
      if (normFb) {
        seenUrls.add(normFb);
        seenFinalUrls.add(normFb);
      }
    }
    seenNameCountry.add(`${normalizeNameForDedup(st.name)}::${st.countryCode}`);
    usedIds.add(st.id);
  }

  const reciterStations = await fetchMp3QuranReciters(failureReasons, seenFinalUrls, usedIds);
  const hasMp3Quran = reciterStations.length > 0;
  for (const st of reciterStations) {
    const norm = normalizeUrl(st.streamUrl);
    if (norm) seenUrls.add(norm);
    seenNameCountry.add(`${normalizeNameForDedup(st.name)}::${st.countryCode}`);
  }
  console.log(`mp3quran.net live channels: ${reciterStations.length}`);

  const candidates = [];
  let totalRawFetched = reciterStations.length;

  for (const q of queries) {
    try {
      const items = await fetchJsonWithMirror(q.path);
      if (!Array.isArray(items)) continue;
      totalRawFetched += items.length;
      for (const raw of items) {
        const pre = prefilterCandidate(raw);
        if (!pre.ok) continue;

        const normPrimary = normalizeUrl(pre.urlCandidates[0]);
        if (!normPrimary || seenUrls.has(normPrimary)) continue;
        if (hasMp3Quran && /qurango\.net\/radio\//i.test(normPrimary)) continue;

        const country = normalizeCountry(raw.countrycode);
        const cleanName = cleanStationName(raw.name);
        const dedupKey = `${normalizeNameForDedup(cleanName)}::${country.code}`;
        if (seenNameCountry.has(dedupKey)) continue;

        seenUrls.add(normPrimary);
        seenNameCountry.add(dedupKey);
        candidates.push({ raw, urlCandidates: pre.urlCandidates, cleanName, country });
      }
    } catch (err) {
      console.warn(`Warning: query failed (${q.path}): ${err.message}`);
    }
  }

  candidates.sort((a, b) => {
    const scoreA = (a.raw.votes || 0) * 3 + (a.raw.clickcount || 0) * 0.05;
    const scoreB = (b.raw.votes || 0) * 3 + (b.raw.clickcount || 0) * 0.05;
    return scoreB - scoreA;
  });

  const probePool = candidates.slice(0, 600);
  console.log(`Fetched ${totalRawFetched} raw records -> ${candidates.length} unique candidates (probing top ${probePool.length})...`);

  let passedCount = curatedLive.length;
  let failedCount = curatedEntries.length - curatedLive.length;

  const probed = await runWithConcurrency(probePool, PROBE_CONCURRENCY, async ({ raw, urlCandidates, cleanName, country }) => {
    let winner = null;
    let lastReason = 'unknown';

    for (const urlCandidate of urlCandidates) {
      const res = await probeStream(urlCandidate, raw.codec);
      if (res.ok) {
        winner = res;
        break;
      }
      lastReason = res.reason;
    }

    if (!winner) {
      failedCount++;
      failureReasons.set(lastReason, (failureReasons.get(lastReason) || 0) + 1);
      return null;
    }

    const finalNorm = normalizeUrl(winner.streamUrl) || winner.streamUrl;
    if (seenFinalUrls.has(finalNorm)) {
      return null;
    }
    seenFinalUrls.add(finalNorm);
    passedCount++;

    const category = categorizeStation(cleanName, raw.tags || '', winner.streamUrl, raw.language || '');
    const baseId = raw.stationuuid || `${country.code.toLowerCase()}-${slugify(cleanName)}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix++}`;
    }
    usedIds.add(id);

    const bitrateNum = Number(raw.bitrate) > 0 ? Number(raw.bitrate) : 128;
    const score =
      (raw.votes || 0) * 4 +
      Math.min(raw.clickcount || 0, 5000) * 0.05 +
      (category === 'quran' ? 40 : 0);

    return {
      id,
      name: cleanName,
      countryCode: country.code,
      country: country.name,
      countryAr: country.nameAr,
      flag: country.flag,
      category,
      streamUrl: winner.streamUrl,
      codec: winner.codec,
      bitrate: bitrateNum,
      isHls: winner.isHls,
      logoUrl: normalizeLogoUrl(raw.favicon),
      tags: parseTags(raw.tags, category),
      latencyMs: winner.latencyMs,
      _score: score,
    };
  });

  const verifiedDiscovered = probed.filter(Boolean);
  const finalStations = selectBalancedCatalog(curatedLive, verifiedDiscovered, reciterStations);

  const catalog = {
    version: 1,
    updatedAt: new Date().toISOString(),
    stationCount: finalStations.length,
    categories: CATEGORIES,
    stations: finalStations,
  };

  await fs.mkdir(CATALOG_DIR, { recursive: true });
  await fs.writeFile(STATIONS_JSON_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

  const report = generateReport({
    mode: 'full-curation',
    totalCandidates: totalRawFetched + curatedEntries.length,
    prefilterStats: { passed: probePool.length + curatedEntries.length },
    probeResults: { passed: passedCount, failed: failedCount },
    curatedCount: curatedLive.length,
    finalStations,
    failureReasons,
  });
  await fs.writeFile(REPORT_MD_PATH, report, 'utf8');

  console.log(`Catalog saved to ${STATIONS_JSON_PATH} with ${finalStations.length} verified stations (${curatedLive.length} curated).`);
  console.log(`Report saved to ${REPORT_MD_PATH}.`);
}

const verifyOnly = process.argv.includes('--verify-only');
if (verifyOnly) {
  await verifyExistingCatalog();
} else {
  await curateCatalog();
}
