/**
 * API Route Testing System
 * Tests all API routes to verify they exist and respond correctly.
 * 
 * Usage:
 *   1. Start dev server: pnpm dev
 *   2. Run: node scripts/test-api-routes.mjs
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Color helpers
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Route definitions: [path, expectedMethods, needsAuth, category]
const ROUTES = [
  // Auth
  { path: '/api/auth/login', methods: ['POST'], auth: false, category: 'Auth' },
  { path: '/api/auth/register', methods: ['POST'], auth: false, category: 'Auth' },
  { path: '/api/auth/logout', methods: ['POST'], auth: false, category: 'Auth' },

  // Admin
  { path: '/api/admin', methods: ['GET', 'PATCH'], auth: true, category: 'Admin' },
  { path: '/api/admin/dashboard/stats', methods: ['GET'], auth: true, category: 'Admin' },
  { path: '/api/admin/exams', methods: ['GET', 'POST'], auth: true, category: 'Admin' },
  { path: '/api/admin/internships', methods: ['GET', 'PATCH'], auth: true, category: 'Admin' },
  { path: '/api/admin/settings', methods: ['GET', 'PATCH'], auth: true, category: 'Admin' },
  { path: '/api/admin/submissions', methods: ['GET'], auth: true, category: 'Admin' },

  // Attestations
  { path: '/api/attestations', methods: ['GET', 'POST'], auth: true, category: 'Attestations' },

  // Exams
  { path: '/api/exams', methods: ['GET', 'POST'], auth: true, category: 'Exams' },

  // Formations
  { path: '/api/formations', methods: ['GET', 'POST'], auth: true, category: 'Formations' },

  // Public
  { path: '/api/public/stats', methods: ['GET'], auth: false, category: 'Public' },
  { path: '/api/public/settings', methods: ['GET'], auth: false, category: 'Public' },
  { path: '/api/public/alumni', methods: ['GET'], auth: false, category: 'Public' },

  // User
  { path: '/api/user/attestations', methods: ['GET'], auth: true, category: 'User' },
  { path: '/api/user/exams', methods: ['GET'], auth: true, category: 'User' },
  { path: '/api/user/results', methods: ['GET'], auth: true, category: 'User' },
  { path: '/api/user/statistics', methods: ['GET'], auth: true, category: 'User' },
  { path: '/api/user/profile', methods: ['GET', 'PATCH'], auth: true, category: 'User' },
  { path: '/api/user/internships', methods: ['GET', 'POST'], auth: true, category: 'User' },

  // Submissions
  { path: '/api/submissions', methods: ['GET', 'PATCH'], auth: true, category: 'Submissions' },

  // Users management
  { path: '/api/users', methods: ['GET', 'POST'], auth: true, category: 'Users' },

  // Signalement
  { path: '/api/signalement', methods: ['GET', 'POST'], auth: false, category: 'Signalement' },

  // Verifier
  { path: '/api/verifier', methods: ['GET'], auth: false, category: 'Verifier' },

  // Settings
  { path: '/api/settings', methods: ['GET', 'PATCH'], auth: true, category: 'Settings' },
];

const results = {
  ok: [],
  missing: [],
  broken: [],
  unexpected: [],
};

async function testRoute(route, method) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${BASE_URL}${route.path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // 404 = route doesn't exist
    if (response.status === 404) {
      return { status: 'missing', code: 404 };
    }

    // 500 = broken route
    if (response.status === 500) {
      return { status: 'broken', code: 500 };
    }

    // Any other response = route exists (even 401/400/403/405)
    return { status: 'ok', code: response.status };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { status: 'broken', code: 'timeout' };
    }
    return { status: 'broken', code: 'network_error' };
  }
}

async function runTests() {
  console.log(`\n${BOLD}${BLUE}╔══════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${BLUE}║${RESET}${BOLD}          API Route Testing System                      ${BOLD}${BLUE}║${RESET}`);
  console.log(`${BOLD}${BLUE}╚══════════════════════════════════════════════════════════╝${RESET}\n`);
  console.log(`Testing against: ${BASE_URL}\n`);

  // Check if server is running
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(BASE_URL, { signal: controller.signal });
    clearTimeout(timeout);
  } catch {
    console.log(`${RED}✗ Server is not running at ${BASE_URL}${RESET}`);
    console.log(`${YELLOW}Start it with: pnpm dev${RESET}\n`);
    process.exit(1);
  }

  for (const route of ROUTES) {
    console.log(`${BOLD}${GRAY}── ${route.category}: ${route.path}${RESET}`);

    for (const method of route.methods) {
      const result = await testRoute(route, method);
      const methodLabel = `${method}`.padEnd(6);

      if (result.status === 'ok') {
        console.log(`  ${GREEN}✓${RESET} ${methodLabel} → ${result.code} ${GRAY}(route exists)${RESET}`);
        results.ok.push({ path: route.path, method, status: result.code });
      } else if (result.status === 'missing') {
        console.log(`  ${RED}✗${RESET} ${methodLabel} → ${RED}404 (route missing)${RESET}`);
        results.missing.push({ path: route.path, method });
      } else if (result.status === 'broken') {
        console.log(`  ${RED}✗${RESET} ${methodLabel} → ${RED}500 (broken route)${RESET}`);
        results.broken.push({ path: route.path, method, error: result.code });
      }
    }
  }

  // Summary
  console.log(`\n${BOLD}${BLUE}╔══════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${BLUE}║${RESET}${BOLD}                    TEST SUMMARY                            ${BOLD}${BLUE}║${RESET}`);
  console.log(`${BOLD}${BLUE}╚══════════════════════════════════════════════════════════╝${RESET}\n`);

  console.log(`  ${GREEN}✓ Working:${RESET}   ${results.ok.length}`);
  console.log(`  ${RED}✗ Missing:${RESET}   ${results.missing.length}`);
  console.log(`  ${RED}✗ Broken:${RESET}    ${results.broken.length}`);

  if (results.missing.length > 0) {
    console.log(`\n${BOLD}${RED}Missing Routes:${RESET}`);
    for (const r of results.missing) {
      console.log(`  ${RED}─${RESET} ${r.method} ${r.path}`);
    }
  }

  if (results.broken.length > 0) {
    console.log(`\n${BOLD}${RED}Broken Routes:${RESET}`);
    for (const r of results.broken) {
      console.log(`  ${RED}─${RESET} ${r.method} ${r.path} (error: ${r.error})`);
    }
  }

  console.log(`\n${GRAY}Total routes tested: ${results.ok.length + results.missing.length + results.broken.length}${RESET}\n`);

  // Exit with error code if any issues
  if (results.missing.length > 0 || results.broken.length > 0) {
    process.exit(1);
  }
}

runTests();
