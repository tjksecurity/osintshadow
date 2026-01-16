import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

// Minimal ZIP generator (STORE, no compression) with data descriptors
export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Block exports for trial users (unless admin)
    const urows = await sql`
      SELECT email, role, subscription_plan FROM auth_users WHERE id = ${session.user.id}
    `;
    const user = urows[0];
    const adminEmail = "glossontravis@gmail.com";
    const isAdmin =
      user?.role === "admin" ||
      (user?.email || "").toLowerCase() === adminEmail;
    const isTrial =
      !isAdmin &&
      (!user?.subscription_plan || user?.subscription_plan === "trial");
    if (isTrial) {
      return new Response(
        JSON.stringify({
          error: "Trial accounts cannot export images",
          code: "TRIAL_EXPORT_BLOCKED",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    const { id } = params;

    // Verify investigation ownership
    const inv =
      await sql`SELECT id FROM investigations WHERE id = ${id} AND user_id = ${session.user.id}`;
    if (inv.length === 0) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Load images list from osint_raw
    const rows = await sql`
      SELECT data_json FROM osint_raw WHERE investigation_id = ${id}
    `;
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "No images available" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const osint = rows[0].data_json || {};
    const items = (osint.images?.items || []).slice(0, 300); // hard cap

    if (!items.length) {
      return new Response(JSON.stringify({ error: "No images found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch all images
    const fetched = await Promise.all(
      items.map(async (it, idx) => {
        const url = it?.url || it;
        try {
          const res = await fetch(url, { redirect: "follow" });
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          const ab = await res.arrayBuffer();
          const buf = new Uint8Array(ab);
          const crc = crc32(buf);
          const name = pickName(url, idx);
          return { ok: true, url, name, buf, size: buf.length, crc };
        } catch (e) {
          return { ok: false, url, error: e.message };
        }
      }),
    );

    const files = fetched.filter((f) => f.ok);
    if (!files.length) {
      return new Response(JSON.stringify({ error: "Failed to fetch images" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build ZIP bytes
    const parts = [];
    let offset = 0;
    const centers = [];
    const now = new Date();
    const dosTimeDate = dosTimeDateFromDate(now);

    for (const f of files) {
      const nameBytes = utf8Encode(f.name);
      // Local file header (with data descriptor flag)
      const local = new Uint8Array(30 + nameBytes.length);
      let p = 0;
      p = writeU32(local, p, 0x04034b50);
      p = writeU16(local, p, 20); // version needed
      p = writeU16(local, p, 0x0008); // general purpose flag: bit 3 set (data descriptor)
      p = writeU16(local, p, 0); // compression 0 = store
      p = writeU16(local, p, dosTimeDate.time);
      p = writeU16(local, p, dosTimeDate.date);
      p = writeU32(local, p, 0); // crc placeholder
      p = writeU32(local, p, 0); // comp size
      p = writeU32(local, p, 0); // uncomp size
      p = writeU16(local, p, nameBytes.length);
      p = writeU16(local, p, 0); // extra len
      local.set(nameBytes, p);

      parts.push(local);
      offset += local.length;

      // File data
      parts.push(f.buf);
      offset += f.size;

      // Data descriptor
      const desc = new Uint8Array(16);
      let q = 0;
      q = writeU32(desc, q, 0x08074b50); // signature
      q = writeU32(desc, q, f.crc >>> 0);
      q = writeU32(desc, q, f.size);
      q = writeU32(desc, q, f.size);
      parts.push(desc);
      offset += desc.length;

      // Central directory entry
      const cen = new Uint8Array(46 + nameBytes.length);
      let c = 0;
      c = writeU32(cen, c, 0x02014b50);
      c = writeU16(cen, c, 20); // version made by
      c = writeU16(cen, c, 20); // version needed
      c = writeU16(cen, c, 0x0008); // flags (data descriptor)
      c = writeU16(cen, c, 0); // compression
      c = writeU16(cen, c, dosTimeDate.time);
      c = writeU16(cen, c, dosTimeDate.date);
      c = writeU32(cen, c, f.crc >>> 0);
      c = writeU32(cen, c, f.size);
      c = writeU32(cen, c, f.size);
      c = writeU16(cen, c, nameBytes.length);
      c = writeU16(cen, c, 0); // extra len
      c = writeU16(cen, c, 0); // comment len
      c = writeU16(cen, c, 0); // disk number start
      c = writeU16(cen, c, 0); // internal attrs
      c = writeU32(cen, c, 0); // external attrs
      // offset of local header: sum of all previous parts lengths excluding this central we'll append later.
      // We need to compute local header offset for each file. Simplest approach: recompute by walking parts written so far minus central entries size.
      // Instead, track as we go: total bytes written before local header for this file.
      // We'll compute by summing lengths of already emitted parts minus this file's local+data+desc; we can't easily now, so maintain a running variable.
      // To do this properly, we need to record the offset of local header before writing it. Adjust approach:
      // We'll store offsetLocal on file object beforehand.
    }

    // Rebuild with correct local offsets: rerun assembly storing offsets first
    const fileWithOffsets = [];
    let dataOffset = 0;
    for (const f of files) {
      const nameBytes = utf8Encode(f.name);
      const localLen = 30 + nameBytes.length;
      const descLen = 16;
      fileWithOffsets.push({
        file: f,
        nameBytes,
        localOffset: dataOffset,
        localLen,
        descLen,
      });
      dataOffset += localLen + f.size + descLen;
    }

    // Now build actual buffers: locals + data + desc
    const parts2 = [];
    for (const entry of fileWithOffsets) {
      const { file: f, nameBytes, localOffset, localLen, descLen } = entry;
      const dos = dosTimeDate;
      const local = new Uint8Array(localLen);
      let p = 0;
      p = writeU32(local, p, 0x04034b50);
      p = writeU16(local, p, 20);
      p = writeU16(local, p, 0x0008);
      p = writeU16(local, p, 0);
      p = writeU16(local, p, dos.time);
      p = writeU16(local, p, dos.date);
      p = writeU32(local, p, 0);
      p = writeU32(local, p, 0);
      p = writeU32(local, p, 0);
      p = writeU16(local, p, nameBytes.length);
      p = writeU16(local, p, 0);
      local.set(nameBytes, p);
      parts2.push(local);
      parts2.push(f.buf);
      const desc = new Uint8Array(descLen);
      let q = 0;
      q = writeU32(desc, q, 0x08074b50);
      q = writeU32(desc, q, f.crc >>> 0);
      q = writeU32(desc, q, f.size);
      q = writeU32(desc, q, f.size);
      parts2.push(desc);
    }

    const centralStart = totalLength(parts2);
    const centralParts = [];
    for (const entry of fileWithOffsets) {
      const { file: f, nameBytes, localOffset } = entry;
      const cen = new Uint8Array(46 + nameBytes.length);
      let c = 0;
      c = writeU32(cen, c, 0x02014b50);
      c = writeU16(cen, c, 20);
      c = writeU16(cen, c, 20);
      c = writeU16(cen, c, 0x0008);
      c = writeU16(cen, c, 0);
      c = writeU16(cen, c, dosTimeDate.time);
      c = writeU16(cen, c, dosTimeDate.date);
      c = writeU32(cen, c, f.crc >>> 0);
      c = writeU32(cen, c, f.size);
      c = writeU32(cen, c, f.size);
      c = writeU16(cen, c, nameBytes.length);
      c = writeU16(cen, c, 0);
      c = writeU16(cen, c, 0);
      c = writeU16(cen, c, 0);
      c = writeU16(cen, c, 0);
      c = writeU32(cen, c, 0);
      c = writeU32(cen, c, localOffset);
      cen.set(nameBytes, c);
      centralParts.push(cen);
    }

    const centralSize = totalLength(centralParts);
    const endRec = new Uint8Array(22);
    let e = 0;
    e = writeU32(endRec, e, 0x06054b50);
    e = writeU16(endRec, e, 0); // disk
    e = writeU16(endRec, e, 0); // disk start
    e = writeU16(endRec, e, files.length);
    e = writeU16(endRec, e, files.length);
    e = writeU32(endRec, e, centralSize);
    e = writeU32(endRec, e, centralStart);
    e = writeU16(endRec, e, 0); // comment len

    const all = concatParts([...parts2, ...centralParts, endRec]);

    return new Response(all, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="images.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("zip build failed", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function utf8Encode(str) {
  return new TextEncoder().encode(str);
}
function writeU16(arr, p, v) {
  arr[p++] = v & 0xff;
  arr[p++] = (v >>> 8) & 0xff;
  return p;
}
function writeU32(arr, p, v) {
  arr[p++] = v & 0xff;
  arr[p++] = (v >>> 8) & 0xff;
  arr[p++] = (v >>> 16) & 0xff;
  arr[p++] = (v >>> 24) & 0xff;
  return p;
}
function totalLength(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  return n;
}
function concatParts(parts) {
  const out = new Uint8Array(totalLength(parts));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
function dosTimeDateFromDate(d) {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const seconds = Math.floor(d.getUTCSeconds() / 2);
  return {
    time: (hours << 11) | (minutes << 5) | seconds,
    date: ((year - 1980) << 9) | (month << 5) | day,
  };
}
function pickName(url, idx) {
  try {
    const u = new URL(url);
    const pathname = u.pathname;
    const base = pathname.split("/").pop() || `image_${idx + 1}`;
    const safe = base.replace(/[^A-Za-z0-9._-]+/g, "_");
    return safe || `image_${idx + 1}.jpg`;
  } catch {
    return `image_${idx + 1}.jpg`;
  }
}
// CRC32 implementation
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}
