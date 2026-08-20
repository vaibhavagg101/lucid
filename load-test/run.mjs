// Entry point: runs waves of 3, 6 and 9 concurrent users through the full LUCID pipeline.
//   node run.mjs                 # 3, 6, 9
//   node run.mjs --waves 3       # a single wave
//   node run.mjs --dry-run       # validate config/fixtures/credentials without touching the pipeline
import { config } from './src/config.mjs';
import { loadFixtures, assignFixtures } from './src/fixtures.mjs';
import { initAdmin, ensureTestUsers, checkAdminAccess } from './src/users.mjs';
import { runVirtualUser } from './src/pipeline.mjs';
import { summariseWave, printWave, printComparison, writeResults } from './src/report.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const WAVES = flag('waves', '3,6,9').split(',').map(Number);
const MAX_USERS = 9;

async function main() {
    if (WAVES.some((w) => !Number.isInteger(w) || w < 1 || w > MAX_USERS)) {
        console.error(`Wave sizes must be integers between 1 and ${MAX_USERS}.`);
        process.exit(1);
    }

    const fixtures = loadFixtures(config.fixtureDir);
    const peak = Math.max(...WAVES);
    console.log(`Project: ${config.projectId}   bucket: ${config.bucket}`);
    console.log(`Fixtures (${fixtures.length}): ${fixtures.map((f) => f.name).join(', ')}`);
    console.log(`Waves: ${WAVES.join(', ')}   separationOption: ${config.separationOption}`);

    const admin = initAdmin();

    // A dry run only reads — it must not create users or touch the pipeline.
    if (has('dry-run')) {
        console.log('\nDry run — read-only checks:');
        const checks = await checkAdminAccess(admin);
        for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.label}${c.ok ? '' : ` — ${c.error}`}`);
        const failed = checks.filter((c) => !c.ok);
        console.log(failed.length ? `\n${failed.length} check(s) failed.` : '\nAll checks passed. Nothing was created or sent.');
        process.exitCode = failed.length ? 1 : 0;
        return;
    }

    const users = await ensureTestUsers(admin, peak);
    console.log(`Test users ready: ${users.map((u) => u.uid).join(', ')}`);

    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const waves = [];
    const summaries = [];

    for (const [i, waveSize] of WAVES.entries()) {
        const waveUsers = users.slice(0, waveSize);
        const waveFixtures = assignFixtures(fixtures, waveSize);
        console.log(`\n>>> Starting wave of ${waveSize} concurrent users at ${new Date().toISOString()}`);
        const startedAt = new Date().toISOString();

        // All virtual users launch together — this is the concurrency the test is measuring.
        const settled = await Promise.allSettled(
            waveUsers.map((user, idx) =>
                runVirtualUser({ user, fixture: waveFixtures[idx], admin, waveSize }),
            ),
        );
        const results = settled.map((s, idx) =>
            s.status === 'fulfilled'
                ? s.value
                : { uid: waveUsers[idx].uid, index: idx, waveSize, stages: [], ok: false, error: String(s.reason), totalMs: 0 },
        );

        const summary = summariseWave(waveSize, results);
        printWave(summary);
        summaries.push(summary);
        waves.push({ waveSize, startedAt, finishedAt: new Date().toISOString(), results });

        // Cool down between waves so each one starts from a comparable Cloud Run scale state.
        if (i < WAVES.length - 1 && config.cooldownMs > 0) {
            console.log(`\nCooling down ${config.cooldownMs / 1000}s before the next wave...`);
            await new Promise((r) => setTimeout(r, config.cooldownMs));
        }
    }

    printComparison(summaries);
    const { jsonPath, csvPath } = writeResults(config.resultsDir, runId, { runId, config: { ...config, client: undefined }, waves, summaries });
    console.log(`\nResults: ${jsonPath}\n         ${csvPath}`);
    console.log(`\nNext: ./gcp-check.sh "${waves[0].startedAt}"   then   node cleanup.mjs`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
