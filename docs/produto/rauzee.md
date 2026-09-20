# Rauzee — Mapeamento de funcionalidades (para referência de um novo projeto)

> Análise feita explorando (1) o site comercial `rauzee.com` e (2) o sistema real em produção `app.rauzee.com` (módulo "Correspondente Bancário"), logado como um escritório real (M&F Crédito). O foco deste documento é o **sistema em si**, que é o que interessa para construir algo parecido. Nenhum dado pessoal de clientes (nome, CPF, telefone, e-mail, renda etc.) foi reproduzido aqui — apenas a estrutura de telas, campos e fluxos.

---

## 1. O que é o produto

Rauzee é um **sistema de gestão para correspondentes bancários habitacionais** (empresas credenciadas por bancos, ex.: Caixa/CCA, Itaú, Bradesco, Santander, Inter, para intermediar financiamento imobiliário). É essencialmente um **CRM + esteira de processo (workflow) + automação com IA + gerador de formulários bancários**, verticalizado para o mercado de crédito imobiliário no Brasil.

Quatro perfis de usuário compartilham o mesmo processo, cada um vendo só a sua parte:
- **Correspondente bancário** (perfil central/dono da operação)
- **Imobiliária**
- **Corretor de imóveis**
- **Incorporadora/Construtora**

---

## 2. Estrutura geral do sistema (app logado)

Menu lateral esquerdo, fixo, dividido em seções:

- **Painel** (dashboard)
- **Notificações**
- **Flash** (IA em lote)
- **Scan** (IA avulsa)
- **Simulador** (simulador de financiamento embutível)
- **OPERACIONAL**
  - Processos
  - Propostas
  - Engenharias
  - Agenda
  - Pendências
- **CADASTROS**
  - Pessoas
  - Corretores
  - Imobiliárias
  - Agências
- Rodapé: usuário logado + acesso a **Configurações do escritório**

---

## 3. Painel (Dashboard)

- Banner de alerta: contagem de "processos a vencer nos próximos 30 dias" com atalho.
- Filtro de período por três eixos: **Criação / Aprovação / Assinatura** + seletor de intervalo de datas + filtro por **etiqueta**.
- Cards de KPI (valor em R$ somado) por status: **Em aberto, Aguardando, Aprovados, Condicionados, Reprovados, Assinados, Vencidos**.
- 3 gráficos: **Processos por banco** (volume por instituição), **Processos por modalidade** (tipo de crédito), **Processos por status** (funil/rosca com total).
- Botão de "Preferências do painel" (customização, não explorado a fundo).

---

## 4. Processos — o núcleo do sistema (a "esteira")

Tela de listagem com 3 modos de visualização, alternáveis:
- **Tabela**: colunas Cliente, Responsável (análise/aprovação), Corretor, Agência, Modalidade, Fase atual, Status, Etiquetas, Engenharia, Vendedor, Última atualização, Data de criação.
- **Kanban**: colunas = fases do funil, cada card mostra tag de status ("Análise aprovada", "Vencido faz X dias", "Válido por X dias"), nome do cliente, modalidade + valor, banco/agência, corretor responsável, e ícones de anexos/pendências/comentários.
- **Lista**: agrupada por fase, com contadores.

Barra de ferramentas: busca por nome/CPF/CNPJ/matrícula, **Filtros**, atalhos de status (Pausados, Concluídos, Cancelados, Pendências), abas **Fase atual / Fluxos / Etiquetas**, botão de configuração de colunas, botão **Adicionar** (novo processo).

### 4.1 Fases do funil (Kanban) observadas
`Cadastro → Análise operacional → Análise de crédito → Engenharia → Montagem → Conformidade de contrato → Agência → CRI`

(CRI = Cartório de Registro de Imóveis)

### 4.2 Detalhe de um Processo (tela "Editar Processo")

Cabeçalho: nome do fluxo ("Fluxo padrão", trocável), fase atual (dropdown), nome + CPF do cliente principal (copiável), botão **Formulários** (dropdown) e menu "...".

