import { PROCESS_STAGE_LABELS } from "../domain/process";
import { requireField } from "./catalog";
import type { FlowDef } from "./types";

/**
 * Fluxo padrão, montado sobre o funil do crédito imobiliário brasileiro.
 *
 * É só o ponto de partida: cada escritório recebe uma cópia disto no banco e
 * pode reordenar fases, criar blocos e escolher outros campos do catálogo —
 * tudo sem deploy, porque fluxo aqui é dado, não código.
 */
export const DEFAULT_FLOW: FlowDef = {
  key: "padrao",
  name: "Fluxo padrão",
  stages: [
    {
      key: "cadastro",
      label: PROCESS_STAGE_LABELS.cadastro,
      blocks: [
        {
          key: "proposta",
          title: "Dados da proposta",
          fields: [
            "process.bank",
            "process.agency",
            "process.modality",
            "process.amortization",
            "process.indexer",
            "process.proposal_number",
            "process.contract_number",
            "process.term_months",
          ],
        },
        {
          key: "valores",
          title: "Valores",
          description: "Digite como preferir: 350000, 350.000,00 ou R$ 350.000,00.",
          fields: ["process.property_value", "process.financed_value"],
        },
        {
          key: "imovel",
          title: "Imóvel",
          fields: ["process.property_address", "process.property_registration"],
        },
        {
          key: "parceiros",
          title: "Parceiros e responsável",
          fields: [
            "process.real_estate_agency",
            "process.broker",
            "process.assigned_to",
            "process.notes",
          ],
        },
      ],
      requirements: [
        { documentType: "rg", required: true },
        { documentType: "comprovante_residencia", required: true },
        { documentType: "comprovante_renda", required: true },
        { documentType: "extrato_fgts", required: false, note: "Quando houver uso de FGTS." },
      ],
    },
    {
      key: "correspondente",
      label: PROCESS_STAGE_LABELS.correspondente,
      blocks: [
        {
          key: "analise",
          title: "Análise de crédito",
          fields: [
            "credit.authorization_type",
            "credit.analysis_status",
            "process.credit_valid_until",
            "credit.fgts_three_years",
          ],
        },
        {
          key: "calculo",
          title: "Cálculo financeiro",
          fields: [
            "credit.appraisal_value",
            "credit.outstanding_balance",
            "process.approved_value",
            "process.subsidy",
            "process.fgts",
            "credit.installment_value",
          ],
        },
        {
          key: "observacoes",
          title: "Observações",
          fields: ["credit.analysis_notes"],
        },
      ],
    },
    {
      key: "montagem",
      label: PROCESS_STAGE_LABELS.montagem,
      blocks: [
        {
          key: "comercial",
          title: "Comercial",
          description: "Produtos bancários que acompanham o pacote.",
          fields: [
            "assembly.origin",
            "assembly.checking_account",
            "assembly.overdraft_value",
            "assembly.savings_account",
            "assembly.credit_card",
          ],
        },
      ],
    },
    {
      key: "conformidade_contrato",
      label: PROCESS_STAGE_LABELS.conformidade_contrato,
      blocks: [
        {
          key: "conformidade",
          title: "Análise de conformidade",
          fields: ["compliance.occurred_at", "compliance.notes"],
        },
      ],
    },
    {
      key: "agencia",
      label: PROCESS_STAGE_LABELS.agencia,
      blocks: [
        {
          key: "entrevista",
          title: "Entrevista",
          fields: ["agency.interview_at", "agency.interview_done", "agency.manager_name"],
        },
        {
          key: "assinatura",
          title: "Assinatura do contrato",
          fields: [
            "agency.signature_forecast",
            "agency.signed_at",
            "agency.contract_signed",
            "agency.used_value",
          ],
        },
      ],
    },
    {
      key: "cri",
      label: PROCESS_STAGE_LABELS.cri,
      blocks: [
        {
          key: "registro",
          title: "Contrato em registro",
          fields: [
            "cri.fees_paid_at",
            "cri.protocol_number",
            "cri.protocol_at",
            "cri.registered_at",
          ],
        },
      ],
      requirements: [{ documentType: "matricula_imovel", required: true }],
    },
  ],
};

/**
 * Confere que todo campo citado por um fluxo existe no catálogo. Chamado no
 * seed e nos testes: fluxo apontando para campo inexistente é erro de
 * configuração que precisa estourar cedo, não virar campo em branco na tela.
 */
export function validateFlow(flow: FlowDef): void {
  for (const stage of flow.stages) {
    for (const block of stage.blocks) {
      for (const key of block.fields) {
        requireField(key);
      }
    }
  }
}
