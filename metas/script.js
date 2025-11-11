    // Inicialização do Firebase
    const db = firebase.firestore();
    const auth = firebase.auth();

    function formatCurrency(value) {
        return value.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Listener para garantir que a autenticação está concluída
    document.addEventListener("DOMContentLoaded", function () {
        showLoading();

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    await user.reload();

                    const userPhoto = document.getElementById("user-photo");
                    const photoURL = user.photoURL;
                    const userEmail = document.getElementById("user-email");

                    const email = user.email || "E-mail não disponível";
                    userEmail.textContent = email;

                    if (photoURL && userPhoto) {
                        userPhoto.src = photoURL;
                        userPhoto.classList.remove("hidden");
                    } else if (userPhoto) {
                        userPhoto.classList.add("hidden");
                    }

                    loadUserName(user);
                    hideLoading();
                    initGoals(); // Inicializar sistema de metas após autenticação
                } catch (error) {
                    console.error("Erro ao atualizar dados do usuário:", error);
                    hideLoading();
                }
            } else {
                console.error("Usuário não autenticado.");
                hideLoading();
                window.location.href = "/index.html";
            }
        });
    });

    // Função para deslogar o usuário
    function logout() {
        firebase
            .auth()
            .signOut()
            .then(() => {
                window.location.href = "/index.html";
            })
            .catch((error) => {
                showAlert("Erro ao deslogar: " + error.message, "error");
            });
    }

    // Sistema de dropdown do usuário
    const dropdownButton = document.getElementById("dropdownButton");
    const dropdownMenu = document.getElementById("dropdownMenu");

    if (dropdownButton) {
        dropdownButton.addEventListener("click", () => {
            dropdownMenu.classList.toggle("hidden");
        });
    }

    // Fechar dropdown ao clicar fora
    document.addEventListener("click", (event) => {
        if (dropdownButton && !dropdownButton.contains(event.target)) {
            dropdownMenu.classList.add('hidden');
        }
    });

    // Sistema de alertas
    function showAlert(message, type = "success") {
        const alertContainer = document.getElementById("alert-container");
        const alert = document.createElement("div");

        // Classes base
        let baseClasses =
            "flex items-center px-4 py-3 rounded shadow-md transition-opacity duration-300";

        // Classes por tipo
        let typeClasses = "";
        if (type === "success") {
            typeClasses = "bg-green-500 text-white hover:bg-green-600 transition-colors cursor-default select-none";
        } else if (type === "error") {
            typeClasses = "bg-red-500 text-white hover:bg-red-600 transition-colors cursor-default select-none";
        } else if (type === "info") {
            typeClasses = "bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-default select-none";
        } else if (type === "warning") {
            typeClasses = "bg-yellow-500 text-white hover:bg-yellow-600 transition-colors cursor-default select-none";
        }

        alert.className = `${baseClasses} ${typeClasses}`;
        alert.innerHTML = `
          <span class="flex-grow">${message}</span>
          <button class="ml-4 text-lg font-bold focus:outline-none">&times;</button>
        `;

        // Remover alerta ao clicar no botão ou após 5 segundos
        alert.querySelector("button").addEventListener("click", () => {
            alert.remove();
        });

        setTimeout(() => {
            alert.remove();
        }, 3000);

        alertContainer.appendChild(alert);
    }

    // Sistema de Metas Financeiras
    let goals = [];
    let currentFilter = 'all';
    let currentSelectedGoal = null;
    let goalToDeleteId = null;
    let currentEditingGoalId = null;

    // Referência à coleção de metas do usuário
    function goalsRef() {
        return db.collection('users')
            .doc(auth.currentUser.uid)
            .collection('goals');
    }

    // Inicialização do sistema de metas
    function initGoals() {
        if (!auth.currentUser) return;
        
        loadGoals();
        setupEventListeners();
    }

    // Busca todas as metas no Firestore e carrega UI
    async function loadGoals() {
        showLoading();
        try {
            const snap = await goalsRef().orderBy('createdAt', 'desc').get();
            goals = snap.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    name: d.name,
                    description: d.description || '',
                    amount: Number(d.amount) || 0,
                    currentAmount: Number(d.currentAmount) || 0,
                    deadline: d.deadline,
                    priority: d.priority,
                    category: d.category || '',
                    recurring: d.recurring || false,
                    createdAt: d.createdAt
                };
            });
            renderGoals(currentFilter);
            updateSummary();
        } catch (error) {
            console.error("Erro ao carregar metas:", error);
            showAlert("Erro ao carregar metas", "error");
        } finally {
            hideLoading();
        }
    }

    // Grava nova meta no Firestore
    async function addNewGoal() {
        const name = document.getElementById('goalName').value.trim();
        const description = document.getElementById('goalDescription').value.trim();
        const amount = parseFloat(document.getElementById('goalAmount').value);
        const current = parseFloat(document.getElementById('goalCurrentAmount').value) || 0;
        const deadline = document.getElementById('goalDeadline').value;
        const priority = document.getElementById('goalPriority').value;
        const category = document.getElementById('goalCategory').value;
        const recurring = document.getElementById('goalRecurring').checked;

        if (!name || isNaN(amount) || amount <= 0 || !deadline) {
            showAlert('Preencha todos os campos obrigatórios corretamente.', 'error');
            return;
        }
        if (current > amount) {
            showAlert('Valor atual não pode ser maior que o valor da meta.', 'error');
            return;
        }

        showLoading();

        try {
            const newGoalRef = await goalsRef().add({
                name,
                description,
                amount,
                currentAmount: current,
                deadline,
                priority,
                category,
                recurring,
                createdAt: firebase.firestore.Timestamp.now()
            });

            // Se houver valor atual inicial, adicione como uma contribuição
            if (current > 0) {
                await newGoalRef.collection('contributions').add({
                    value: current,
                    date: firebase.firestore.Timestamp.now(),
                    type: 'initial'
                });
            }

            document.getElementById('goalForm').reset();
            closeAddGoalModal();
            await loadGoals();
            showAlert('Meta adicionada com sucesso!', 'success');
        } catch (error) {
            console.error("Erro ao adicionar meta:", error);
            showAlert("Erro ao adicionar meta", "error");
        } finally {
            hideLoading();
        }
    }

    // Atualiza meta existente no Firestore
    async function updateGoalData(goal) {
        const data = {
            name: goal.name,
            description: goal.description,
            amount: goal.amount,
            currentAmount: goal.currentAmount,
            deadline: goal.deadline,
            priority: goal.priority,
            category: goal.category,
            recurring: goal.recurring
        };
        await goalsRef().doc(goal.id).update(data);
        await loadGoals();
    }

    // Remove meta do Firestore
    async function deleteGoalData(id) {
        try {
            // Deletar subcoleção de contribuições primeiro
            const contributionsSnapshot = await goalsRef().doc(id).collection('contributions').get();
            const batch = db.batch();
            contributionsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            await goalsRef().doc(id).delete();
            await loadGoals();
        } catch (error) {
            console.error("Erro ao excluir meta:", error);
            throw error;
        }
    }

    // Configura todos os event listeners de UI
    function setupEventListeners() {
        // Modal de adicionar meta
        const addGoalBtn = document.getElementById('addGoalBtn');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelGoalBtn = document.getElementById('cancelGoalBtn');
        const modalBackdrop = document.getElementById('modalBackdrop');
        const goalForm = document.getElementById('goalForm');

        if (addGoalBtn) {
            addGoalBtn.addEventListener('click', openAddGoalModal);
        }
        
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeAddGoalModal);
        }
        
        if (cancelGoalBtn) {
            cancelGoalBtn.addEventListener('click', closeAddGoalModal);
        }
        
        if (modalBackdrop) {
            modalBackdrop.addEventListener('click', closeAddGoalModal);
        }
        
        if (goalForm) {
            goalForm.addEventListener('submit', function(e) {
                e.preventDefault();
                // Verifica o "modo"
                if (currentEditingGoalId) {
                    handleUpdateGoal(); // Se tem ID, ATUALIZA
                } else {
                    addNewGoal();       // Se não tem ID, ADICIONA
                }
            });
        }

        // Modal de detalhes da meta
        const closeDetailsModalBtn = document.getElementById('closeDetailsModalBtn');
        if (closeDetailsModalBtn) {
            closeDetailsModalBtn.addEventListener('click', () => {
                document.getElementById('goalDetailsModal').classList.add('hidden');
                modalBackdrop.classList.add('hidden');
            });
        }

        // Modal de confirmação de exclusão
        const closeConfirmDeleteModalBtn = document.getElementById('closeConfirmDeleteModalBtn');
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

        if (closeConfirmDeleteModalBtn) {
            closeConfirmDeleteModalBtn.addEventListener('click', () => {
                document.getElementById('confirmDeleteModal').classList.add('hidden');
                modalBackdrop.classList.add('hidden');
            });
        }

        const tableWrapper = document.getElementById('tableWrapper');
        if (tableWrapper) {
            tableWrapper.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.delete-contribution-btn');
                if (deleteBtn) {
                    const goalId = deleteBtn.dataset.goalId;
                    const contribId = deleteBtn.dataset.contribId;
                    openDeleteContributionModal(goalId, contribId);
                }
            });
        }
            
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', () => {
                document.getElementById('confirmDeleteModal').classList.add('hidden');
                modalBackdrop.classList.add('hidden');
            });
        }
        
