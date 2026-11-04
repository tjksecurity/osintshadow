import { auth } from '@/auth';
import sql from '@/app/api/utils/sql';
import { checkUserCredits } from '../../investigations/utils/auth.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const headers = { 'Cache-Control': 'private, no-store' };

// Read the signed-in account's current entitlement. This endpoint never grants
// credits, changes roles/plans, or trusts an account ID supplied by the client.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    }
    const result = await checkUserCredits(sql, session.user.id);
    if (!result.found) {
      return Response.json({ error: 'Account not found' }, { status: 404, headers });
    }
    const remaining = Number(result.user.monthly_remaining ?? 0);
    if (!Number.isFinite(remaining)) throw new Error('Invalid credit balance');
    return Response.json({
      user_id: String(session.user.id),
      credits_unlimited: result.isAdmin,
      monthly_remaining: remaining,
      is_trial: !result.isAdmin && (!result.user.subscription_plan || result.user.subscription_plan === 'trial'),
    }, { headers });
  } catch {
    return Response.json({ error: 'Could not load current credits' }, { status: 503, headers });
  }
}