Sidebar do processo com **etapas numeradas do fluxo** (o fluxo é configurável por modalidade — no exemplo de "Aquisição de Terreno e Construção" as etapas foram):
1. Cadastro
2. Correspondente
3. Montagem
4. Conformidade de contrato
5. Agência
6. CRI
7. Conformidade de garantia
8. Acompanhamento de obra

E, abaixo, seção **"MAIS"** com abas transversais (não fazem parte da esteira, são visões do processo inteiro):
- Pendências
- Comentários
- Documentos
- Histórico
- Resumo
- Financeiro

Cada etapa tem, no topo, dois blocos colapsáveis padrão (podem estar "inativos" até serem configurados):
- **Checklist** (configurável)
- **Questionário interno** (configurável)

E então os campos específicos da etapa. Botões padrão: **Atribuir** (responsável), **Iniciar etapa** / **Finalizar etapa**.

#### Etapa "Cadastro"
- **Dados da proposta**: Banco, Agência, Modalidade/Tipo, Indexador, Contrato, Proposta, Valor do imóvel, Valor de financiamento aprovado, Prazo (meses), Sistema de amortização (PRICE/SAC). Botão "Vincular" (a uma proposta recebida).
- **Cliente(s)**: dados do proponente (nome, nascimento, CPF, e-mail, celular/WhatsApp, se recebe por banco, dependentes, situação de moradia, se já possui imóvel), bloco de **renda** (renda bruta/líquida com botão **"Calcular"** — aciona o apurador de IA —, mês ref., imposto retido, mês/ano do comprovante de residência, observações). Botão **"Gerar documento"**. Aviso de que dados aqui só valem para este processo (não sincroniza com cadastro central da pessoa, que tem link "Editar cliente"). Botão **"Gerar link de acesso"** (portal do cliente para upload). Botões **"Adicionar cliente com IA (Scan)"** e **"Adicionar cliente"** (para múltiplos proponentes).
- **Vendedores**: mesma lógica (com IA-Scan) para quem vende o imóvel.
- **Corretores**: seleção de Imobiliária + Corretores vinculados ao processo, com "Adicionar imobiliária"/"Adicionar corretor".
- Caixa de **Pendências** (chat/nota) ao final da etapa, com `@` para marcar colaborador e `/` para templates, e seletor de **Subfase**.

#### Etapa "Correspondente" (análise de crédito)
- Bloco **Análise de crédito** com histórico versionado (mostra autor e timestamp de cada análise): Tipo de autorização (1ª/2ª autorização), Status (aprovado/condicionado/etc.), Validade do crédito, Banco, Agência, Modalidade, Indexador, Contrato, Proposta, "Três anos de recolhimento do FGTS", Sistema de amortização.
- Bloco de **cálculo financeiro completo** (simulador embutido): Valor de compra (terreno+obra), Valor de avaliação (com botão Calcular), Saldo devedor, Valor aprovado, Valor de subsídio, Valor de FGTS (com botão Calcular), Valor de parcela, Prazo, Diferença.

#### Etapa "Montagem"
- Bloco **Comercial** (venda cruzada de produtos bancários exigida no pacote): Origem da adesão (Escritório/Agência), toggles para Conta Corrente (conjunta, cheque especial + valor), Conta Poupança (conjunta), Cartão de Crédito (bandeira), etc.

#### Etapa "Conformidade de contrato"
- Bloco **Análise de conformidade**: Data de ocorrência, Processo analisado (seleção).

#### Etapa "Agência"
- Bloco **"Aguardando entrevista ser agendada"**: Data de ocorrência, Data/hora da entrevista, Entrevista realizada (Sim/Não), Nome do gerente.
- Bloco **Assinatura do contrato**: Previsão de data/hora, Data da assinatura, Contrato assinado (Sim/Não), Valor de financiamento aprovado, Valor utilizado, Encaminhar registro (Sim/Não).

