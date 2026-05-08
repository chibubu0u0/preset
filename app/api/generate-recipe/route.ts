import { NextResponse } from "next/server";
import { queryGlobalExamples, queryStyleExamples } from "@/lib/notion";
import { generateRecipeForUserPhoto } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  imageUrl?: string;
  styleFamily?: string;
  useGlobalStyle?: boolean;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.imageUrl) {
      return NextResponse.json({ ok: false, error: "Missing imageUrl." }, { status: 400 });
    }

    const useGlobal = body.useGlobalStyle !== false;
    const examples = useGlobal
      ? await queryGlobalExamples(14)
      : await queryStyleExamples(body.styleFamily || "", 8);

    const analysis = await generateRecipeForUserPhoto({
      imageUrl: body.imageUrl,
      styleFamily: useGlobal ? "Eric 整體調色語言" : body.styleFamily,
      examples
    });

    return NextResponse.json({
      ok: true,
      styleFamily: useGlobal ? "Eric 整體調色語言" : body.styleFamily,
      mode: useGlobal ? "global" : "family",
      examplesUsed: examples.length,
      analysis
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unknown error" }, { status: 500 });
  }
}
