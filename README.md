💰 Finance Dashboard: Controle de Gastos
🚀 Sobre o Projeto
O Finance Dashboard: Controle de Gastos é um sistema web completo e inteligente para gerenciamento financeiro pessoal. Ele permite que os usuários acompanhem suas receitas e despesas, visualizem relatórios detalhados, planejem o futuro (incluindo aposentadoria e metas), e organizem suas categorias e dados. O objetivo é fornecer uma visão clara e organizada das finanças para ajudar na tomada de decisões e na busca pela independência financeira.

✨ Funcionalidades Principais
Dashboard Interativo: Visão geral com gráficos e cards para Receitas, Despesas, Patrimônio Investido e Sobra, com filtros por mês.

Gestão de Transações (Receitas/Despesas): Cadastro, visualização, edição e exclusão de transações (Único, Fixo, Parcelado).

Modal de Exclusão Inteligente: Permite apagar uma transação apenas no mês atual ou em todos os meses em que foi cadastrada.

Situação da Despesa: Marcação de despesas como Pagas, Pendentes ou Atrasadas.

Planejamento de Aposentadoria: Ferramenta de simulação detalhada para a independência financeira, permitindo configurar idade de aposentadoria, renda desejada, e taxas de retorno/inflação.

Configurações de Usuário e Dados:

Alteração de Nome e Senha.

Gestão de Categorias (Receitas e Despesas), incluindo edição e exclusão.

Restauração de categorias padrão.

Exportação e Importação de dados em JSON.

Recursos Futuros (Ideias de Desenvolvimento):

Implementação de um sistema de gestão de Investimentos mais aprofundado.

Criação de uma página dedicada à gestão de Metas financeiras.

Adição de um campo para registro de Cartão de Crédito nos formulários de transação.

Melhoria no Relatório Financeiro para maior relevância.

🛠️ Tecnologias Utilizadas
Frontend:

HTML5/CSS3

Tailwind CSS: Para estilos utilitários e responsivos.

Chart.js e chartjs-plugin-datalabels: Para a criação de gráficos e visualização de dados.

Font Awesome e Bootstrap Icons: Para ícones.

Backend & Cloud Services:

Firebase: Para autenticação (firebase-auth-compat.js) e armazenamento de dados (firebase-firestore-compat.js).

Firebase Authentication: Usado para garantir que apenas usuários logados acessem as páginas (auth-guard.js).

⚙️ Instalação e Configuração
Para executar o projeto localmente, siga os passos abaixo:

Pré-requisitos
Um navegador web moderno.

Conexão à internet (necessária para os scripts CDN e Firebase).

1. Configuração do Firebase
O projeto depende da inicialização do Firebase para autenticação e banco de dados.

Crie um projeto no console do Firebase.

Obtenha as chaves de configuração do seu aplicativo Web.

Assegure-se de que o arquivo firebase-init.js contenha suas credenciais:

JavaScript

const firebaseConfig = {
    apiKey: "SEU_API_KEY",
    authDomain: "SEU_AUTH_DOMAIN",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_STORAGE_BUCKET",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
};
firebase.initializeApp(firebaseConfig);
(Nota: Os valores de exemplo nos arquivos foram mascarados e devem ser substituídos pelos seus)

2. Execução Local
Como é um projeto puramente frontend com dependências externas (CDN e Firebase), você pode executá-lo abrindo o arquivo index.html diretamente no seu navegador, ou usando uma extensão de "Live Server" em seu editor de código para melhor experiência.

Navegue até o diretório raiz do projeto.

Abra o arquivo index.html no seu navegador.

O sistema redirecionará para a página de login/cadastro, controlada pelo Firebase Auth.

🤝 Contribuições
Sinta-se à vontade para sugerir melhorias, reportar bugs ou contribuir com novas funcionalidades!
