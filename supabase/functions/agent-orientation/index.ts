/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// Agent Orientation — Aminata (Alert'i Communauté)
// Architecture: community_knowledge retrieval + Gemini 2.0 Flash formulation
// Fallback: structured retrieval-only if GEMINI_API_KEY absent

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Source {
  id: string;
  titre: string;
  contenu: string;
  categorie: string;
  porteur: string | null;
  source_type: string;
  quartier: string | null;
  region: string | null;
}

interface RequestBody {
  message: string;
  history?: { role: string; content: string }[];
  commune?: string;
}

const AMINATA_PERSONALITY = `Tu es Aminata, une experte bienveillante en gestion des inondations en Afrique de l'Ouest et au Sahel. Tu combines savoir scientifique et savoirs communautaires locaux. Tu réponds en français, de manière chaleureuse, claire et pratique.

Règles :
- Tu es chaleureuse et empathique, tu vouvoies l'utilisateur.
- Tu peux répondre à des salutations, remerciements, et petites conversations avec ta personnalité (pas besoin de chercher en base pour "bonjour" ou "merci").
- Pour les questions sur les inondations, tu t'appuies UNIQUEMENT sur le contexte communautaire fourni. Ne jamais inventer de faits.
- Cite les sources (titre des fiches) en fin de réponse quand tu utilises le contexte.
- Priorise les informations du quartier/commune de l'utilisateur si disponibles.
- Français clair, ton calme et communautaire, 80-200 mots max.
- Si la question est hors sujet (politique, sport, etc.), redirige gentiment vers ton domaine d'expertise sans être condescendante.
- En urgence, rappelle de contacter la protection civile (18) ou d'utiliser l'onglet SOS.
- Ne jamais donner de diagnostic médical.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as RequestBody;
    const { message, history = [], commune } = body;

    if (!message?.trim()) {
      return json({ error: "message requis" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Determine if this is a conversational message (no DB lookup needed)
    const isConversational = detectConversational(message);

    let sources: Source[] = [];
    let contextBlock = "";

    if (!isConversational) {
      // Extract keywords and search community_knowledge
      const keywords = extractKeywords(message);
      sources = await searchCommunityKnowledge(supabase, keywords, commune);
      contextBlock = buildContextBlock(sources);
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (geminiKey) {
      // Gemini path: full AI agent
      try {
        const reply = await callGemini(
          geminiKey,
          message,
          contextBlock,
          history.slice(-4),
          commune,
        );

        return json({
          reply,
          sources: sources.map(formatSourceForClient),
          model: "gemini-2.0-flash",
          generatedBy: "ai",
        });
      } catch (geminiError) {
        console.error("Gemini error, falling back to retrieval:", geminiError);
        // Fall through to retrieval-only
      }
    }

    // Fallback: retrieval-only mode
    const reply = buildRetrievalReply(message, sources, isConversational);
    return json({
      reply,
      sources: sources.map(formatSourceForClient),
      model: "retrieval-only",
      generatedBy: "local",
    });
  } catch (e) {
    console.error("agent-orientation error:", e);
    return json({ error: String(e) }, 500);
  }
});

// --- Helpers ---

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Detect greetings, thanks, farewells — no DB lookup needed
function detectConversational(msg: string): boolean {
  const trimmed = msg.trim().toLowerCase();
  const patterns = [
    /^(bonjour|bonsoir|salut|hello|hi|hey|coucou|salam|yo|bjr|bsr|wesh)[\s!.,?]*$/,
    /^(merci|ok|d'accord|parfait|super|genial|top|cool|nice|bien)[\s!.,?]*$/,
    /^(au revoir|bye|ciao|bonne journ[eé]e|bonne soir[eé]e|bonne nuit|a bient[oô]t|à bient[oô]t)[\s!.,?]*$/,
    /^([çc]a va|comment vas-tu|comment tu vas|tu vas bien|comment [çc]a va)[\s!.,?]*$/,
    /^(oui|non|ouais|nan)[\s!.,?]*$/,
    /^bonjour aminata[\s!.,?]*$/,
    /^salut aminata[\s!.,?]*$/,
    /^merci (beaucoup|bien|aminata)[\s!.,?]*$/,
  ];
  return patterns.some((p) => p.test(trimmed));
}

const STOP_WORDS = new Set([
  "pour", "dans", "avec", "sans", "sous", "sur", "les", "des", "une", "est",
  "que", "qui", "quoi", "comment", "quand", "faire", "peut", "plus", "tout",
  "mon", "mes", "ton", "tes", "son", "ses", "notre", "votre", "leur", "cette",
  "sont", "être", "avoir", "fait", "comme", "mais", "donc", "alors",
]);

const SHORT_KEYWORDS = new Set([
  "eau", "crue", "pluie", "ile", "sol", "mer", "sos", "rue",
]);

function extractKeywords(q: string): string[] {
  const lower = q.toLowerCase();
  const words = lower
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w) && (w.length > 3 || SHORT_KEYWORDS.has(w)));

  const expanded = new Set(words);

  // Semantic expansion for common flood-related queries
  if (/niger|fleuve|quai|crue/i.test(lower)) {
    expanded.add("niger"); expanded.add("fleuve"); expanded.add("crue");
  }
  if (/signe|avant|precurseur|précurseur|annonce/i.test(lower)) {
    expanded.add("signe"); expanded.add("precurseur");
  }
  if (/inond|crue|monte|pleut|pluie/i.test(lower)) {
    expanded.add("inondation"); expanded.add("pluie");
  }
  if (/après|apres|suite|maladie|cholera/i.test(lower)) {
    expanded.add("apres"); expanded.add("inondation");
  }
  if (/quartier|monter|evacu|évacu|toit|mosquee|mosquée/i.test(lower)) {
    expanded.add("evacuation"); expanded.add("quartier");
  }
  if (/zone|risque|danger/i.test(lower)) {
    expanded.add("zone"); expanded.add("risque");
  }

  return [...expanded].slice(0, 12);
}

async function searchCommunityKnowledge(
  supabase: ReturnType<typeof createClient>,
  keywords: string[],
  commune?: string,
): Promise<Source[]> {
  if (keywords.length === 0) return [];

  const select = "id, titre, contenu, categorie, porteur, source_type, quartier, region, commune, confiance";

  // Build OR filter across titre, contenu, categorie, quartier, region
  const orParts = keywords.flatMap((kw) => [
    `titre.ilike.%${kw}%`,
    `contenu.ilike.%${kw}%`,
    `categorie.ilike.%${kw}%`,
    `quartier.ilike.%${kw}%`,
    `region.ilike.%${kw}%`,
  ]);

  const query = supabase
    .from("community_knowledge")
    .select(select)
    .eq("validated", true)
    .or(orParts.join(","))
    .order("confiance", { ascending: false })
    .limit(20);

  const { data, error } = await query;
  if (error) {
    console.error("Knowledge search error:", error);
    return [];
  }

  if (!data?.length) return [];

  // Score and rank results
  const scored = data.map((row: any) => ({
    row: row as Source,
    score: scoreResult(row, keywords, commune),
  }));
  scored.sort((a: any, b: any) => b.score - a.score);

  return scored.slice(0, 5).map((s: any) => s.row);
}

function scoreResult(
  row: any,
  keywords: string[],
  commune?: string,
): number {
  const titre = (row.titre ?? "").toLowerCase();
  const contenu = (row.contenu ?? "").toLowerCase();
  let score = row.confiance ?? 3;

  for (const kw of keywords) {
    if (titre.includes(kw)) score += 4;
    else if (contenu.includes(kw)) score += 2;
  }

  if (commune && row.commune?.toLowerCase().includes(commune.toLowerCase())) {
    score += 6;
  }

  return score;
}

function buildContextBlock(sources: Source[]): string {
  if (sources.length === 0) return "";

  return sources.map((s) =>
    `[Fiche: ${s.titre}] (catégorie: ${s.categorie ?? "général"}, porteur: ${s.porteur ?? "communauté"}, quartier: ${s.quartier ?? "général"})\n${s.contenu}`
  ).join("\n\n");
}

async function callGemini(
  apiKey: string,
  message: string,
  contextBlock: string,
  history: { role: string; content: string }[],
  commune?: string,
): Promise<string> {
  const contents: any[] = [];

  // Add conversation history
  for (const h of history) {
    contents.push({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    });
  }

  // Build the user message with context
  let userPrompt = "";
  if (contextBlock) {
    userPrompt += `[Contexte — fiches communautaires pertinentes]\n${contextBlock}\n\n`;
  }
  if (commune) {
    userPrompt += `[Commune de l'utilisateur: ${commune}]\n\n`;
  }
  userPrompt += `Message de l'utilisateur: ${message}`;

  contents.push({ role: "user", parts: [{ text: userPrompt }] });

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: AMINATA_PERSONALITY }] },
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 800,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  return text;
}

