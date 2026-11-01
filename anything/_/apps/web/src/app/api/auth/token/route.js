import { getToken } from '@auth/core/jwt';
import { authCookieOptions } from '../../../../__create/auth-cookie-options.js';

const headers = {
	'Content-Type': 'application/json',
	'Cache-Control': 'no-store',
	Pragma: 'no-cache',
};

function unauthorized() {
	return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
}

export async function GET(request) {
	const cookieOptions = authCookieOptions();
	if (!process.env.AUTH_SECRET || !cookieOptions) return unauthorized();
	try {
		const [token, jwt] = await Promise.all([
			getToken({
				req: request,
				secret: process.env.AUTH_SECRET,
				...cookieOptions,
				raw: true,
			}),
			getToken({
				req: request,
				secret: process.env.AUTH_SECRET,
				...cookieOptions,
			}),
		]);

		if (!jwt?.sub || !token) return unauthorized();

		return new Response(
			JSON.stringify({
				jwt: token,
				user: {
					id: jwt.sub,
					email: jwt.email,
					name: jwt.name,
				},
			}),
			{ headers }
		);
	} catch {
		return unauthorized();
	}
}
