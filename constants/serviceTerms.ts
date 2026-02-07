// Termos e condições de cada serviço

export const SERVICE_TERMS = {
    CLT: {
        title: 'Termos do Empréstimo para CLT',
        color: 'blue',
        requirements: [
            'Ter registro ativo em carteira (CLT)',
            'Possuir mínimo de 3 meses no emprego atual',
            'Ter renda compatível com o valor solicitado',
        ],
        documents: [
            'Carteira de Trabalho Digital em PDF (arquivo original exportado)',
            'Documento com foto (RG ou CNH)',
            'Selfie segurando o documento',
            'Comprovante de residência',
        ],
        conditions: [
            'Juros: 30% ao mês',
            'Multa inadimplência: 7% sobre valor emprestado',
            'Multa diária: R$ 20,00 por dia de atraso (cumulativo)',
            'Aprovação não é automática, depende de análise',
            'Documento inválido resulta em reprovação',
        ],
        alerts: [
            'NÃO aceitamos: carteira impressa, fotografada ou print de tela',
            'Apenas ARQUIVO PDF da Carteira de Trabalho Digital é aceito',
        ],
        checkboxText: `Declaro que li e compreendi as condições do Empréstimo para CLT, que é obrigatório possuir no mínimo 3 meses de registro ativo, que devo enviar a Carteira de Trabalho Digital em ARQUIVO PDF (não sendo aceitos prints, fotos ou documentos impressos), que o valor do empréstimo varia conforme salário e perfil do cliente, que os juros são de 30%, que em caso de atraso haverá multa de 7% sobre o valor emprestado mais R$ 20,00 por dia de atraso de forma acumulativa, e que a liberação depende de análise.`,
    },

    AUTONOMO: {
        title: 'Termos - Capital de Giro (Comerciante)',
        color: 'green',
        conditions: [
            'Finalidade: Capital de giro para comércio',
            'Modalidade: Pagamento diário',
            'Prazo: 30 (trinta) diárias',
            'Juros: 30% ao mês',
            'Dias de cobrança: Segunda a Sábado (feriados inclusos)',
            'Domingos: Não possuem cobrança diária',
            'Multa por atraso: R$ 20,00 por dia (cumulativo)',
        ],
        documents: [
            'CNPJ e RG/CNH',
            'Comprovante de Endereço Comercial',
            'Vídeo do Estabelecimento',
            'Análise do Comércio',
            'Selfie com Documento',
        ],
        checkboxText: `Declaro que li e compreendi as condições do Empréstimo para Comerciante (Capital de Giro), incluindo análise do comércio para definição do valor, pagamento em 30 diárias, juros de 30% ao mês, cobrança de segunda a sábado (feriados inclusos), sem cobrança aos domingos, e que em caso de inadimplência o domingo será contado para juros e multa de R$ 20,00 por dia de atraso, de forma cumulativa.`,
    },

    MOTO: {
        title: 'Termos - Financiamento de Motocicleta',
        color: 'yellow',
        conditions: [
            'Entrada obrigatória: R$ 2.000,00 (não reembolsável)',
            'Parcelamento: 36 parcelas mensais de R$ 611,00',
            'Seguro obrigatório: R$ 150,00/mês',
            'Valor mensal total: R$ 761,00',
            'Moto permanece em nome da empresa até quitação',
            'Atraso autoriza busca e apreensão imediata',
            'Em caso de apreensão, valores pagos são perdidos',
        ],
        documents: [
            'CNH categoria A',
            'Comprovante de Residência',
            'Foto da Casa',
            'Selfie com Documento',
            'Comprovante de Renda',
        ],
        checkboxText: `Declaro que li e compreendi todas as condições do financiamento próprio de motocicleta, incluindo a entrada de R$ 2.000,00, as 36 parcelas mensais de R$ 611,00, o seguro obrigatório de R$ 150,00 mensais, e estou ciente das penalidades, da possibilidade de busca e apreensão e da transferência do veículo somente após a quitação total.`,
    },

    GARANTIA: {
        title: 'Termos - Empréstimo com Garantia',
        color: 'orange',
        conditions: [
            'Garantia deve valer NO MÍNIMO o DOBRO do valor solicitado',
            'O bem fica EM POSSE FÍSICA DA EMPRESA durante todo contrato',
            'Veículos aceitos: Carro, Moto, Jet ski, Elétrico',
            'Eletrônicos aceitos: Celular, Notebook (desvinculados)',
            'Veículo será transferido para nome da empresa',
            'Juros: 30% ao mês',
            'Multa inadimplência: 7% sobre valor emprestado',
            'Multa diária: R$ 20,00 por dia de atraso (cumulativo)',
            'Em caso de inadimplência, garantia vira pagamento da dívida',
        ],
        documentsVehicle: [
            'Fotos do Veículo (frente, lateral, traseira)',
            'Documento do Veículo (CRLV) ou Nota Fiscal',
            'Foto da Fachada da Residência',
            'RG ou CNH',
            'Selfie com Documento',
            'Localização GPS',
        ],
        documentsElectronic: [
            'Fotos do Eletrônico',
            'Nota Fiscal ou Comprovante de Compra',
            'Print mostrando desvinculação de contas',
            'RG ou CNH',
            'Selfie com Documento',
        ],
        checkboxText: `Declaro que li e compreendi que, no Empréstimo com Garantia, todo bem oferecido ficará obrigatoriamente em posse física da empresa durante toda a vigência do contrato, não sendo permitido permanecer com o uso do veículo ou do bem; que a garantia deve valer no mínimo o dobro do valor solicitado; que veículos serão transferidos para o nome da empresa com reconhecimento em cartório; que os juros são de 30%, multa de 7% sobre o valor emprestado e R$ 20,00 por dia de atraso de forma acumulativa; e que, em caso de inadimplência, a garantia poderá ser utilizada como pagamento da dívida.`,
    },

    LIMPA_NOME: {
        title: 'Termos - Serviço Limpa Nome',
        color: 'purple',
        conditions: [
            'Análise e contestação administrativa de negativação',
            'Atuação junto a: Serasa, SPC Brasil, Boa Vista, IEPTB',
            'Processo pode durar até 12 meses',
            'A empresa NÃO paga dívidas nem quita valores',
            'A dívida continua existindo junto ao credor original',
            'CPF pode ficar sem exposição pública durante processo',
            'Score pode melhorar progressivamente',
            'Qualquer inadimplência pode fazer restrição retornar',
        ],
        documents: [
            'RG ou CNH (frente e verso)',
            'Comprovante de Residência',
            'Selfie com Documento',
        ],
        checkboxText: `Declaro que li e compreendi que o serviço não paga dívidas, que a dívida continua existindo, que o processo pode durar até 12 meses, podendo manter a negativação sem exposição pública enquanto não houver atraso, e que qualquer inadimplência pode fazer a restrição retornar imediatamente.`,
        contractTitle: 'TERMO DE AUTORIZAÇÃO E REPRESENTAÇÃO',
        contractText: `O(a) associado(a), por meio deste instrumento, autoriza a entidade representativa a atuar em seu nome, com poderes amplos e irrestritos, em qualquer juízo, instância ou tribunal, em todo o território nacional, inclusive junto aos seguintes órgãos e instituições: SPC Brasil, Serasa, Boa Vista, IEPTB São Paulo, IEPTB Nacional (Cenprot), cartórios de protesto e demais bureaus de crédito.

A entidade poderá propor as medidas judiciais ou extrajudiciais cabíveis, ingressar com ações contra terceiros, bem como defender o(a) associado(a) em ações contrárias, acompanhando todos os trâmites até decisão final, com uso de todos os recursos legais disponíveis.

Confere-se à entidade, ainda, poderes especiais para:
• Reconhecer a procedência de pedidos;
• Desistir de ações;
• Renunciar a direitos;
• Firmar acordos judiciais ou extrajudiciais (transigir), exclusivamente para fins de defesa dos direitos do consumidor.

Além disso, o(a) associado(a) autoriza expressamente a entidade a atuar como substituta processual, nos termos do artigo 5º, inciso XXI, da Constituição Federal.

Nos termos da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), que protege os direitos fundamentais de liberdade, privacidade e o livre desenvolvimento da personalidade, o(a) associado(a) declara:

1. Autorizar, por prazo indeterminado e de forma irrevogável, o compartilhamento de seus dados pessoais entre a entidade, seus representantes e parceiros, bem como com terceiros diretamente envolvidos nas ações judiciais ou extrajudiciais, sempre em conformidade com os objetivos de defesa dos direitos do consumidor;

2. Reconhecer que esta autorização está em conformidade com os artigos 43 e 83 do Código de Defesa do Consumidor (CDC).`,
    },
};