if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', async () => {
                const btn = confirmDeleteBtn;
                const goalId = btn.dataset.goalId;
                const contribId = btn.dataset.contribId; // Este só existe se for uma contribuição

                // Esconde o modal IMEDIATAMENTE
                document.getElementById('confirmDeleteModal').classList.add('hidden');
                document.getElementById('modalBackdrop').classList.add('hidden');
                
                showLoading();
                try {
                    if (contribId && goalId) {
                        // MODO: Excluir Contribuição
                        await handleDeleteContribution(goalId, contribId);
                        // A função 'handleDeleteContribution' já recarrega e mostra o alerta

                    } else if (goalId) {
                        // MODO: Excluir Meta
                        await deleteGoalData(goalId); // Esta é sua função original de deletar
                        showAlert('Meta excluída com sucesso!', 'success');
                        
                        // Navega de volta para a lista principal (como fizemos antes)
                        document.getElementById('goalDetailsPage').classList.add('hidden');
                        document.querySelector('main').classList.remove('hidden');
                        document.getElementById('addGoalBtn').classList.remove('hidden');
                    }
                    
                    // Limpa os datasets do botão para a próxima vez
                    delete btn.dataset.goalId;
                    delete btn.dataset.contribId;
                    
                } catch (error) {
                    console.error("Erro durante a exclusão:", error);
                    showAlert('Erro ao excluir: ' + error.message, 'error');
                } finally {
                    hideLoading();
                }
            });
        }