#### Etapa "CRI" (Cartório de Registro de Imóveis)
- Bloco **Contrato em registro**: Emolumentos pago em, Protocolo no RI + número, FRJ (Fundo de Reserva/Garantia?) Sim/Não + data + data de pagamento, Registro finalizado (data).

#### Etapa "Conformidade de garantia" (vista na navegação, não detalhada)

#### Etapa "Acompanhamento de obra" (financiamento de construção)
- Bloco: Data de ocorrência, **% da obra concluída**, "Matrícula com a averbação da construção entregue" (checkbox) + Data.

### 4.3 Aba "Documentos" do processo
Lista central de documentos do processo, com busca, filtro por origem, ordenação, botão **Importar** (puxa de proposta/fichas de clientes) e **Enviar**. Estado vazio orienta enviar o primeiro arquivo.

### 4.4 Aba "Histórico" do processo
**Log de auditoria completo, campo a campo**: cada alteração aparece agrupada por dia, com autor, horário e o "de → para" de cada campo alterado (ex.: fase mudou de X para Y; valor mudou de R$0,00 para R$X). Cobre mudanças de fase e edições de qualquer bloco (ex. Análise de crédito).

### 4.5 Aba "Resumo" do processo
Página de impressão/consolidação: dados do escritório (nome, código, CNPJ, endereço, cidade, e-mail, telefone), dados da agência/banco, dados da proposta (modalidade, indexador, sistema de amortização, valor de compra...). Botão **"Gerar PDF"**.

### 4.6 Aba "Financeiro" do processo
- **Comissões**: % de comissão de crédito habitacional + valor calculado (botão Calcular); % de comissão do corretor + valor calculado.
- **Ganhos e totais**: CRI, Ganhos diversos, Soma (botão Calcular), **Pontos ganhos** (indício de sistema de gamificação/pontuação interna).

### 4.7 Dropdown "Formulários" (dentro do processo)
Lista, agrupada sob "Documentos", os modelos de formulário disponíveis para aquele banco/modalidade, cada um com um código interno e nome (ex.: Termo LGPD, NDA/MP, "Crédito Real Fácil - Declaração imóvel", "Crédito Real Fácil - Solicitação consulta", "Proposta de seguro habitacional", "Formulário cliente crédito imobiliário"...). Clicar deve gerar o PDF já preenchido com os dados do processo (não testado para não gerar documento real).

---

## 5. Propostas

Fila de entrada de propostas recebidas de **corretores, portal público ou integração**, antes de virarem "Processo". Colunas: Cliente, Origem, Responsável, Status, Recebido/Devolvido. Ações: **Atribuição de propostas** (roteamento automático/manual entre analistas), **Exportar**, dropdown **Formulário** (provavelmente o formulário público de captação).

---

## 6. Engenharias

Controle de **laudos/ordens de avaliação de imóvel**. Colunas: Data, Matrícula do imóvel + endereço, Engenheiro, Responsável, **Posição da OS** (código/link de rastreio da ordem de serviço, aparentemente integrado ao sistema do banco), Validade, Valores (avaliação e outro valor), Etiquetas, Status (Aprovada/Solicitada/...). Ações: Exportar, Filtros, Adicionar.

---

## 7. Agenda

Calendário completo: visões **Grade/Lista**, **Mês/Semana/Dia**, aba **Tarefas**. Filtros, Etiquetas, **Eventos**, Exportar, **Adicionar tarefa**. Cada evento no calendário é vinculado a um cliente/processo (ícone do banco + nome).

---

## 8. Pendências (visão global)

Lista agregada de todas as pendências abertas em todos os processos, com filtro por status, responsável, autor, e opção "apenas fixadas". Cada pendência individual também aparece embutida como um mini chat/nota dentro de cada etapa do processo (ver 4.2).

---

## 9. Cadastros (base de dados compartilhada)

