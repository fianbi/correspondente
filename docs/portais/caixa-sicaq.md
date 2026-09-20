# Caixa Aqui (SICAQ) — mapa de campos do cadastro de clientes

Inventário extraído das telas salvas do portal. **Só estrutura**: nome do campo, tipo,
tamanho e tabelas de domínio. Nenhum valor preenchido foi reproduzido aqui.

As capturas originais ficam em `benchmarks/` na máquina de quem capturou, fora do controle
de versão, porque contêm dado pessoal real. Este documento é a parte versionável — e é dele
que saem o catálogo de campos (M2) e o perfil de preenchimento da extensão (M4).

## O fluxo

```
Dados cadastrais → Endereço/contato → Renda (formal ou informal) → Agência
```

**O cadastro não tem captcha.** A tela de Pesquisa Cadastral Simplificada, que é a única
com captcha, serve para consultar pendências em nome do cliente e fica fora deste caminho —
quem vai cadastrar não passa por ela. Ou seja, a extensão consegue percorrer o cadastro
inteiro sem esbarrar em desafio de imagem.

## Campos que aparecem conforme o preenchimento

O portal mostra e esconde campos conforme escolhas anteriores:

| Gatilho | Efeito |
| --- | --- |
| `cmbTipoDocumento` | **troca o grupo inteiro de campos do documento** — ver a seção seguinte |
| `cmbNacionalidade` = ESTRANGEIRA | acrescenta `cmbPaisDeNacionalidade` (336 países) |
| `cmbNacionalidade` = BRASILEIRO NATURALIZADO | não muda nenhum campo |
| `cmbTpOcupacao` = FORMAL / INFORMAL | alterna entre `cmbOcupacaoFormal` e `cmbOcupacaoInformal` |
| `cmbEstadoCivil` = casado | exige `cpfConjuge` e `nomeCompletoConjuge` |
| `cmbCaracteristicaRenda` = COMPROVADA / SEM RENDA | mostra ou não o bloco de fonte pagadora |
| `cmbCnpj_cpf` = FÍSICA / JURÍDICA | alterna entre `numeroCpf` e `numeroCnpj` |

## Variações por tipo de documento

Não é o mesmo grupo de campos reaproveitado: cada tipo renderiza campos com **nome
diferente**, sufixado pelo tipo. Um mapeamento fixo de seletor só funciona depois de saber
qual tipo está selecionado — é por isso que o perfil da extensão precisa ser condicional,
e não uma lista plana de campo para campo.

### RG / Carteira de identidade (`cmbTipoDocumento` = `0372008`)

| Campo | Tipo | Máx. |
| --- | --- | --- |
| `subTipoIdentidadeNumeroRg` | select |  |
| `identidadeNumeroRg` | text | 15 |
| `cmbOrgaoEmissorRg` | select |  |
| `cmbUFIdentidadeRg` | select |  |
| `dataEmissaoIdentidadeRg` | text | 10 |
| `dataFimValidadeRg` | text | 10 |

### RIC (`cmbTipoDocumento` = `0372102`)

| Campo | Tipo | Máx. |
| --- | --- | --- |
| `identidadeNumeroRg` | text | 11 |
| `cmbOrgaoEmissorRg` | select |  |
| `cmbUFIdentidadeRg` | select |  |
| `dataEmissaoIdentidadeRg` | text | 10 |
| `dataFimValidadeRg` | text | 10 |

### Passaporte (`cmbTipoDocumento` = `0781`)

| Campo | Tipo | Máx. |
| --- | --- | --- |
| `identidadeNumeroPassaporte` | text | 15 |
| `cmbOrgaoEmissorPassaporte` | select |  |
| `cmbUFIdentidadePassaporte` | select |  |
| `paisDeOrigemPassaporte` | select |  |
| `dataEmissaoIdentidadePassaporte` | text | 10 |
| `dataFimValidadePassaporte` | text | 10 |

### CNH (`cmbTipoDocumento` = `0782`)

| Campo | Tipo | Máx. |
| --- | --- | --- |
| `identidadeNumeroCnh` | text | 11 |
| `cmbOrgaoEmissorCnh` | select |  |
| `cmbUFIdentidadeCnh` | select |  |
| `dataPrimeiraHabilitacaoCnh` | text | 10 |
| `dataEmissaoIdentidadeCnh` | text | 10 |
| `dataFimValidadeCnh` | text | 10 |

Observações que só aparecem no HTML real:

