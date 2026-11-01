import { getToken } from '@auth/core/jwt';
import { getContext } from 'hono/context-storage';
import { authCookieOptions } from '../auth-cookie-options.js';

export default function CreateAuth() {
	const auth = async () => {
		const cookieOptions = authCookieOptions();
		if (!process.env.AUTH_SECRET || !cookieOptions) return;
		const c = getContext();
		const token = await getToken({
			req: c.req.raw,
			secret: process.env.AUTH_SECRET,
			...cookieOptions,
		});
		if (token?.sub) {
			return {
				user: {
					id: token.sub,
					email: token.email,
					name: token.name,
					image: token.picture,
				},
				expires: token.exp == null ? undefined : String(token.exp),
			};
		}
	};
	return {
		auth,
	};
}
