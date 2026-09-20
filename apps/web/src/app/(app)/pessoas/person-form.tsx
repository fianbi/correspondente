"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  EDUCATION_LEVEL_LABELS,
  HOUSING_SITUATION_LABELS,
  ID_DOCUMENT_TYPE_LABELS,
  MARITAL_STATUS_LABELS,
  NATIONALITY_LABELS,
  PROPERTY_TYPE_LABELS,
  SEX_LABELS,
  UFS,
  formatCpf,
  requiresSpouse,
  type IdDocumentType,
  type MaritalStatus,
  type Nationality,
  portais,
} from "@corr/core";
import type { Person } from "@corr/db";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SelectField, optionsFromLabels } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { savePerson, type PersonFormState } from "./actions";

const UF_OPTIONS = UFS.map((uf) => ({ value: uf, label: uf }));

/**
 * Órgãos emissores aceitos por tipo de documento. A lista vem do próprio
 * portal (ver `CAIXA_ORGAO_EMISSOR`), então o que for escolhido aqui existe lá.
 */
const ISSUER_OPTIONS: Record<string, { value: string; label: string }[]> = Object.fromEntries(
  Object.entries(portais.CAIXA_ORGAO_EMISSOR).map(([tipo, orgaos]) => [
    tipo,
    orgaos.map((orgao) => ({ value: orgao.nome, label: orgao.nome })),
  ]),
);