- **Pessoas**: registro mestre de todas as pessoas físicas que já passaram por algum processo (nome+CPF, contato, vínculo, data de criação). Deduplicado, separado do "cliente" específico de cada processo.
- **Corretores**: nome, contato, imobiliária vinculada, data de criação, link de **Formulário** individual (provavelmente o link que aquele corretor usa para submeter propostas), botão **Copiar link** (link genérico de auto-cadastro de corretor).
- **Imobiliárias**: nome, contato, cidade, data de criação, **Link** (portal).
- **Agências**: agência bancária, banco, cidade (cadastro simples de apoio).

---

## 10. Módulos de Inteligência Artificial

### 10.1 Flash (BETA) — processamento de documentos em lote
Tela dedicada com **toggle "Modo auto"**, link para **Arquivados**, zona de upload ("Nenhum arquivo"), botão **Executar Flash**. Pipeline visual em 3 (ou mais) passos animados: *Identificando documento(s) → Organizando informações → Validando informações* (em outra execução observada: *Criando processo → Gerando documentos → Identificando documentos*, sugerindo que o pipeline muda conforme o modo/etapa). Ideia: subir vários documentos de uma vez e a IA cadastra pessoas, abre processo e gera formulários automaticamente.

### 10.2 Scan — leitura de um documento avulso
Abre como **modal** (não página), com:
- Badge de canal **WhatsApp** e nome do escritório.
- **Contador de créditos de IA** no formato "0/120" (plano tem cota mensal de créditos, não cumulativa).
- Dropzone: "Clique aqui ou arraste e solte os arquivos" — aceita Imagens (JPG/PNG) e PDFs, até 20MB por arquivo.
- Lista de **tipos de documento reconhecidos**, com código de cor:
  - Identidade (azul): RG, CNH, CTPS, Certidão de Nascimento, Certidão de Casamento
  - Renda/residência (laranja): Comprovante de Residência, Comprovante de Renda, FGTS, Declaração de IR
  - Formulário do banco (verde): Ficha de Cadastro Caixa

### 10.3 Simulador
Tela "Simuladores — Formulários de simulação deste escritório": permite **criar um simulador de financiamento com as taxas configuradas do escritório e gerar um link público** para compartilhar com leads (provavelmente captura lead e joga na fila de Propostas).

### 10.4 Apurador de renda (embutido no Cadastro/Correspondente)
Não é uma tela própria — aparece como botões **"Calcular"** ao lado dos campos de Renda bruta/líquida, Valor de avaliação e Valor de FGTS, dentro das etapas Cadastro e Correspondente. Segundo o site comercial, processa extrato bancário, holerite e declaração de IR (até 400+ páginas) e aponta divergência entre documentos.

### 10.5 Rauzee Connect (não teve app próprio dentro do sistema — é extensão de Chrome)
Extensão do navegador com **agente de IA** que opera dentro do portal do banco (ex.: Caixa Aqui / SIOPI):
- Dois sentidos: "Rauzee → site" (preenche o portal com dados do processo) e "site → Rauzee" (lê a tela do banco e traz para o processo).
- Escopo selecionável: pessoa, processo, engenharia ou documentos.
- **3 níveis de autonomia**: Piloto (executa sozinho), Copiloto (propõe e espera confirmação), Manual (só ajuda quando chamado).
- Comando em linguagem natural (chat lateral na extensão), ex.: "Preencha o cadastro e pare antes de salvar".

### 10.6 Clara — assistente conversacional (texto e voz)
Assistente dentro do sistema (não localizada fisicamente na navegação testada, citada no site comercial e coerente com o restante do produto): responde perguntas sobre o processo, cadastra pessoa, abre processo, cria tarefa, por texto ou áudio transcrito. Pode ter base de conhecimento própria por escritório (normativas internas).

---

## 11. Notificações

Lista de notificações do sistema. Destaque: **"Resumo diário da plataforma Rauzee"** — notificação automática enviada todo dia com um resumo operacional: *Pendentes para hoje, Pendências vencidas, Processos parados há N dias (estagnados), Engenharias com previsão de conclusão para hoje, Engenharias com previsão de conclusão em atraso*. Botão "Marcar todas como lidas".

---