- **RIC** usa os mesmos nomes do RG, mas sem `subTipoIdentidadeNumeroRg`.
- **CNH** tem um campo a mais, `dataPrimeiraHabilitacaoCnh`, que não existe nos outros tipos.
- **Passaporte** tem `paisDeOrigemPassaporte` e um órgão emissor próprio, com só duas opções.


## Identificação positiva

Confirmação de identidade antes de liberar o cadastro.

| Campo | Tipo | Máx. | Rótulo na tela |
| --- | --- | --- | --- |
| `nomePai` | text | 70 | Primeiro Nome do Pai |
| `identidadeNumeroRg` | text | 15 | Número da Identidade |

## Dados cadastrais

Núcleo do cadastro. Os campos de documento variam conforme o tipo escolhido — ver a seção de variações.

| Campo | Tipo | Máx. | Rótulo na tela |
| --- | --- | --- | --- |
| `dataCpf` | text (readonly) | 11 | CPF do Cliente |
| `nomeCompleto` | text | 70 | Nome do Cliente (Completo - sem abreviaç |
| `movimentaContaDepositoPoupanca` | checkbox |  | Declaração de Propósitos |
| `emprestimosFinanciamentos` | checkbox |  | Movimentação de Conta de Depósito/Poupan |
| `habitacional` | radio |  | Financiamento Habitacional |
| `habitacional` | radio |  | SIM |
| `investimentos` | checkbox |  | NÃO |
| `cartaoCredito` | checkbox |  | Investimentos |
| `seguroPrevidenciaCapitalizacaoConsorcios` | checkbox |  | Cartão de Crédito |
| `operacoesInternacionaisCambio` | checkbox |  | Seguros/Previdência Privada/Capitalizaçã |
| `nomeReduzido` | text | 25 | Nome do Cliente (Formato Reduzido) |
| `dataNascimento` | text | 10 | Data de Nascimento |
| `cmbSexo` | select |  | Sexo: |
| `cmbNacionalidade` | select |  | Nacionalidade |
| `cmbUFNaturalidade` | select |  | Naturalidade |
| `cmbMunicipioNaturalidade` | select |  | Naturalidade |
| `nomePai` | text | 70 | Nome do Pai |
| `nomeMae` | text | 70 | Nome da Mãe |
| `cmbGrauInstrucao` | select |  | Grau de Instrução |
| `pis` | text | 11 | PIS/NIS |
| `cmbTipoDocumento` | select |  | Tipo de Documento de Identificação |
| `subTipoIdentidadeNumeroRg` | select |  | Subtipo do Documento |
| `identidadeNumeroRg` | text | 15 | Número da Identidade |
| `cmbOrgaoEmissorRg` | select |  | Órgão Emissor |
| `cmbUFIdentidadeRg` | select |  | UF |
| `dataEmissaoIdentidadeRg` | text | 10 | Data de Emissão |
| `dataFimValidadeRg` | text | 10 | Data Fim Validade |
| `cmbEstadoCivil` | select |  | Estado Civil |
| `cmbTpOcupacao` | select |  | Tipo de Ocupação |
| `cmbOcupacaoFormal` | select |  | Ocupação |
| `cmbOcupacaoInformal` | select |  | Ocupação |
| `txtOcupacaoNaoEditavel` | text | 14 | Ocupação |
| `cpfConjuge` | text | 11 | CPF |
| `nomeCompletoConjuge` | text | 28 | Nome |

Campos ocultos de controle: `UFNaturalidade`, `descOrgaoEmissor`, `descOcupacaoPrincipal`, `cpfCliente`.

**`cmbSexo`**

| Código | Descrição |
| --- | --- |
| `M` | MASCULINO |
| `F` | FEMININO |

**`cmbNacionalidade`**

| Código | Descrição |
| --- | --- |
| `BRASILEIRO` | BRASILEIRA |
| `BRASILEIRO_NATURALIZADO` | BRASILEIRO NATURALIZADO |
| `BRASILEIRO_NASCIDO_EXTERIOR` | BRASILEIRO NASCIDO NO EXTERIOR |
| `ESTRANGEIRO` | ESTRANGEIRA |

**`cmbUFNaturalidade`**

| Código | Descrição |
| --- | --- |
| `12` | AC |
| `27` | AL |
| `13` | AM |
| `16` | AP |
| `29` | BA |
| `23` | CE |
| `53` | DF |
| `32` | ES |
| `52` | GO |
| `21` | MA |
| `31` | MG |
| `50` | MS |
| `51` | MT |
| `15` | PA |
| `25` | PB |
| `26` | PE |
| `22` | PI |
| `41` | PR |
| `33` | RJ |
| `24` | RN |
| `11` | RO |
| `14` | RR |
| `43` | RS |
| `42` | SC |
| `28` | SE |
| `35` | SP |
| `17` | TO |

**`cmbMunicipioNaturalidade`** — 648 opções (tabela de referência; precisa ser importada, não digitada).
Amostra: `0010`=ADAMANTINA, `0020`=ADOLFO, `0030`=AGUAI…

**`cmbGrauInstrucao`**

| Código | Descrição |
| --- | --- |
| `02` | ATÉ 4A SÉRIE INCOMPLETA DO ENSINO FUNDAMENTAL |
| `03` | COM 4A SÉRIE COMPLETA DO ENSINO FUNDAMENTAL |
| `04` | DA 5A A 8A SÉRIE INCOMPLETA DO ENSINO FUNDAMENTAL |
| `05` | ENSINO FUNDAMENTAL COMPLETO |
| `06` | ENSINO MÉDIO INCOMPLETO |
| `07` | ENSINO MÉDIO COMPLETO |
| `08` | SUPERIOR INCOMPLETO |
| `09` | SUPERIOR COMPLETO |
| `10` | ESPECIALIZAÇÃO/PÓS GRADUAÇÃO |
| `11` | MESTRADO |
| `12` | DOUTORADO |

**`cmbTipoDocumento`**

| Código | Descrição |
| --- | --- |
| `0372008` | DOCUMENTO DE IDENTIFICAÇÃO |
| `0372102` | RIC - REGISTRO DE IDENTIDADE CIVIL |
| `0781` | PASSAPORTE |
| `0782` | CNH - CARTEIRA NACIONAL DE HABILITAÇÃO |

**`subTipoIdentidadeNumeroRg`**

| Código | Descrição |
| --- | --- |
| `CI` | CARTEIRA DE IDENTIDADE |
| `CF` | CARTEIRA FUNCIONAL |
| `IM` | IDENTIDADE MILITAR |
| `CE` | CARTEIRA DE IDENTIDADE ESTRANGEIRA |

**`cmbOrgaoEmissorRg`**

| Código | Descrição |
| --- | --- |
| `10` | SECRETARIA DE SEGURANÇA PÚBLICA |
| `81` | OUTRO TIPO DE ÓRGÃO EMISSOR |
| `88` | SECRETARIA DEFESA SOCIAL |
| `90` | POLÍCIA CIVIL |
| `91` | SECRETARIA DE ESTADO DA CASA CIVIL |

**`cmbUFIdentidadeRg`**

| Código | Descrição |
| --- | --- |
| `AC` | AC |
| `AL` | AL |
| `AM` | AM |
| `AP` | AP |
| `BA` | BA |
| `CE` | CE |
| `DF` | DF |
| `ES` | ES |
| `GO` | GO |
| `MA` | MA |
| `MG` | MG |
| `MS` | MS |
| `MT` | MT |
| `PA` | PA |
| `PB` | PB |
| `PE` | PE |
| `PI` | PI |
| `PR` | PR |
| `RJ` | RJ |
| `RN` | RN |
| `RO` | RO |
| `RR` | RR |
| `RS` | RS |
| `SC` | SC |
| `SE` | SE |
| `SP` | SP |
| `TO` | TO |

**`cmbEstadoCivil`**

| Código | Descrição |
| --- | --- |
| `1` | SOLTEIRO (A) |
| `3` | DIVORCIADO (A) |
| `4` | SEPARADO (A) JUDICIALMENTE |
| `5` | VIÚVO (A) |
| `7` | CASADO (A) COM COMUNHÃO TOTAL DE BENS |
| `8` | CASADO (A) COM SEPARAÇÃO DE BENS |
| `9` | CASADO (A) COM COMUNHÃO PARCIAL DE BENS |

**`cmbTpOcupacao`**

| Código | Descrição |
| --- | --- |
| `01` | FORMAL |
| `02` | INFORMAL |

**`cmbOcupacaoFormal`** — 153 opções (tabela de referência; precisa ser importada, não digitada).
Amostra: `125`=ADMINISTRADOR, `131`=ADVOGADO, `405`=AGENCIADOR DE PROPAGANDA…

**`cmbOcupacaoInformal`** — 149 opções (tabela de referência; precisa ser importada, não digitada).
Amostra: `187689`=ACOUGUEIRO, `72980821`=ACUPUNTURISTA, `72981095`=ADESTRADOR DE ANIMAIS…

## Endereço e contato

Endereço, situação do imóvel onde mora, telefone e e-mail.

| Campo | Tipo | Máx. | Rótulo na tela |
| --- | --- | --- | --- |
| `cep` | text | 8 | CEP |
| `cmbTipoLogradouro` | select |  | Endereço |
| `logradouro` | text | 50 | Endereço |
| `numero` | text | 7 | Número |
| `complemento` | text | 15 | Complemento |
| `bairro` | text | 40 | Bairro |
| `cmbUFEndereco` | text |  | UF |
| `cmbMunicipioEndereco` | text |  | Município |
| `cmbTipoImovel` | select |  | Tipo de Imóvel |
| `cmbTipoOcupacaoImovel` | select |  | Ocupação do Imóvel |
| `comprovanteResidenciaMes` | text | 2 | Comprovante Residência |
| `comprovanteResidenciaAno` | text | 4 | / |
| `dddCel` | text | 2 | Telefone Celular |
| `telefoneCel` | text | 9 | Telefone Celular |
| `email` | text | 50 | E-mail |

Campos ocultos de controle: `UFEndereco`, `nomeLocalidade`.

**`cmbTipoLogradouro`** — 231 opções (tabela de referência; precisa ser importada, não digitada).
Amostra: `ACA`=ACAMPAMENTO, `AC `=ACESSO, `ACL`=ACESSO LOCAL…

**`cmbTipoImovel`**

| Código | Descrição |
| --- | --- |
| `01` | CASA |
| `03` | SÍTIO |
| `04` | CHÁCARA |
| `05` | APARTAMENTO |
| `08` | FAZENDA |
| `10` | OUTROS TIPOS IMÓVEIS |

**`cmbTipoOcupacaoImovel`**

| Código | Descrição |
| --- | --- |
| `01` | PRÓPRIA QUITADA |
| `02` | PRÓPRIA FINANCIADA CAIXA |
| `03` | PRÓPRIA FINANCIADA OUTRAS ENTIDADES |
| `04` | ALUGADA |
| `05` | MORA COM PAIS/PARENTES |
| `06` | CEDIDA |
| `07` | FUNCIONAL |
| `08` | OUTROS |

## Renda formal

Uma ocorrência por fonte pagadora.

| Campo | Tipo | Máx. | Rótulo na tela |
| --- | --- | --- | --- |
| `cmbCaracteristicaRenda` | select |  | Característica da Renda |
| `cmbCnpj_cpf` | select |  | Tipo de Fonte |
| `numeroCnpj` | text | 18 | CNPJ |
| `numeroCpf` | text | 14 | CPF |
| `fontePagadora` | text | 32 | Nome da Fonte Pagadora |
| `cmbOcupacao` | select |  | Ocupação |
| `dataAdmissao` | text | 10 | Data de Admissão |
| `valorRendaBruta` | text | 12 | Bruta |
| `valorRendaLiquida` | text | 12 | Líquida |
| `cmbComprovanteRenda` | select |  | Documento de Comprovante de Renda |
| `dtRefCompr` | text | 7 | Data do Comprovante de Renda |
| `iImposRendaRetFonte` | text (readonly) | 12 | Imposto de Renda Retido |
| `empregoAnos` | text | 2 | Tempo no emprego anterior |
| `empregoMeses` | text | 2 | Anos |
| `anoDesligamento` | text | 4 | Ano de desligamento do emprego anterior |

Campos ocultos de controle: `index`, `tipoFonte`, `cpfCnpj`, `descOcupacao`, `_cmbCnpj_cpf`, `_numeroCpfCnpj`, `_fontePagadora`, `_cmbOcupacao`, `_cmbCaracteristicaRenda`, `descCaracteristica`, `_dataAdmissao`, `_empregoAnteriorAnos`, `_empregoAnteriorMeses`, `_iImposRendaRetFonte`.

**`cmbCaracteristicaRenda`**

| Código | Descrição |
| --- | --- |
| `2` | SEM RENDA |
| `6` | COMPROVADA |

**`cmbCnpj_cpf`**

| Código | Descrição |
| --- | --- |
| `1` | FÍSICA |
| `2` | JURÍDICA |

**`cmbOcupacao`** — 153 opções (tabela de referência; precisa ser importada, não digitada).
Amostra: `125`=ADMINISTRADOR, `131`=ADVOGADO, `405`=AGENCIADOR DE PROPAGANDA…

**`cmbComprovanteRenda`** — 17 opções (tabela de referência; precisa ser importada, não digitada).
Amostra: `65220851`=COMPROVANTE DE RECEBIMENTO NO EXTERIOR, `64522009`=CONTRACHEQUE/HOLLERITH, `262903176`=HISTORICO DE CONTRACHEQUE…

## Renda informal

Alternativa à renda formal.

| Campo | Tipo | Máx. | Rótulo na tela |
| --- | --- | --- | --- |
| `nomeAtividade` | select |  | Nome da Atividade |
| `dataDeInicio` | text | 10 | Data de Início |
| `rendaLiquidaMensal` | text | 12 | Renda Líquida Mensal |

Campos ocultos de controle: `index`, `descOcupacao`, `ocorrencia`.

**`nomeAtividade`** — 149 opções (tabela de referência; precisa ser importada, não digitada).
Amostra: `187689`=ACOUGUEIRO, `72980821`=ACUPUNTURISTA, `72981095`=ADESTRADOR DE ANIMAIS…

## Agência de relacionamento

Definida pelo endereço do cliente.

| Campo | Tipo | Máx. | Rótulo na tela |
| --- | --- | --- | --- |
| `cmbUFAgenciaRelacionamento` | select |  | UF |
| `cmbMunicipioAgenciaRelacionamento` | select |  | Município |
| `cmbAgenciaRelacionamento` | select |  | Código e Nome das Agências |

Campos ocultos de controle: `nomeLocalidadeAgRelacionamento`, `nomeAgenciaRelacionamento`.

**`cmbUFAgenciaRelacionamento`**

| Código | Descrição |
| --- | --- |
| `AC` | AC |
| `AL` | AL |
| `AM` | AM |
| `AP` | AP |
| `BA` | BA |
| `CE` | CE |
| `DF` | DF |
| `ES` | ES |
| `GO` | GO |
| `MA` | MA |
| `MG` | MG |
| `MS` | MS |
| `MT` | MT |
| `PA` | PA |
| `PB` | PB |
| `PE` | PE |
| `PI` | PI |
| `PR` | PR |
| `RJ` | RJ |
| `RN` | RN |
| `RO` | RO |
| `RR` | RR |
| `RS` | RS |
| `SC` | SC |
| `SE` | SE |
| `SP` | SP |
| `TO` | TO |

**`cmbMunicipioAgenciaRelacionamento`** — 648 opções (tabela de referência; precisa ser importada, não digitada).
Amostra: `000009030`=ADAMANTINA, `000009031`=ADOLFO, `000009034`=AGUAI…

**`cmbAgenciaRelacionamento`**

| Código | Descrição |
| --- | --- |
| `2352` | 2352 SAO SEBASTIAO DA GRAMA, SP |

## Pesquisa cadastral (fora do fluxo de cadastro)

Consulta de pendências em nome do cliente. **Não faz parte do cadastro** — é a única tela com captcha.

| Campo | Tipo | Máx. | Rótulo na tela |
| --- | --- | --- | --- |
| `rdPessoa` | radio |  | Dados Cadastrais |
| `rdPessoa` | radio |  | Pessoa Física |
| `dataCpf` | text | 14 | CPF |
| `dataCnpj` | text | 18 | CNPJ |
| `respostaCaptcha` | text |  | Digite abaixo os caracteres apresentados |

**`cmbOrgaoEmissorPassaporte`**

| Código | Descrição |
| --- | --- |
| `44` | POLÍCIA FEDERAL |
| `82` | ÓRGÃO EMISSOR ESTRANGEIRO |

**`cmbOrgaoEmissorCnh`**

| Código | Descrição |
| --- | --- |
| `83` | ÓRGÃO DE TRÂNSITO |

## Consequências para o modelo de dados

1. **Documento não é um par "tipo + número".** Cada tipo tem campos próprios: CNH pede data
   da primeira habilitação, passaporte pede país de origem, RG pede subtipo. O cadastro
   precisa guardar esses extras, senão o preenchimento trava na hora de completar a tela.
2. **Pessoa precisa de muito mais do que nome e CPF.** Nome do pai, nome da mãe, PIS/NIS,
   naturalidade, grau de instrução e estado civil **com regime de bens** — em
   `cmbEstadoCivil` "casado" não é um valor só, são três.
3. **Renda é lista, não campo.** Uma pessoa tem N ocorrências (formal por fonte pagadora ou
   informal por atividade), cada uma com comprovante e data de referência.
4. **Os códigos são da Caixa, não nossos.** Ficam isolados em `@corr/core/portais`, longe do
   domínio, para o modelo não amarrar num banco só.
5. **Endereço carrega dado de crédito**, não só localização: tipo do imóvel, tipo de ocupação
   (própria/alugada/cedida) e mês/ano do comprovante de residência.

