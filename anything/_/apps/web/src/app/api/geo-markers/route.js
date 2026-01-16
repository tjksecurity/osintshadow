import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const investigationId = url.searchParams.get("investigation_id");
    const riskLevel = url.searchParams.get("risk_level");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");

    let query = `
      SELECT gm.*, i.target_type, i.target_value, i.created_at as investigation_date
      FROM geo_markers gm
      JOIN investigations i ON gm.investigation_id = i.id
      WHERE i.user_id = $1
    `;
    const params = [session.user.id];

    if (investigationId) {
      query += ` AND gm.investigation_id = $${params.length + 1}`;
      params.push(investigationId);
    }

    if (riskLevel) {
      query += ` AND gm.risk_level = $${params.length + 1}`;
      params.push(riskLevel);
    }

    if (startDate) {
      query += ` AND i.created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND i.created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` ORDER BY gm.created_at DESC`;

    const markers = await sql(query, params);

    return Response.json({ markers });
  } catch (error) {
    console.error("Error fetching geo markers:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