// Filtros
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        // [INÍCIO DA CORREÇÃO]
        // Define as classes de estilo
        const activeClasses = ['active', 'bg-green-600', 'text-white', 'border-green-600'];
        const inactiveClasses = ['border-zinc-700', 'text-zinc-400', 'hover:bg-zinc-700', 'hover:text-zinc-100']; // Classes do HTML da Opção 1

        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove o 'active' de TODOS os botões
                filterButtons.forEach(b => {
                    b.classList.remove(...activeClasses);
                    // Adiciona o estilo de 'inativo' de volta
                    b.classList.add(...inactiveClasses);
                });
                
                // Adiciona o 'active' APENAS no botão clicado
                btn.classList.add(...activeClasses);
                // Remove o estilo de 'inativo'
                btn.classList.remove(...inactiveClasses);

                currentFilter = btn.dataset.filter;
                renderGoals(currentFilter);
                updateSummary();
            });
        });

        // Ativa o primeiro botão ("Todas") por padrão ao carregar a página
        if (filterButtons.length > 0) {
            filterButtons[0].classList.add(...activeClasses);
            filterButtons[0].classList.remove(...inactiveClasses);
        }

        // Navegação entre lista e detalhes
        const backToListBtn = document.getElementById('backToList');
        if (backToListBtn) {
            backToListBtn.addEventListener('click', () => {
                document.getElementById('goalDetailsPage').classList.add('hidden');
                document.querySelector('main').classList.remove('hidden');
                document.getElementById('addGoalBtn').classList.remove('hidden');
            });
        }

        // Fechar modais com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAddGoalModal();
                document.getElementById('goalDetailsModal').classList.add('hidden');
                document.getElementById('confirmDeleteModal').classList.add('hidden');
                modalBackdrop.classList.add('hidden');
            }
        });
    }

    // Abrir modal de adicionar meta
    function openAddGoalModal() {
        document.getElementById('addGoalModal').classList.add('open');
        document.getElementById('modalBackdrop').classList.remove('hidden');
        document.getElementById('modalBackdrop').classList.add('active');
        
        // Definir data mínima como hoje
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('goalDeadline').min = today;
    }

    // Fechar modal de adicionar meta
    function closeAddGoalModal() {
        document.getElementById('addGoalModal').classList.remove('open');
        document.getElementById('modalBackdrop').classList.remove('active');
        setTimeout(() => {
            document.getElementById('modalBackdrop').classList.add('hidden');
        }, 300);

        // [INÍCIO DA ADIÇÃO] - Reseta o formulário para o modo "Adicionar"
        currentEditingGoalId = null; // Limpa o ID de edição
        document.querySelector('#addGoalModal h3').textContent = 'Nova Meta Financeira';
        document.querySelector('#goalForm button[type="submit"]').textContent = 'Adicionar Meta';
        document.getElementById('goalForm').reset();
        // [FIM DA ADIÇÃO]
    }

    // Renderiza todos os cards de metas
    function renderGoals(filter = 'all') {
        const goalsContainer = document.getElementById('goalsContainer');
        if (!goalsContainer) return;
        
        goalsContainer.innerHTML = '';
        let filtered = [...goals];
        
        if (filter === 'active') filtered = filtered.filter(g => g.currentAmount < g.amount);
        if (filter === 'completed') filtered = filtered.filter(g => g.currentAmount >= g.amount);

        if (filtered.length === 0) {
            goalsContainer.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-inbox text-4xl text-zinc-300 mb-4"></i>
                    <p class="text-zinc-500">Nenhuma meta ${filter === 'all' ? 'encontrada' : filter === 'active' ? 'em andamento' : 'concluída'}</p>
                </div>`;
            return;
        }

        filtered
            .sort((a, b) => {
                if (a.currentAmount >= a.amount && b.currentAmount < b.amount) return 1;
                if (a.currentAmount < a.amount && b.currentAmount >= b.amount) return -1;
                const pr = { high: 3, medium: 2, low: 1 };
                if (pr[a.priority] > pr[b.priority]) return -1;
                if (pr[a.priority] < pr[b.priority]) return 1;
                return new Date(a.deadline) - new Date(b.deadline);
            })
            .forEach(goal => {
                const progress = Math.min(Math.round((goal.currentAmount / goal.amount) * 100), 100);
                const isCompleted = goal.currentAmount >= goal.amount;
                const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));

                const remainingAmount = Math.max(0, goal.amount - goal.currentAmount);
                const deadlineDate = new Date(goal.deadline);
                const today = new Date();
                let monthsLeft = 0;

                if (deadlineDate > today && remainingAmount > 0) {
                    monthsLeft = (deadlineDate.getFullYear() - today.getFullYear()) * 12 + (deadlineDate.getMonth() - today.getMonth());
                    // Se a data limite é neste mês, mas ainda não passou, conta como 1 mês
                    if (monthsLeft === 0 && deadlineDate.getDate() >= today.getDate()) {
                        monthsLeft = 1; 
                    }
                }

                let monthlyContribution = 0;
                if (remainingAmount > 0) {
                    if (monthsLeft > 0) {
                        monthlyContribution = remainingAmount / monthsLeft;
                    } else {
                        // Atrasado ou expira este mês, precisa de todo o valor restante
                        monthlyContribution = remainingAmount;
                    }
                }

                const card = document.createElement('div');
                card.className = `
                    goal-card bg-zinc-800 text-zinc-50 rounded-xl shadow-sm p-6
                    border border-zinc-700 transition-all duration-300 cursor-pointer
                    ${isCompleted ? 'opacity-80' : ''}
                `;
                card.dataset.id = goal.id;

                // Monta innerHTML
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1 min-w-0">
                            <h3 class="font-bold text-zinc-50 truncate">${goal.name}</h3>
                            ${goal.category ? `<span class="text-xs text-zinc-400 mt-1 block">${getCategoryName(goal.category)}</span>` : ''}
                        </div>
                        <span class="px-2 py-1 rounded text-xs ${
                            goal.priority === 'high' ? 'bg-red-900 bg-opacity-25 text-red-500' :
                            goal.priority === 'medium' ? 'bg-yellow-900 bg-opacity-25 text-yellow-500' :
                            'bg-blue-900 bg-opacity-25 text-blue-500'
                        }">${
                            goal.priority === 'high' ? 'Alta' :
                            goal.priority === 'medium' ? 'Média' :
                            'Baixa'
                        }</span>
                    </div>
                    ${goal.description ? `<p class="text-sm text-zinc-400 mb-4 line-clamp-2">${goal.description}</p>` : ''}
                    <div class="mb-4">
                        <div class="flex justify-between text-sm text-zinc-300 mb-1">
                            <span>Progresso</span><span>${progress}%</span>
                        </div>
                        <div class="w-full bg-zinc-700 rounded-full h-2">
                            <div class="bg-green-500 h-2 rounded-full transition-all duration-500" style="width:${progress}%"></div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-zinc-300">Valor</p>
                            <p class="font-medium text-zinc-50">R$ ${goal.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                            <p class="text-zinc-300">Atual</p>
                            <p class="font-medium ${
                                isCompleted ? 'text-green-500' : 'text-zinc-50'
                            }">R$ ${goal.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                            <p class="text-zinc-300">Data Limite</p>
                            <p class="font-medium text-zinc-50">${formatDate(goal.deadline)}</p>
                        </div>
                        <div>
                        <p class="text-zinc-300">Meta Mensal</p>
                            <p class="font-bold ${ // Mudei para font-bold e cor amarela
                                isCompleted ? 'text-green-500' : 'text-yellow-400'
                            }">R$ ${
                                isCompleted ? '0,00' : formatCurrency(monthlyContribution) // Usa a nova variável
                            }</p>
                        </div>
                    </div>
                `;

                // Se concluído, adiciona badge
                if (isCompleted) {
                    const done = document.createElement('div');
                    done.className = 'mt-4 py-2 text-center bg-green-500 text-zinc-50 rounded-lg text-sm';
                    done.innerHTML = '<i class="fas fa-check-circle mr-1"></i> Meta concluída';
                    card.appendChild(done);
                }

                card.addEventListener('click', () => showGoalDetailPage(goal));
                goalsContainer.appendChild(card);
            });
    }

    // Abre modal de detalhes da meta
    function showGoalDetails(goalId) {
        const g = goals.find(x => x.id === goalId);
        if (!g) return;
        currentSelectedGoal = g;

        // Popula campos do modal de detalhes
        const progress = Math.min(Math.round((g.currentAmount / g.amount) * 100), 100);
        const daysLeft = Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24));

        document.getElementById('detailTitle').textContent = g.name;
        document.getElementById('detailProgressPercent').textContent = `${progress}%`;
        document.getElementById('detailGoalAmount').textContent = `R$ ${g.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('detailCurrentAmount').textContent = `R$ ${g.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('detailDeadline').textContent = formatDate(g.deadline);
        document.getElementById('detailPriority').innerHTML = `
            <span class="px-2 py-1 rounded text-xs ${
                g.priority === 'high' ? 'bg-red-900 bg-opacity-25 text-red-500' :
                g.priority === 'medium' ? 'bg-yellow-900 bg-opacity-25 text-yellow-500' :
                'bg-blue-900 bg-opacity-25 text-blue-500'
            }">${
                g.priority === 'high' ? 'Alta' :
                g.priority === 'medium' ? 'Média' :
                'Baixa'
            }</span>
        `;
        
        // Círculo de progresso
        const circle = document.getElementById('detailProgressCircle');
        const r = circle.r.baseVal.value;
        const c = 2 * Math.PI * r;
        circle.style.strokeDasharray = `${c} ${c}`;
        circle.style.strokeDashoffset = c - (progress / 100) * c;

        // Botão de adicionar valor
        document.getElementById('addAmountBtn').onclick = async () => {
            const v = parseFloat(document.getElementById('addToGoal').value);
            if (isNaN(v) || v <= 0) {
                showAlert('Valor inválido para adicionar.', 'error');
                return;
            }

            showLoading();
            try {
                // Adiciona a contribuição
                await goalsRef().doc(g.id).collection('contributions').add({
                    value: v,
                    date: firebase.firestore.Timestamp.now(),
                    type: 'manual_add'
                });

                // Recalcula o total pago para a meta
                const updatedContribSnap = await goalsRef().doc(g.id).collection('contributions').get();
                const updatedTotalCurrentAmount = updatedContribSnap.docs.reduce((sum, doc) => sum + doc.data().value, 0);

                // Atualiza currentAmount no Firestore e no objeto local
                await goalsRef().doc(g.id).update({ currentAmount: updatedTotalCurrentAmount });
                g.currentAmount = updatedTotalCurrentAmount;

                document.getElementById('addToGoal').value = '';
                showAlert('Valor adicionado à meta!', 'success');
                showGoalDetails(g.id); // Atualiza o modal
                await loadGoals(); // Atualiza a lista
            } catch (error) {
                console.error("Erro ao adicionar valor:", error);
                showAlert("Erro ao adicionar valor", "error");
            } finally {
                hideLoading();
            }
        };

        // Botão de editar
        document.getElementById('editGoalBtn').onclick = () => {
            document.getElementById('goalDetailsModal').classList.add('hidden');
            document.getElementById('modalBackdrop').classList.add('hidden');
            setTimeout(() => editGoal(g), 300);
        };

        // Botão de excluir
document.getElementById('deleteGoalBtn').onclick = () => {
        // [INÍCIO DA CORREÇÃO]
        const modal = document.getElementById('confirmDeleteModal');
        const confirmBtn = document.getElementById('confirmDeleteBtn');

        // Configura o modal para "Excluir Meta"
        document.getElementById('confirmDeleteTitle').textContent = 'Excluir Meta';
        document.getElementById('confirmDeleteText').textContent = 'Tem certeza que deseja excluir esta meta? Todas as contribuições também serão excluídas.';

        // Seta os data-attributes no botão "Sim"
        confirmBtn.dataset.goalId = goal.id;
        // Limpa o ID da contribuição para garantir que é uma meta
        delete confirmBtn.dataset.contribId; 
        
        // Abre o modal de confirmação
        modal.classList.remove('hidden');
        document.getElementById('modalBackdrop').classList.remove('hidden');
        // [FIM DA CORREÇÃO]
    };


        // Botão de ver detalhes
        document.getElementById('viewDetailsBtn').onclick = () => {
            document.getElementById('goalDetailsModal').classList.add('hidden');
            document.getElementById('modalBackdrop').classList.add('hidden');
            showGoalDetailPage(g);
        };

        document.getElementById('goalDetailsModal').classList.remove('hidden');
        document.getElementById('modalBackdrop').classList.remove('hidden');
    }

    // Mostra página de detalhes completa