function buildRetrievalReply(
  message: string,
  sources: Source[],
  isConversational: boolean,
): string {
  // For conversational messages without Gemini, give a static friendly reply
  if (isConversational) {
    const trimmed = message.trim().toLowerCase();
    if (/^(bonjour|bonsoir|salut|hello|hi|hey|coucou|salam)/i.test(trimmed)) {
      return "Bonjour ! Je suis Aminata, votre guide sur les inondations en Afrique de l'Ouest. Comment puis-je vous aider aujourd'hui ?";
    }
    if (/^(merci|je (te|vous) remercie)/i.test(trimmed)) {
      return "Je vous en prie ! N'hésitez pas si vous avez d'autres questions sur les inondations ou la prévention.";
    }
    if (/^(au revoir|bye|ciao|bonne)/i.test(trimmed)) {
      return "Au revoir ! Prenez soin de vous et restez vigilant. Je suis là si vous avez besoin.";
    }
    return "Je suis là pour vous aider ! Posez-moi une question sur les inondations — signes avant-coureurs, zones à risque, ou conseils de sécurité.";
  }

  // No sources found
  if (sources.length === 0) {
    return "Je n'ai pas trouvé d'information documentée sur ce sujet dans notre base communautaire. Essayez de reformuler votre question, ou consultez l'onglet Savoir pour parcourir les fiches disponibles.";
  }

  // Build structured reply from sources
  const lines = ["Voici ce que la communauté a documenté :", ""];
  for (const s of sources) {
    lines.push(`• **${s.titre}** (${s.porteur ?? "communauté"})`);
    // Truncate long content
    const content = s.contenu ?? "";
    const excerpt = content.length > 150 ? content.slice(0, 150) + "…" : content;
    lines.push(`  ${excerpt}`);
    lines.push("");
  }
  lines.push("_Mode recherche seule — la formulation IA n'est pas disponible actuellement._");
  return lines.join("\n");
}

function formatSourceForClient(s: Source) {
  return {
    id: s.id,
    titre: s.titre,
    categorie: s.categorie,
    porteur: s.porteur,
    source_type: s.source_type,
    quartier: s.quartier,
  };
}