export function PersonForm({ person }: { person?: Person }) {
  const action = savePerson.bind(null, person?.id ?? null);
  const [state, formAction] = useActionState<PersonFormState, FormData>(action, {});

  // O bloco do cônjuge aparece conforme o estado civil, igual ao portal do
  // banco faz — e o schema no servidor exige o mesmo, então o formulário não
  // deixa o operador salvar algo que a Caixa vai recusar depois.
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | "">(
    (person?.maritalStatus as MaritalStatus | undefined) ?? "",
  );
  const showSpouse = maritalStatus !== "" && requiresSpouse(maritalStatus);

  // O portal troca o grupo inteiro de campos do documento conforme o tipo (CNH
  // pede primeira habilitação, passaporte pede país de origem). O formulário
  // acompanha, para o cadastro daqui sair completo para o preenchimento lá.
  const [docType, setDocType] = useState<IdDocumentType | "">(
    (person?.docType as IdDocumentType | undefined) ?? "",
  );
  const [nationality, setNationality] = useState<Nationality | "">(
    (person?.nationality as Nationality | undefined) ?? "",
  );

  const errorOf = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Identificação" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="CPF"
            name="cpf"
            required
            inputMode="numeric"
            placeholder="000.000.000-00"
            defaultValue={person ? formatCpf(person.cpf) : ""}
            error={errorOf("cpf")}
          />
          <div className="sm:col-span-2">
            <Field
              label="Nome completo"
              name="fullName"
              required
              defaultValue={person?.fullName ?? ""}
              error={errorOf("fullName")}
            />
          </div>
          <Field
            label="Nome reduzido"
            name="shortName"
            maxLength={25}
            defaultValue={person?.shortName ?? ""}
            hint="Até 25 caracteres (exigência do portal da Caixa)."
          />
          <Field
            label="Data de nascimento"
            name="birthDate"
            type="date"
            defaultValue={person?.birthDate ?? ""}
          />
          <SelectField label="Sexo" name="sex" options={optionsFromLabels(SEX_LABELS)} defaultValue={person?.sex ?? ""} />
          <SelectField
            label="Nacionalidade"
            name="nationality"
            options={optionsFromLabels(NATIONALITY_LABELS)}
            value={nationality}
            onChange={(event) => setNationality(event.target.value as Nationality | "")}
          />
          {nationality === "estrangeiro" ? (
            <Field
              label="País de nacionalidade"
              name="nationalityCountry"
              defaultValue={person?.nationalityCountry ?? ""}
              error={errorOf("nationalityCountry")}
            />
          ) : null}
          <SelectField label="UF de naturalidade" name="birthUf" options={UF_OPTIONS} defaultValue={person?.birthUf ?? ""} />
          <Field label="Cidade de naturalidade" name="birthCity" defaultValue={person?.birthCity ?? ""} />
          <Field label="Nome da mãe" name="motherName" defaultValue={person?.motherName ?? ""} />
          <Field label="Nome do pai" name="fatherName" defaultValue={person?.fatherName ?? ""} />
          <SelectField
            label="Grau de instrução"
            name="educationLevel"
            options={optionsFromLabels(EDUCATION_LEVEL_LABELS)}
            defaultValue={person?.educationLevel ?? ""}
          />
          <Field label="PIS/NIS" name="pis" inputMode="numeric" defaultValue={person?.pis ?? ""} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Documento de identificação" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label="Tipo"
            name="docType"
            options={optionsFromLabels(ID_DOCUMENT_TYPE_LABELS)}
            value={docType}
            onChange={(event) => setDocType(event.target.value as IdDocumentType | "")}
          />
          <Field
            label="Número"
            name="docNumber"
            maxLength={docType === "ric" ? 11 : 15}
            defaultValue={person?.docNumber ?? ""}
          />
          <SelectField
            label="Órgão emissor"
            name="docIssuer"
            options={ISSUER_OPTIONS[docType] ?? []}
            defaultValue={person?.docIssuer ?? ""}
            hint={docType === "" ? "Escolha o tipo de documento primeiro." : undefined}
          />
          <SelectField label="UF do órgão" name="docIssuerUf" options={UF_OPTIONS} defaultValue={person?.docIssuerUf ?? ""} />
          <Field label="Data de emissão" name="docIssuedAt" type="date" defaultValue={person?.docIssuedAt ?? ""} />
          <Field label="Validade" name="docValidUntil" type="date" defaultValue={person?.docValidUntil ?? ""} />
          {docType === "cnh" ? (
            <Field
              label="Data da primeira habilitação"
              name="docFirstLicenseDate"
              type="date"
              defaultValue={person?.docFirstLicenseDate ?? ""}
            />
          ) : null}
          {docType === "passaporte" ? (
            <Field
              label="País de origem"
              name="docIssuerCountry"
              defaultValue={person?.docIssuerCountry ?? ""}
            />
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Estado civil" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label="Estado civil"
            name="maritalStatus"
            options={optionsFromLabels(MARITAL_STATUS_LABELS)}
            value={maritalStatus}
            onChange={(event) => setMaritalStatus(event.target.value as MaritalStatus | "")}
            hint="O regime de bens muda quem precisa assinar o contrato."
          />
          {showSpouse ? (
            <>
              <Field
                label="Nome do cônjuge/companheiro"
                name="spouseName"
                defaultValue={person?.spouseName ?? ""}
                error={errorOf("spouseName")}
              />
              <Field
                label="CPF do cônjuge"
                name="spouseCpf"
                inputMode="numeric"
                defaultValue={person?.spouseCpf ? formatCpf(person.spouseCpf) : ""}
                error={errorOf("spouseCpf")}
              />
            </>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contato e endereço" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="E-mail" name="email" type="email" defaultValue={person?.email ?? ""} error={errorOf("email")} />
          <Field label="Telefone" name="phone" defaultValue={person?.phone ?? ""} placeholder="(00) 00000-0000" />
          <Field label="CEP" name="zipCode" inputMode="numeric" defaultValue={person?.zipCode ?? ""} />
          <div className="sm:col-span-2">
            <Field label="Logradouro" name="street" defaultValue={person?.street ?? ""} />
          </div>
          <Field label="Número" name="streetNumber" defaultValue={person?.streetNumber ?? ""} />
          <Field label="Complemento" name="complement" defaultValue={person?.complement ?? ""} />
          <Field label="Bairro" name="district" defaultValue={person?.district ?? ""} />
          <Field label="Cidade" name="city" defaultValue={person?.city ?? ""} />
          <SelectField label="UF" name="uf" options={UF_OPTIONS} defaultValue={person?.uf ?? ""} />
          <SelectField
            label="Tipo de imóvel"
            name="propertyType"
            options={optionsFromLabels(PROPERTY_TYPE_LABELS)}
            defaultValue={person?.propertyType ?? ""}
          />
          <SelectField
            label="Situação de moradia"
            name="housingSituation"
            options={optionsFromLabels(HOUSING_SITUATION_LABELS)}
            defaultValue={person?.housingSituation ?? ""}
            hint="Entra na análise de crédito, não é só endereço."
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Comprovante (mês)"
              name="residenceProofMonth"
              inputMode="numeric"
              maxLength={2}
              defaultValue={person?.residenceProofMonth ?? ""}
              error={errorOf("residenceProofMonth")}
            />
            <Field
              label="Ano"
              name="residenceProofYear"
              inputMode="numeric"
              maxLength={4}
              defaultValue={person?.residenceProofYear ?? ""}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Observações" />
        <CardBody>
          <textarea
            name="notes"
            rows={3}
            defaultValue={person?.notes ?? ""}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-2 focus:outline-brand-500/30"
          />
        </CardBody>
      </Card>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-reprovado">
          {state.error}
          {state.duplicatePersonId ? (
            <>
              {" "}
              <Link
                href={`/pessoas/${state.duplicatePersonId}`}
                className="font-medium underline underline-offset-2"
              >
                Abrir o cadastro existente
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton>{person ? "Salvar alterações" : "Cadastrar pessoa"}</SubmitButton>
        <Link
          href="/pessoas"
          className="inline-flex h-10 items-center rounded-md border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-surface-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
