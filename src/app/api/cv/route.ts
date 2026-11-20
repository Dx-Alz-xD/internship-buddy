import { extractSkills } from "@/lib/skills";
import type { CvParseResult } from "@/lib/types";

const MAX_BYTES = 5 * 1024 * 1024;

async function readText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  if (name.endsWith(".docx") || file.type.includes("officedocument.wordprocessingml")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    return value;
  }
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    return new TextDecoder().decode(buf);
  }
  throw new Error("unsupported");
}

function findLinks(text: string): CvParseResult["links"] {
  const grab = (re: RegExp) => {
    const m = text.match(re);
    return m ? (m[0].startsWith("http") ? m[0] : `https://${m[0]}`) : "";
  };
  const linkedin = grab(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i);
  const github = grab(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+\/?/i);
  const portfolio =
    (text.match(/https?:\/\/(?!(?:[a-z]{2,3}\.)?linkedin\.com|(?:www\.)?github\.com)[A-Za-z0-9.-]+\.[a-z]{2,}(?:\/[^\s)]*)?/i) ?? [""])[0] ?? "";
  return { linkedin, github, portfolio };
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Send the CV as a file upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file was attached." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That file is over 5 MB. Export a smaller PDF and try again." }, { status: 413 });

  let text: string;
  try {
    text = await readText(file);
  } catch (e) {
    const unsupported = e instanceof Error && e.message === "unsupported";
    return Response.json(
      { error: unsupported ? "Upload a PDF, DOCX or TXT file." : "This file could not be read. If it is a scanned PDF, export a text-based PDF instead." },
      { status: 422 },
    );
  }

  const normalised = text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const result: CvParseResult = {
    text: normalised.slice(0, 20_000),
    wordCount: normalised ? normalised.split(/\s+/).length : 0,
    skills: extractSkills(normalised),
    links: findLinks(normalised),
    emails: Array.from(new Set(normalised.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])).slice(0, 3),
  };
  return Response.json(result);
}