## 12. Configurações do escritório

Seção "Escritório" (aparentemente limitada para o perfil testado, pode ter mais para admin/dono):
- **Informações**: logo (upload, recorte automático), Nome, CNPJ (fixo, via suporte), Código interno, E-mail, Telefone, Cidade (fixa), Endereço.
- **Notificações**: preferências de notificação (não detalhado).
- **Atribuição de propostas**: regra de roteamento automático de propostas recebidas entre os analistas do escritório.

Pelo site comercial, existem ainda (não confirmados na navegação por falta de permissão/tempo, mas relevantes para replicar):
- Gestão de usuários/permissões por perfil.
- Configuração de **fluxos personalizados** (criar fases, ligar etapas, editar quadro) — mencionada como "Fluxos" na barra de Processos.
- Editor de **formulários próprios** (upload de .docx/PDF em branco, marcação de campos na tela, escolha de dado: processo/pessoa/engenharia).
- **Token de API** e tela de integrações (bancos, CV CRM, Loft, Homefin, Dommus, Wekoos AI, RD Station, Autentique, OLX, Laís IA).
- Módulo de **WhatsApp** (conexão via QR Code e/ou API oficial da Meta, múltiplos números, chatbot/agentes de IA configuráveis por texto de instrução, transferir/encerrar atendimento).
- **Assinatura digital** de contratos (via Autentique, indicado como incluso sem custo extra nos planos com módulo de contratos).

---

## 13. Site comercial (rauzee.com) — só o essencial, já que o foco é o produto

- Estrutura de navegação: Correspondente bancário | Soluções (4 perfis) | Recursos (9 páginas) | Planos (4 páginas) | Blog.
- Planos e preços publicados (referência de modelo de monetização):
  - **Correspondente bancário**: Ideal R$ 399,90/mês, Avançado R$ 499,90/mês (usuário adicional, créditos de IA por pacote de 1.000, WhatsApp por número, site white-label, implantação a partir de R$ 990).
  - **Imobiliárias**: R$ 399/mês (ou R$ 299/mês no anual, fidelidade 12 meses).
  - **Corretor**: grátis (site opcional R$ 99,90/mês).
  - **Incorporadoras**: Inicial R$ 598/mês, Completo R$ 899/mês.
  - Regra comum: 30 dias para rescindir sem multa após contratação; implantação com treinamento cobrada uma vez.
- Páginas de conteúdo/SEO explicando o mercado (O que é correspondente bancário, O que é CCA/CCA Master/CCA Digital, comparativo de sistemas, "CRM para correspondente") — úteis para entender o domínio, não a implementação.

---

## 14. Observações para o "criar algo parecido"

Pontos que parecem ser o diferencial real do produto (não só marketing):
1. **Um único registro de "processo" que atravessa fases configuráveis**, cada fase com seus próprios campos, checklist, questionário e formulários — não é um Kanban genérico, os campos mudam por fase.
2. **Histórico de auditoria campo-a-campo automático**, sem esforço extra do usuário.
3. **IA embutida como botões contextuais** ("Calcular" ao lado de campo de renda) em vez de uma tela de IA separada — a automação vive dentro do fluxo de trabalho normal.
4. **Geração de formulário = mapeamento de campos do processo para um PDF/DOCX modelo**, com biblioteca de +50 modelos por banco e possibilidade de o escritório subir os próprios modelos.
5. **Multiplayer real**: imobiliária/corretor/construtora entram no mesmo registro (não em cópias), cada um com uma visão filtrada por permissão.
6. **Extensão de navegador com agente de IA** operando fora do próprio sistema, no portal do banco — ponte entre sistemas fechados (bancos) e o CRM.
7. **Aba financeira por processo** com cálculo de comissão (corretor e crédito habitacional) e "pontos" — sugere gamificação/ranking interno de produtividade.
8. Cadastro de **pessoa é separado do cadastro por processo** (a pessoa pode reaparecer em vários processos ao longo do tempo — modelo de dados: Pessoa 1—N Processo).