// Tipos de garantia aceitos
export const GUARANTEE_TYPES = {
    VEHICLE: {
        id: 'veiculo',
        label: 'Veículo',
        types: ['Carro', 'Moto', 'Jet ski', 'Carro elétrico', 'Outro veículo'],
        requirements: [
            'Veículo deve estar quitado e sem débitos (IPVA, multas, licenciamento)',
            'Exceção: veículos com débitos só se valor de mercado > 2x empréstimo',
            'Será transferido para nome da empresa com reconhecimento em cartório',
            'Ficará em posse física da empresa durante todo contrato',
        ],
    },
    ELECTRONIC: {
        id: 'eletronico',
        label: 'Eletrônico',
        types: ['Celular', 'Notebook', 'Tablet', 'Outro eletrônico'],
        requirements: [
            'Deve estar totalmente desvinculado de contas (iCloud, Google, Samsung, etc)',
            'Deve estar em perfeito funcionamento',
            'Permanece sob posse física da empresa até quitação',
        ],
    },
};

// Cores para o painel administrativo
export const PROFILE_ADMIN_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    CLT: { bg: 'bg-gray-500', text: 'text-white', label: 'CLT' },
    AUTONOMO: { bg: 'bg-green-500', text: 'text-white', label: 'Comércio' },
    MOTO: { bg: 'bg-yellow-500', text: 'text-black', label: 'Moto' },
    GARANTIA: { bg: 'bg-orange-500', text: 'text-white', label: 'Garantia' },
    LIMPA_NOME: { bg: 'bg-purple-500', text: 'text-white', label: 'Limpa Nome' },
};