async function showGoalDetailPage(goal) {
    currentSelectedGoal = goal; // Manter a referência global

    // 1. Mostrar a página de detalhes e esconder a lista
    document.querySelector('main').classList.add('hidden');
    document.getElementById('goalDetailsPage').classList.remove('hidden');
    document.getElementById('addGoalBtn').classList.add('hidden');
    
    // 2. Preencher dados básicos
    document.getElementById('detailGoalName').textContent = goal.name;
    
    const remaining = goal.amount - goal.currentAmount;
    document.getElementById('detailRemaining').textContent = 
        remaining > 0 ? `Faltam R$ ${formatCurrency(remaining)} para concluir` : 
        'Meta concluída!';
        
    document.getElementById('miniGoalTotal').textContent = `R$ ${formatCurrency(goal.amount)}`;
    document.getElementById('miniCurrentPaid').textContent = `R$ ${formatCurrency(goal.currentAmount)}`;
    
    const progress = Math.min(Math.round((goal.currentAmount / goal.amount) * 100), 100);
    document.getElementById('miniSituation').textContent = `${progress}% concluído`;
    
    // Calcular meses restantes
    const deadline = new Date(goal.deadline);
    const today = new Date();
    let monthsLeft = 0;

    if (deadline > today && (goal.amount - goal.currentAmount) > 0) {
        monthsLeft = (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth());
        if (monthsLeft === 0 && deadline.getDate() >= today.getDate()) {
            monthsLeft = 1;
        }
    }
    document.getElementById('miniMonthsLeft').textContent = `${monthsLeft} meses`;
    const remainingAmount = Math.max(0, goal.amount - goal.currentAmount);
    let monthlyContribution = 0;
    if (remainingAmount > 0) {
        if (monthsLeft > 0) {
            monthlyContribution = remainingAmount / monthsLeft;
        } else {
            // Se expira este mês ou já expirou, precisa de tudo agora
            monthlyContribution = remainingAmount;
        }
    }
    document.getElementById('miniMonthlyGoal').textContent = `R$ ${formatCurrency(monthlyContribution)}`;

    // 3. Preencher dados do progresso (lógica movida do modal)
    document.getElementById('detailProgressPercent').textContent = `${progress}%`;
    const circle = document.getElementById('detailProgressCircle');
    if (circle) {
        const r = circle.r.baseVal.value;
        const c = 2 * Math.PI * r;
        circle.style.strokeDasharray = `${c} ${c}`;
        circle.style.strokeDashoffset = c - (progress / 100) * c;
    }

    // 4. Carregar a tabela de contribuições
    loadContributionsTable(goal.id);

    // 5. Re-anexar os listeners (lógica movida do modal)
    
    // Botão de adicionar valor
    document.getElementById('addAmountBtn').onclick = async () => {
        const v = parseFloat(document.getElementById('addToGoal').value);
        if (isNaN(v) || v <= 0) {
            showAlert('Valor inválido para adicionar.', 'error');
            return;
        }

        showLoading();
        try {
            await goalsRef().doc(goal.id).collection('contributions').add({
                value: v,
                date: firebase.firestore.Timestamp.now(),
                type: 'manual_add'
            });

            const updatedContribSnap = await goalsRef().doc(goal.id).collection('contributions').get();
            const updatedTotalCurrentAmount = updatedContribSnap.docs.reduce((sum, doc) => sum + doc.data().value, 0);

            await goalsRef().doc(goal.id).update({ currentAmount: updatedTotalCurrentAmount });
            goal.currentAmount = updatedTotalCurrentAmount; // Atualiza o objeto local

            document.getElementById('addToGoal').value = '';
            showAlert('Valor adicionado à meta!', 'success');
            showGoalDetailPage(goal); // Recarrega a página de detalhes com novos dados
            await loadGoals(); // Atualiza a lista de fundo
        } catch (error) {
            console.error("Erro ao adicionar valor:", error);
            showAlert("Erro ao adicionar valor", "error");
        } finally {
            hideLoading();
        }
    };

    // Botão de editar
    document.getElementById('editGoalBtn').onclick = () => {
        document.getElementById('goalDetailsPage').classList.add('hidden');
        document.querySelector('main').classList.remove('hidden');
        document.getElementById('addGoalBtn').classList.remove('hidden');
        editGoal(goal); // 'editGoal' já abre o modal lateral
    };

    // Botão de excluir
    document.getElementById('deleteGoalBtn').onclick = () => {
        // [INÍCIO DA CORREÇÃO]
        const modal = document.getElementById('confirmDeleteModal');
        const confirmBtn = document.getElementById('confirmDeleteBtn');

        // Configura o modal para "Excluir Meta"
        document.getElementById('confirmDeleteTitle').textContent = 'Excluir Meta';
        document.getElementById('confirmDeleteText').textContent = 'Tem certeza que deseja excluir esta meta? Todas as contribuições também serão excluídas.';

        // Seta os data-attributes no botão "Sim"
        confirmBtn.dataset.goalId = goal.id;
        // Limpa o ID da contribuição para garantir que é uma meta
        delete confirmBtn.dataset.contribId; 
        
        // Abre o modal de confirmação
        modal.classList.remove('hidden');
        document.getElementById('modalBackdrop').classList.remove('hidden');
        // [FIM DA CORREÇÃO]
    };
}

    // Carrega tabela de contribuições (simplificado)
