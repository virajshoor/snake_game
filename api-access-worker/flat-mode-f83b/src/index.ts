/**
 * Cloudflare Worker for Snake Game Leaderboard API (TypeScript)
 * - Includes CORS headers.
 * - Updates score only if the new score is higher for a given name.
 * - Interacts with a D1 database bound as 'DB'.
 * - Assumes D1 table 'scores' with columns 'name' (TEXT) and 'score_value' (INTEGER).
 * - Provides endpoints:
 * - GET /api/leaderboard: Returns ALL scores, ordered by score DESC.
 * - POST /api/scores: Saves/Updates a score.
 * - OPTIONS /*: Handles CORS preflight requests.
 */

export interface Env {
	DB: D1Database;
}

interface ScorePostBody {
	name?: string;
	score_value?: number;
}

interface ScoreEntry {
    name: string;
    score_value: number;
}

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// Helper Functions
function jsonResponse(data: unknown, status = 200): Response {
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json;charset=UTF-8');
	return new Response(JSON.stringify(data), { status: status, headers: headers });
}
function errorResponse(message: string, status = 400): Response {
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json;charset=UTF-8');
	return new Response(JSON.stringify({ success: false, error: message }), { status: status, headers: headers });
}
function handleOptions(request: Request): Response {
    if ( request.headers.get('Origin') !== null && request.headers.get('Access-Control-Request-Method') !== null && request.headers.get('Access-Control-Request-Headers') !== null ) {
        return new Response(null, { headers: corsHeaders });
    } else {
        return new Response(null, { headers: { Allow: 'GET, POST, OPTIONS' } });
    }
}

// Main Worker Logic
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Handle CORS preflight requests
        if (request.method === 'OPTIONS') { return handleOptions(request); }
		if (!env.DB) { console.error('D1 binding "DB" not found.'); return errorResponse('Database binding not configured', 500); }

		const url = new URL(request.url);

		try {
			// --- GET /api/leaderboard ---
			if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
				console.log('Handling GET /api/leaderboard (fetching ALL scores)');
                // Removed LIMIT 10 from the query
				const stmt = env.DB.prepare(
					'SELECT name, score_value FROM scores ORDER BY score_value DESC'
				);
				const { results } = await stmt.all<ScoreEntry>();
				console.log('Fetched scores:', results?.length);
				return jsonResponse({ success: true, results: results || [] });
			}

			// --- POST /api/scores ---
			if (url.pathname === '/api/scores' && request.method === 'POST') {
				let scoreData: ScorePostBody;
				const contentType = request.headers.get('content-type');
				if (!contentType || !contentType.includes('application/json')) return errorResponse('Request body must be JSON', 415);
				try { scoreData = await request.json<ScorePostBody>(); } catch (e) { return errorResponse('Invalid JSON body', 400); }

				const name = String(scoreData?.name || '').trim().toUpperCase().substring(0, 10);
				const newScore = parseInt(String(scoreData?.score_value ?? NaN));

				if (!name) return errorResponse('Name is required', 400);
				if (isNaN(newScore) || newScore < 0) return errorResponse('Invalid or missing score_value', 400);

				console.log(`Processing score: ${name} - ${newScore}`);

                // Check existing score
                const checkStmt = env.DB.prepare('SELECT score_value FROM scores WHERE name = ?');
                const existing = await checkStmt.bind(name).first<ScoreEntry>();

                if (existing) {
                    const existingScore = existing.score_value;
                    if (newScore > existingScore) {
                        console.log(`Updating score for ${name} from ${existingScore} to ${newScore}`);
                        const updateStmt = env.DB.prepare('UPDATE scores SET score_value = ? WHERE name = ?');
                        const info = await updateStmt.bind(newScore, name).run();
                        if (!info.success) throw new Error(`D1 Update failed: ${info.error || 'Unknown reason'}`);
                         return jsonResponse({ success: true, message: 'Score updated' });
                    } else {
                        console.log(`New score ${newScore} not higher than existing ${existingScore} for ${name}. No update.`);
                         return jsonResponse({ success: true, message: 'Existing score is higher or equal' });
                    }
                } else {
                    console.log(`Inserting new score for ${name}: ${newScore}`);
                    const insertStmt = env.DB.prepare('INSERT INTO scores (name, score_value) VALUES (?, ?)');
                    const info = await insertStmt.bind(name, newScore).run();
                    if (!info.success) throw new Error(`D1 Insert failed: ${info.error || 'Unknown reason'}`);
                    return jsonResponse({ success: true, message: 'Score saved' });
                }
			}

			// --- Not Found for other /api/ routes ---
            if (url.pathname.startsWith('/api/')) {
                 return errorResponse(`API Endpoint Not Found: ${request.method} ${url.pathname}`, 404);
            }
            // Let Pages handle non-API routes if using Pages Functions
            // @ts-ignore
            return context.next ? context.next() : errorResponse('Not Found', 404);


		} catch (e: unknown) {
			const error = e as Error;
			console.error('Worker Error:', error.message, error.stack);
            const errorMessage = (e instanceof Error && e.message) ? e.message : String(e);
			if (errorMessage.includes('D1_ERROR')) return errorResponse(`Database error: ${errorMessage}`, 500);
			return errorResponse(`Internal Server Error: ${errorMessage}`, 500);
		}
	},
};
