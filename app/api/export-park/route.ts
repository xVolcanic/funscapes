import { writeFile } from "node:fs/promises";
import path from "node:path";

/** Dev-only helper: saves an exported park GLB into public/models so it can be inspected and reused. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not available", { status: 404 });
  const requested = new URL(request.url).searchParams.get("name") ?? "funscapes-mini-park.glb";
  const name = path.basename(requested);
  if (!/^[\w.-]+\.(glb|png)$/.test(name)) return new Response("Bad name", { status: 400 });
  const buffer = Buffer.from(await request.arrayBuffer());
  const target = path.join(process.cwd(), "public", "models", name);
  await writeFile(target, buffer);
  return Response.json({ bytes: buffer.byteLength, path: target });
}