async function loadContributionsTable(goalId) {
    try {
        const contribSnap = await goalsRef().doc(goalId).collection('contributions').orderBy('date', 'desc').get();
        const contribs = contribSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let html = `
            <table class="w-full text-sm">
                <thead class="bg-zinc-800 text-zinc-50 sticky top-0">
                    <tr>
                        <th class="px-4 py-3 text-left">Data</th>
                        <th class="px-4 py-3 text-left">Valor</th>
                        <th class="px-4 py-3 text-left">Tipo</th>
                        <th class="px-4 py-3 text-center">Ações</th> </tr>
                </thead>
                <tbody class="bg-zinc-900 text-zinc-50">
        `;
        
        if (contribs.length === 0) {
            html += `
                <tr>
                    <td colspan="4" class="px-4 py-6 text-center text-zinc-500">
                        Nenhuma contribuição registrada
                    </td>
                </tr>
            `;
        } else {
            contribs.forEach(contrib => {
                const date = contrib.date.toDate ? contrib.date.toDate() : new Date(contrib.date);
                html += `
                    <tr class="border-t border-zinc-700">
                        <td class="px-4 py-3">${formatDate(date)}</td>
                        <td class="px-4 py-3">R$ ${contrib.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="px-4 py-3">${getContributionTypeName(contrib.type)}</td>
                        
                        <td class="px-4 py-3 text-center">
                            <button class="delete-contribution-btn text-red-500 hover:text-red-700"
                                    data-contrib-id="${contrib.id}"
                                    data-goal-id="${goalId}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `</tbody></table>`;
        document.getElementById('tableWrapper').innerHTML = html;
    } catch (error) {
        console.error("Erro ao carregar contribuições:", error);
        document.getElementById('tableWrapper').innerHTML = '<p class="p-4 text-red-500">Erro ao carregar contribuições</p>';
    }
}

    // Abre modal de edição de meta
function editGoal(goal) {
    // Preencher formulário com dados atuais
    document.getElementById('goalName').value = goal.name;
    document.getElementById('goalDescription').value = goal.description || '';
    document.getElementById('goalAmount').value = goal.amount;
    document.getElementById('goalCurrentAmount').value = goal.currentAmount;
    document.getElementById('goalDeadline').value = goal.deadline;
    document.getElementById('goalPriority').value = goal.priority;
    document.getElementById('goalCategory').value = goal.category || '';
    document.getElementById('goalRecurring').checked = goal.recurring || false;
    
    // Alterar título do modal
    document.querySelector('#addGoalModal h3').textContent = 'Editar Meta';
    
    // Alterar botão de submit
    document.querySelector('#goalForm button[type="submit"]').textContent = 'Salvar Alterações';

    // Definir o ID de edição
    currentEditingGoalId = goal.id;
    
    // Abrir o modal
    openAddGoalModal();
}

    // Atualiza indicadores de resumo
function updateSummary() {
    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => g.currentAmount >= g.amount).length;

    // [MUDANÇA] Calcula a soma do valor ATUAL, não do valor-alvo
    const totalCurrentAmount = goals.reduce((acc, g) => acc + g.currentAmount, 0);

    animateCount(document.getElementById('totalGoals'), totalGoals);
    animateCount(document.getElementById('completedGoals'), completedGoals);
    
    // [MUDANÇA] Alvo do elemento e variável atualizados
    animateCount(document.getElementById('totalCurrentAmount'), totalCurrentAmount, true);
}

    // Funções auxiliares
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    function animateCount(element, endValue, isCurrency = false, duration = 500) {
        if (!element) return;
        
        const start = 0;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = start + (endValue - start) * progress;

            if (isCurrency) {
                element.textContent = current.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            } else {
                element.textContent = Math.floor(current);
            }

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    function getCategoryName(category) {
        const categories = {
            'viagem': 'Viagem',
            'veiculo': 'Veículo',
            'casa': 'Casa',
            'educacao': 'Educação',
            'saude': 'Saúde',
            'lazer': 'Lazer',
            'outros': 'Outros'
        };
        return categories[category] || category;
    }

    function getContributionTypeName(type) {
        const types = {
            'initial': 'Valor Inicial',
            'manual_add': 'Adição Manual',
            'monthly_edit': 'Edição Mensal',
            'manual_current_edit': 'Edição Manual'
        };
        return types[type] || type;
    }

    async function handleUpdateGoal() {
    const updatedGoal = {
        id: currentEditingGoalId, // Pega o ID que está sendo editado
        name: document.getElementById('goalName').value.trim(),
        description: document.getElementById('goalDescription').value.trim(),
        amount: parseFloat(document.getElementById('goalAmount').value),
        currentAmount: parseFloat(document.getElementById('goalCurrentAmount').value) || 0,
        deadline: document.getElementById('goalDeadline').value,
        priority: document.getElementById('goalPriority').value,
        category: document.getElementById('goalCategory').value,
        recurring: document.getElementById('goalRecurring').checked
    };
    
    if (updatedGoal.currentAmount > updatedGoal.amount) {
        showAlert('Valor atual não pode ser maior que o valor da meta.', 'error');
        return;
    }
    
    showLoading();
    try {
        await updateGoalData(updatedGoal);
        closeAddGoalModal(); // closeAddGoalModal vai resetar o form
        showAlert('Meta atualizada com sucesso!', 'success');
    } catch (error) {
        console.error("Erro ao atualizar meta:", error);
        showAlert("Erro ao atualizar meta", "error");
    } finally {
        hideLoading();
    }
}

async function handleDeleteContribution(goalId, contributionId) {
    if (!goalId || !contributionId) return;

    // A confirmação foi removida daqui

    showLoading();
    try {
        // 1. Exclui o documento da contribuição
        await goalsRef().doc(goalId).collection('contributions').doc(contributionId).delete();

        // 2. Recalcula o total da meta
        const updatedContribSnap = await goalsRef().doc(goalId).collection('contributions').get();
        const updatedTotalCurrentAmount = updatedContribSnap.docs.reduce((sum, doc) => sum + doc.data().value, 0);

        // 3. Atualiza o documento principal da meta
        await goalsRef().doc(goalId).update({ currentAmount: updatedTotalCurrentAmount });

        // 4. Atualiza os objetos locais para a UI
        const goal = goals.find(g => g.id === goalId);
        if (goal) {
            goal.currentAmount = updatedTotalCurrentAmount;
        }
        if (currentSelectedGoal && currentSelectedGoal.id === goalId) {
            currentSelectedGoal.currentAmount = updatedTotalCurrentAmount;
        }

        showAlert('Contribuição excluída!', 'success');
        
        // 5. Atualiza a página de detalhes
        showGoalDetailPage(currentSelectedGoal);
        
        // 6. Atualiza a lista principal (em segundo plano)
        renderGoals(currentFilter);
        updateSummary();

    } catch (error) {
        console.error("Erro ao excluir contribuição:", error);
        showAlert("Erro ao excluir contribuição", "error");
    } finally {
        hideLoading();
    }
}

function openDeleteContributionModal(goalId, contributionId) {
    if (!goalId || !contributionId) return;

    const modal = document.getElementById('confirmDeleteModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    
    // Configura o modal
    document.getElementById('confirmDeleteTitle').textContent = 'Excluir Contribuição';
    document.getElementById('confirmDeleteText').textContent = 'Tem certeza que deseja excluir esta contribuição? Esta ação não pode ser desfeita.';

    // Seta os data-attributes no botão "Sim"
    confirmBtn.dataset.goalId = goalId;
    confirmBtn.dataset.contribId = contributionId; 

    // Abre o modal
    modal.classList.remove('hidden');
    document.getElementById('modalBackdrop').classList.remove('hidden');
}