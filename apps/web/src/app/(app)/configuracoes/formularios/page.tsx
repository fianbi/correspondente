import type { Metadata } from "next";
import { listFormTemplates } from "@corr/db";
import { PROCESS_FIELDS } from "@corr/core";
import { requireOrgContext } from "@/server/session";
import { PageHeader } from "@/components/shell/page-header";
import { TemplatesPanel } from "./templates-panel";

export const metadata: Metadata = { title: "Formulários" };

/**
 * Chaves que um campo de PDF pode receber.
 *
 * Junta o cadastro da pessoa, os dados do escritório e o catálogo de campos do
 * processo — é o mesmo catálogo que monta as telas das etapas.
 */
const CHAVES_DE_PESSOA: [string, string][] = [
  ["person.fullName", "Pessoa — nome completo"],
  ["person.cpf", "Pessoa — CPF"],
  ["person.birthDate", "Pessoa — data de nascimento"],
  ["person.motherName", "Pessoa — nome da mãe"],
  ["person.fatherName", "Pessoa — nome do pai"],
  ["person.docNumber", "Pessoa — número do documento"],
  ["person.docIssuer", "Pessoa — órgão emissor"],
  ["person.pis", "Pessoa — PIS/NIS"],
  ["person.maritalStatus", "Pessoa — estado civil"],
  ["person.spouseName", "Pessoa — nome do cônjuge"],
  ["person.spouseCpf", "Pessoa — CPF do cônjuge"],
  ["person.email", "Pessoa — e-mail"],
  ["person.phone", "Pessoa — telefone"],
  ["person.zipCode", "Pessoa — CEP"],
  ["person.street", "Pessoa — logradouro"],
  ["person.streetNumber", "Pessoa — número"],
  ["person.district", "Pessoa — bairro"],
  ["person.city", "Pessoa — cidade"],
  ["person.uf", "Pessoa — UF"],
];

const CHAVES_DE_ESCRITORIO: [string, string][] = [
  ["org.name", "Escritório — nome"],
  ["org.cnpj", "Escritório — CNPJ"],
  ["org.internalCode", "Escritório — código do correspondente"],
  ["org.city", "Escritório — cidade"],
  ["org.phone", "Escritório — telefone"],
];

export default async function FormulariosPage() {
  const ctx = await requireOrgContext();
  const templates = await listFormTemplates(ctx);

  const opcoes = [
    ...CHAVES_DE_PESSOA,
    ...CHAVES_DE_ESCRITORIO,
    ...PROCESS_FIELDS.map((campo) => [campo.key, `Processo — ${campo.label}`] as [string, string]),
  ].map(([value, label]) => ({ value, label }));

  return (
    <>
      <PageHeader
        title="Formulários"
        description="Modelos em PDF do banco, preenchidos automaticamente com os dados do processo."
      />

      <main className="max-w-4xl p-6">
        <TemplatesPanel
          templates={templates.map((template) => ({
            id: template.id,
            name: template.name,
            description: template.description,
            detectedFields: template.detectedFields,
            fieldMap: template.fieldMap,
          }))}
          opcoes={opcoes}
        />
      </main>
    </>
  );
}
