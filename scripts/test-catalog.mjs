#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const STATIONS_JSON_PATH = path.join(ROOT_DIR, 'catalog', 'stations.json');

const VALID_CATEGORIES = new Set(['quran', 'reciters', 'lectures', 'nasheed', 'world']);
const EPHEMERAL_RE = /(surfernetwork\.com|[?&](zt|token|exp|expires|sig|signature|hdnea|auth|rj-tok|rj-ttl)=)/i;

function normalizeSearchText(input) {
  return (input || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function filterStations(stations, { query = '', category = 'all', countryCode = 'ALL' } = {}) {
  const normQuery = normalizeSearchText(query);
  return stations.filter((s) => {
    if (category !== 'all' && s.category !== category) return false;
    if (countryCode !== 'ALL' && s.countryCode !== countryCode) return false;
    if (!normQuery) return true;
    const haystack = normalizeSearchText(
      [s.name, s.country, s.countryAr, s.category, ...(s.tags || [])].join(' ')
    );
    return haystack.includes(normQuery);
  });
}

async function run() {
  const raw = await fs.readFile(STATIONS_JSON_PATH, 'utf8');
  const catalog = JSON.parse(raw);

  assert.equal(typeof catalog.version, 'number', 'catalog.version must be a number');
  assert.ok(Date.parse(catalog.updatedAt), 'catalog.updatedAt must be a valid ISO timestamp');
  assert.ok(Array.isArray(catalog.categories), 'catalog.categories must be an array');
  assert.ok(Array.isArray(catalog.stations), 'catalog.stations must be an array');
  assert.equal(
    catalog.stationCount,
    catalog.stations.length,
    `stationCount (${catalog.stationCount}) must equal stations.length (${catalog.stations.length})`
  );
  assert.ok(
    catalog.stations.length >= 100,
    `Expected at least 100 stations, found ${catalog.stations.length}`
  );

  const ids = new Set();
  const categoriesSeen = new Set();
  const countriesSeen = new Set();
  let reciterCount = 0;

  for (const st of catalog.stations) {
    assert.ok(typeof st.id === 'string' && st.id.trim().length > 0, 'Station id must be non-empty');
    assert.ok(!ids.has(st.id), `Duplicate station id: ${st.id}`);
    ids.add(st.id);

    assert.ok(typeof st.name === 'string' && st.name.trim().length > 0, `Empty name for ${st.id}`);
    assert.ok(
      typeof st.streamUrl === 'string' && st.streamUrl.startsWith('https://'),
      `streamUrl must start with https:// for ${st.name}: ${st.streamUrl}`
    );
    assert.ok(
      !EPHEMERAL_RE.test(st.streamUrl),
      `streamUrl must not contain ephemeral signed tokens for ${st.name}: ${st.streamUrl}`
    );

    if (st.fallbackUrls !== undefined) {
      assert.ok(Array.isArray(st.fallbackUrls), `fallbackUrls must be an array for ${st.name}`);
      for (const fb of st.fallbackUrls) {
        assert.ok(
          typeof fb === 'string' && fb.startsWith('https://'),
          `fallbackUrl must start with https:// for ${st.name}: ${fb}`
        );
        assert.ok(
          !EPHEMERAL_RE.test(fb),
          `fallbackUrl must not contain ephemeral signed tokens for ${st.name}: ${fb}`
        );
      }
    }

    assert.ok(
      VALID_CATEGORIES.has(st.category),
      `Invalid category "${st.category}" for ${st.name}`
    );
    categoriesSeen.add(st.category);
    countriesSeen.add(st.countryCode);
    if (st.category === 'reciters') {
      reciterCount++;
    }

    assert.ok(
      st.logoUrl === null || (typeof st.logoUrl === 'string' && st.logoUrl.startsWith('https://')),
      `Invalid logoUrl for ${st.name}: ${st.logoUrl}`
    );
  }

  for (const cat of ['quran', 'reciters', 'lectures']) {
    assert.ok(categoriesSeen.has(cat), `Category "${cat}" has 0 stations in catalog`);
  }
  assert.ok(countriesSeen.size >= 10, `Expected at least 10 countries, found ${countriesSeen.size}`);
  assert.ok(reciterCount >= 20, `Expected at least 20 reciter stations, found ${reciterCount}`);

  // Filter / search behavior checks (English + Arabic normalization)
  const quranOnly = filterStations(catalog.stations, { category: 'quran' });
  assert.ok(quranOnly.length > 0, 'Expected at least 1 quran station');
  assert.ok(quranOnly.every((s) => s.category === 'quran'), 'Category filter leaked non-quran station');

  const sudais = filterStations(catalog.stations, { query: 'Sudais' });
  assert.ok(sudais.length > 0, 'Expected Sudais reciter station to be present');

  const arabicQuery = filterStations(catalog.stations, { query: 'القران' });
  assert.ok(arabicQuery.length > 0, 'Expected normalized Arabic search "القران" to match stations with "القرآن"');

  const countrySearch = filterStations(catalog.stations, { query: 'Saudi' });
  assert.ok(countrySearch.length > 0, 'Expected English country search "Saudi" to match stations');

  for (const st of catalog.stations) {
    assert.ok(
      !/(christian|church|gospel|المقاومة)/i.test(`${st.name} ${(st.tags || []).join(' ')}`),
      `Off-topic station leaked into catalog: ${st.name}`
    );
  }

  console.log(
    `Catalog validation passed: ${catalog.stations.length} stations, ${categoriesSeen.size} categories, ${countriesSeen.size} countries (${reciterCount} reciters).`
  );
}

await run();
