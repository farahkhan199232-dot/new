import "server-only";

/**
 * Minimal server-side client for the YouCam API (Perfect Corp).
 * Flow for every feature: File API (get a presigned PUT URL) -> PUT bytes -> start task -> poll task -> result.
 * Docs: https://docs.perfectcorp.com/develop/quick_start_guide
 */

const BASE = (process.env.YOUCAM_API_BASE || "https://yce-api-01.makeupar.com").replace(/\/$/, "");
const KEY = process.env.YOUCAM_API_KEY || "";

export const youcamConfigured = () => Boolean(KEY) || process.env.YOUCAM_PROXY_AUTH === "1";

export class YouCamError extends Error {
  constructor(message: string, public code = "youcam_error", public status = 502) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  error_src_face_too_small: "Her face is too small in the photo. Use a closer selfie where the face fills most of the frame.",
  error_src_face_out_of_bound: "Part of her face is cut off. Use a selfie with the whole face in frame.",
  error_lighting_dark: "The photo is too dark. Try one taken in daylight.",
  error_below_min_image_size: "The photo is too small. Use one at least 480px on the short side.",
  error_no_face: "We couldn't find a face in that photo.",
};

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  if (KEY) h.Authorization = `Bearer ${KEY}`;
  return h;
}

async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  if (!youcamConfigured()) throw new YouCamError("YouCam API key is not configured on this deployment", "not_configured", 503);
  const res = await fetch(BASE + path, { method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const text = await res.text();
  let j: any;
  try { j = JSON.parse(text); } catch { throw new YouCamError(`YouCam returned ${res.status}`, "bad_response"); }
  if (!res.ok || (j.status && j.status >= 400)) {
    const code = j.error_code || j.error || `http_${res.status}`;
    throw new YouCamError(FRIENDLY[code] || `YouCam error: ${j.error || code}`, code, res.status === 401 ? 503 : 502);
  }
  return j as T;
}

/** Upload image bytes via the File API and return a file_id usable as src_file_id / ref_file_id. */
export async function uploadImage(bytes: Uint8Array, contentType: string, fileName: string): Promise<string> {
  const j = await api<any>("POST", "/s2s/v2.0/file", { files: [{ content_type: contentType, file_name: fileName, file_size: bytes.byteLength }] });
  const f = j?.data?.files?.[0];
  const rq = f?.requests?.[0];
  if (!f?.file_id || !rq?.url) throw new YouCamError("YouCam File API returned no upload URL", "bad_response");
  const put = await fetch(rq.url, { method: rq.method || "PUT", headers: rq.headers, body: Buffer.from(bytes) });
  if (!put.ok) throw new YouCamError(`Uploading the photo to YouCam failed (${put.status})`, "upload_failed");
  return f.file_id as string;
}

/** Start a task (e.g. "skin-analysis", "makeup-vto", "2d-vto/earring", "cloth") and poll until it finishes. */
export async function runTask(task: string, body: Record<string, unknown>, opts: { version?: string; timeoutMs?: number } = {}): Promise<any> {
  const v = opts.version || "v2.0";
  const start = await api<any>("POST", `/s2s/${v}/task/${task}`, body);
  const id = start?.data?.task_id;
  if (!id) throw new YouCamError("YouCam did not return a task id", "bad_response");
  const deadline = Date.now() + (opts.timeoutMs ?? 50_000);
  let wait = 1500;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(wait + 500, 3000);
    const s = await api<any>("GET", `/s2s/${v}/task/${task}/${encodeURIComponent(id)}`);
    const st = s?.data?.task_status;
    if (st === "success") return s.data.results;
    if (st === "error") {
      const code = s.data.error || "task_error";
      throw new YouCamError(FRIENDLY[code] || `YouCam ${task} failed: ${s.data.error_message || code}`, code, 422);
    }
  }
  throw new YouCamError("YouCam is taking longer than usual. Try again in a minute.", "timeout", 504);
}

export async function fetchResult(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new YouCamError(`Could not download the YouCam result (${r.status})`, "download_failed");
  const bytes = new Uint8Array(await r.arrayBuffer());
  // S3 serves results as binary/octet-stream; sniff the real type so browsers render it.
  const contentType = bytes[0] === 0x89 && bytes[1] === 0x50 ? "image/png" : bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : r.headers.get("content-type") || "image/jpeg";
  return { bytes, contentType };
}

/** Unit balance, used by /api/health to prove the key works without spending units. */
export async function unitBalance(): Promise<number> {
  const j = await api<any>("GET", "/s2s/v1.0/client/credit");
  return (j.results || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
}

// ---- Feature wrappers -------------------------------------------------------------------------

export const SKIN_ACTIONS = ["acne", "pore", "texture", "moisture", "oiliness", "redness", "dark_circle_v2", "radiance"];

/** AI Skin Analysis (SD, 8 concerns). Returns per-concern scores and mask URLs. */
export async function skinAnalysis(srcFileId: string) {
  const r = await runTask("skin-analysis", { src_file_id: srcFileId, dst_actions: SKIN_ACTIONS, miniserver_args: { enable_mask_overlay: true }, format: "json" });
  const out: { type: string; ui_score?: number; raw_score?: number; mask_urls?: string[] }[] = r?.output || [];
  return out.filter((o) => typeof o.ui_score === "number");
}

/** AI Facial Color Tones Analyzer: skin / lip / eye / hair colours. */
export async function skinTone(srcFileId: string) {
  const r = await runTask("skin-tone-analysis", { src_file_id: srcFileId, face_angle_strictness_level: "medium" });
  return r?.color as { skin_color: string; lip_color?: string; eye_color_name?: string; hair_color_name?: string };
}

export async function lipTryOn(srcFileId: string, hex: string, texture: "matte" | "satin" | "gloss") {
  const palette: Record<string, unknown> = { color: hex, texture, colorIntensity: 70 };
  if (texture === "gloss") Object.assign(palette, { gloss: 60, transparencyIntensity: 40 });
  const r = await runTask("makeup-vto", {
    src_file_id: srcFileId, version: "1.0",
    effects: [{ category: "lip_color", shape: { name: "original" }, palettes: [palette], style: { type: "full" } }],
  });
  return r.url as string;
}

export async function earringTryOn(srcFileId: string, earringFileId: string) {
  const r = await runTask("2d-vto/earring", {
    src_file_id: srcFileId, ref_file_ids: [earringFileId], source_info: { name: srcFileId },
    object_infos: [{ name: earringFileId, parameter: { earring_need_remove_background: true } }],
  });
  return r.url as string;
}

export async function clothesTryOn(srcFileId: string, garmentFileId: string) {
  const r = await runTask("cloth", { src_file_id: srcFileId, ref_file_id: garmentFileId, garment_category: "upper_body" });
  return r.url as string;
}
