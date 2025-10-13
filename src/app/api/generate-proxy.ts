import { NextResponse } from "next/server";

export const runtime = "nodejs";

const REPLICATE_API = "https://api.replicate.com/v1";
const MODEL = "qwen/qwen-image-edit";

export async function POST(req: Request) {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("Token manquant");

    const input = await req.json();
    const res = await fetch(`${REPLICATE_API}/models/${MODEL}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({ input }),
    });

    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}