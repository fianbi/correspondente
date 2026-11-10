import { NotFoundError } from "@corr/core";
import {
  getFormTemplate,
  getOrg,
  getPerson,
  getProcess,
  getProcessFieldValues,
  listPersonIncomes,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/server/storage";
import { desenharModeloPronto, preencherFormulario } from "@/server/pdf/formulario";
import { origemPronta } from "@/server/pdf/modelos";

/** Gera o formulário do banco preenchido com os dados do processo. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; templateId: string }> },
) {
  const ctx = await requireOrgContext();
  const { id, templateId: parametro } = await params;

  // A rota termina em `.pdf` para o navegador tratar como documento; o
  // parâmetro dinâmico vem com a extensão colada e precisa ser limpo.
  const templateId = parametro.replace(/\.pdf$/i, "");

  try {
    const [template, process, org] = await Promise.all([
      getFormTemplate(ctx, templateId),
      getProcess(ctx, id),
      getOrg(ctx),
    ]);

    const [person, fieldValues, incomes] = await Promise.all([
      getPerson(ctx, process.personId),
      getProcessFieldValues(ctx, id),
      listPersonIncomes(ctx, process.personId),
    ]);

    const dados = {
      person: person as unknown as Record<string, unknown>,
      process: process as unknown as Record<string, unknown>,
      org: org as unknown as Record<string, unknown>,
      fieldValues,
      incomes,
    };
    const respostas = Object.fromEntries(new URL(request.url).searchParams);

    // Modelo pronto é desenhado a partir do código (fundo + valores); os
    // antigos, enviados em PDF com campos, ainda são preenchidos campo a campo.
    const pronto = origemPronta(template);
    let pdf: Uint8Array;
    if (pronto) {
      pdf = await desenharModeloPronto(pronto, dados, respostas);
    } else {
      const { data, error } = await getSupabaseAdmin()
        .storage.from(DOCUMENTS_BUCKET)
        .download(template.storagePath);
      if (error || !data) {
        return new Response("Modelo não encontrado no armazenamento.", { status: 502 });
      }
      ({ pdf } = await preencherFormulario(
        await data.arrayBuffer(),
        template.fieldMap,
        dados,
        respostas,
      ));
    }

    const nomeArquivo = `${template.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-${process.number}.pdf`;

    return new Response(pdf as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${nomeArquivo}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) return new Response(error.message, { status: 404 });
    throw error;
  }
}
