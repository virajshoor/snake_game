/**
 * Cloudflare Worker for Snake Game Leaderboard API (TypeScript)
 * - Includes CORS headers.
 * - Updates score only if the new score is higher for a given name.
 * - Interacts with a D1 database bound as 'DB'.
 * - Assumes D1 table 'scores' with columns 'name' (TEXT), 'score_value' (INTEGER), and 'time_score' (INTEGER).
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
	time_score?: number;
}

interface ScoreEntry {
    name: string;
    score_value: number;
    time_score?: number;
}

// CORS Headers - Update to accept any origin
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
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
    return new Response(null, { 
        headers: corsHeaders
    });
}

// Main Worker Logic
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Handle CORS preflight requests
        if (request.method === 'OPTIONS') { return handleOptions(request); }
		if (!env.DB) { console.error('D1 binding "DB" not found.'); return errorResponse('Database binding not configured', 500); }

		const url = new URL(request.url);
        console.log(`Handling ${request.method} request for ${url.pathname}`);

		try {
			// --- GET /api/leaderboard ---
			if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
				console.log('Handling GET /api/leaderboard (fetching ALL scores)');
                // Include time_score in the query
				const stmt = env.DB.prepare(
					'SELECT name, score_value, time_score FROM scores ORDER BY score_value DESC'
				);
				const { results } = await stmt.all<ScoreEntry>();
				console.log('Fetched scores:', results?.length);
				return jsonResponse({ success: true, results: results || [] });
			}

			// Support HEAD requests for checking API availability
			if (request.method === 'HEAD') {
				return new Response(null, { 
					status: 200, 
					headers: corsHeaders
				});
			}

			// --- POST /api/scores ---
			if (url.pathname === '/api/scores' && request.method === 'POST') {
				let scoreData: ScorePostBody;
				const contentType = request.headers.get('content-type');
				if (!contentType || !contentType.includes('application/json')) return errorResponse('Request body must be JSON', 415);
				try { scoreData = await request.json<ScorePostBody>(); } catch (e) { return errorResponse('Invalid JSON body', 400); }

				const name = String(scoreData?.name || '').trim().toUpperCase().substring(0, 10);
				const newScore = parseInt(String(scoreData?.score_value ?? NaN));
				const timeScore = parseInt(String(scoreData?.time_score ?? 0));

				if (!name) return errorResponse('Name is required', 400);
				if (isNaN(newScore) || newScore < 0) return errorResponse('Invalid or missing score_value', 400);

				console.log(`Processing score: ${name} - ${newScore} (time: ${timeScore})`);

				// Check existing score
				const checkStmt = env.DB.prepare('SELECT score_value, time_score FROM scores WHERE name = ?');
				const existing = await checkStmt.bind(name).first<ScoreEntry>();

				if (existing) {
					const existingScore = existing.score_value;
					// Always update time_score for an existing player, even if the score isn't higher
					if (newScore > existingScore) {
						// Update score and time_score when score is higher
						console.log(`Updating score and time for ${name} from ${existingScore} to ${newScore} with time ${timeScore}`);
						const updateStmt = env.DB.prepare('UPDATE scores SET score_value = ?, time_score = ? WHERE name = ?');
						const info = await updateStmt.bind(newScore, timeScore, name).run();
						if (!info.success) throw new Error(`D1 Update failed: ${info.error || 'Unknown reason'}`);
						return jsonResponse({ success: true, message: 'Score and time updated' });
					} else if (timeScore > 0) {
						// Just update time_score when score is not higher but we have a valid time
						console.log(`Keeping score ${existingScore} but updating time to ${timeScore} for ${name}`);
						const updateTimeStmt = env.DB.prepare('UPDATE scores SET time_score = ? WHERE name = ?');
						const info = await updateTimeStmt.bind(timeScore, name).run();
						if (!info.success) throw new Error(`D1 Update time failed: ${info.error || 'Unknown reason'}`);
						return jsonResponse({ success: true, message: 'Time score updated' });
					} else {
						console.log(`No updates needed for ${name}. Score ${newScore} not higher than ${existingScore} and time ${timeScore} is invalid.`);
						return jsonResponse({ success: true, message: 'No updates needed' });
					}
				} else {
					console.log(`Inserting new score for ${name}: ${newScore} with time ${timeScore}`);
					const insertStmt = env.DB.prepare('INSERT INTO scores (name, score_value, time_score) VALUES (?, ?, ?)');
					const info = await insertStmt.bind(name, newScore, timeScore).run();
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
