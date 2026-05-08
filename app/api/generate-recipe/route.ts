import { NextResponse } from "next/server";
import { queryStyleExamples } from "@/lib/notion";
import { generateRecipeForUserPhoto } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  imageUrl?: string;
  styleFamily?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.imageUrl) {
      return NextResponse.json({ ok: false, error: "Missing imageUrl." }, { status: 400 });
    }
    if (!body.styleFamily) {
      return NextResponse.json({ ok: false, error: "Missing styleFamily." }, { status: 400 });
    }

    const examples = await queryStyleExamples(body.styleFamily, 8);
    const analysis = await generateRecipeForUserPhoto({
      imageUrl: body.imageUrl,
      styleFamily: body.styleFamily,
      examples
    });

    return NextResponse.json({ ok: true, styleFamily: body.styleFamily, examplesUsed: examples.length, analysis });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unknown error" }, { status: 500 });
  }
}
