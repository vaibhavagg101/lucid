// Turns raw per-user stage timings into the comparison table across the 3/6/9 waves.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { STAGE_ORDER } from './stages.mjs';

const seconds = (ms) => (ms / 1000).toFixed(1);

function quantiles(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const median =
        sorted.length % 2
            ? sorted[(sorted.length - 1) / 2]
            : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    return {
        n: sorted.length,
        min: sorted[0],
        median,
        max: sorted[sorted.length - 1],
        mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    };
}

export function summariseWave(waveSize, results) {
    const stageStats = {};
    for (const name of STAGE_ORDER) {
        const entries = results.flatMap((r) => r.stages.filter((s) => s.stage === name));
        if (!entries.length) continue;
        const ok = entries.filter((s) => s.ok);
        stageStats[name] = {
            attempted: entries.length,
            failed: entries.length - ok.length,
            ...(ok.length ? quantiles(ok.map((s) => s.ms)) : { n: 0 }),
        };
    }
    const completed = results.filter((r) => r.ok);
    return {
        waveSize,
        users: results.length,
        completed: completed.length,
        failed: results.length - completed.length,
        endToEnd: completed.length ? quantiles(completed.map((r) => r.totalMs)) : { n: 0 },
        stageStats,
        errors: results.filter((r) => r.error).map((r) => ({ uid: r.uid, audioId: r.audioId, error: r.error })),
        separatedFileCounts: results.map((r) => r.separatedFileCount).filter((c) => c !== undefined),
    };
}

function table(rows) {
    const headers = Object.keys(rows[0]);
    const widths = headers.map((h) => Math.max(h.length, ...rows.map((r) => String(r[h]).length)));
    const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
    return [line(headers), line(widths.map((w) => '-'.repeat(w))), ...rows.map((r) => line(headers.map((h) => r[h])))].join('\n');
}

export function printWave(summary) {
    console.log(`\n=== Wave: ${summary.waveSize} concurrent users ===`);
    console.log(`completed ${summary.completed}/${summary.users}   failed ${summary.failed}`);
    if (summary.endToEnd.n) {
        console.log(
            `end-to-end (s): min ${seconds(summary.endToEnd.min)}  median ${seconds(summary.endToEnd.median)}  max ${seconds(summary.endToEnd.max)}`,
        );
    }
    const rows = Object.entries(summary.stageStats).map(([stage, s]) => ({
        stage,
        ok: `${s.n}/${s.attempted}`,
        min_s: s.n ? seconds(s.min) : '-',
        median_s: s.n ? seconds(s.median) : '-',
        max_s: s.n ? seconds(s.max) : '-',
    }));
    if (rows.length) console.log(table(rows));
    for (const e of summary.errors) console.log(`  ! ${e.uid} (${e.audioId}): ${e.error}`);
}

// Side-by-side median comparison — a flat row means headroom, a rising row means contention.
export function printComparison(summaries) {
    console.log('\n=== Median stage duration by wave size (seconds) ===');
    const sizes = summaries.map((s) => s.waveSize);
    const stages = [...new Set(summaries.flatMap((s) => Object.keys(s.stageStats)))];
    const rows = stages.map((stage) => {
        const row = { stage };
        for (const s of summaries) {
            row[`${s.waveSize}u`] = s.stageStats[stage]?.n ? seconds(s.stageStats[stage].median) : '-';
        }
        return row;
    });
    const totals = { stage: 'END-TO-END' };
    for (const s of summaries) totals[`${s.waveSize}u`] = s.endToEnd.n ? seconds(s.endToEnd.median) : '-';
    const success = { stage: 'completed' };
    for (const s of summaries) success[`${s.waveSize}u`] = `${s.completed}/${s.users}`;
    console.log(table([...rows, totals, success]));
    console.log(`\nWave sizes: ${sizes.join(', ')} users.`);
}

export function writeResults(dir, runId, payload) {
    mkdirSync(dir, { recursive: true });
    const jsonPath = join(dir, `run-${runId}.json`);
    writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

    const csvPath = join(dir, `run-${runId}.csv`);
    const lines = ['wave_size,uid,audio_id,fixture,stage,ms,ok,error'];
    for (const wave of payload.waves) {
        for (const r of wave.results) {
            for (const s of r.stages) {
                lines.push(
                    [wave.waveSize, r.uid, r.audioId, r.fixture, s.stage, s.ms, s.ok, JSON.stringify(s.error ?? '')].join(','),
                );
            }
        }
    }
    writeFileSync(csvPath, lines.join('\n'));
    return { jsonPath, csvPath };
}
