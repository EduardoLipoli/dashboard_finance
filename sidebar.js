// sidebar.js

// Esta função será executada assim que o HTML da página for carregado
document.addEventListener('DOMContentLoaded', function() {

    // Pega o caminho da URL da página atual (ex: "/dashboard/index.html")
    const currentPath = window.location.pathname;

    // Seleciona todos os links dentro do sidebar
    const sidebarLinks = document.querySelectorAll('#sidebar a');

    // Define as classes CSS para os estados ativo e inativo
    const activeClasses = ['bg-zinc-800/50', 'text-green-400'];
    const inactiveClasses = ['text-zinc-400', 'hover:bg-zinc-700/50'];
    const inactiveClassesConfig = ['text-zinc-500', 'hover:bg-zinc-700/50']; // Para o link de "Configuração"

    // Itera sobre cada link do sidebar
    sidebarLinks.forEach(link => {
        const listItem = link.querySelector('li');
        if (!listItem) return;

        // Compara o href do link com o caminho da página atual
        if (link.pathname === currentPath) {
            // Se for a página atual, aplica o estilo de ATIVO
            listItem.classList.remove(...inactiveClasses, ...inactiveClassesConfig);
            listItem.classList.add(...activeClasses);
        } else {
            // Garante que os outros links tenham o estilo de INATIVO
            listItem.classList.remove(...activeClasses);
            
            // Verifica se é o link de configuração para aplicar a classe de cor correta
            if(link.pathname.includes('/configuration/')) {
                 listItem.classList.add(...inactiveClassesConfig);
            } else {
                 listItem.classList.add(...inactiveClasses);
            }
        }
    });
});