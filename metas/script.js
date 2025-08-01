const db = firebase.firestore();
const auth = firebase.auth();

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

const dropdownButton = document.getElementById("dropdownButton");
const dropdownMenu = document.getElementById("dropdownMenu");

dropdownButton.addEventListener("click", () => {
    dropdownMenu.classList.toggle("hidden");
});

// Fechar dropdown ao clicar fora
document.addEventListener("click", (event) => {
    if (!dropdownButton.contains(event.target)) {
        dropdownMenu.classList.add('hidden');
    }
});

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

// DOM Elements
const goalsContainer = document.getElementById('goalsContainer');
const addGoalBtn = document.getElementById('addGoalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const closeDetailsModalBtn = document.getElementById('closeDetailsModalBtn');
const addGoalModal = document.getElementById('addGoalModal');
const goalDetailsModal = document.getElementById('goalDetailsModal');
const goalForm = document.getElementById('goalForm');
const filterButtons = document.querySelectorAll('.filter-btn');
const totalGoalsElement = document.getElementById('totalGoals');
const completedGoalsElement = document.getElementById('completedGoals');
const totalAmountElement = document.getElementById('totalAmount');
// Containers de lista / detalhes
const detailPage = document.getElementById('goalDetailsPage');
const backToListBtn = document.getElementById('backToList');
const detailNameEl = document.getElementById('detailGoalName');

// Referências para o mini dashboard
const miniGoalTotalEl = document.getElementById('miniGoalTotal');
const miniCurrentPaidEl = document.getElementById('miniCurrentPaid');
const miniSituationEl = document.getElementById('miniSituation');
// Novas referências para meses e dias faltantes
const miniMonthsLeftEl = document.getElementById('miniMonthsLeft');


const tableWrapper = document.getElementById('tableWrapper');

// Elemento principal para o modal de escolha de ajuste (apenas a div pai)
const adjustmentModal = document.createElement('div');
adjustmentModal.id = 'adjustmentModal';
adjustmentModal.className = 'fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 hidden';
// O innerHTML e os botões internos serão adicionados em showAdjustmentOptions
document.body.appendChild(adjustmentModal);


// Referências para o modal de confirmação de exclusão
const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const closeConfirmDeleteModalBtn = document.getElementById('closeConfirmDeleteModalBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');


let goals = [];
let currentFilter = 'all';
let currentSelectedGoal = null;
let goalToDeleteId = null; // Para guardar o ID da meta a ser excluída

// Referência à coleção de metas do usuário
function goalsRef() {
    return db.collection('users')
        .doc(auth.currentUser.uid)
        .collection('goals');
}

// Quando o auth estiver pronto, inicia
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = '/index.html';
        return;
    }
    init();
});

// Inicialização: carrega metas e listeners
async function init() {
    await loadGoals();
    setupEventListeners();
}

// Busca todas as metas no Firestore e carrega UI
async function loadGoals() {
    showLoading();
    const snap = await goalsRef().orderBy('createdAt', 'desc').get();
    goals = snap.docs.map(doc => {
        const d = doc.data();
        return {
            id: doc.id,
            name: d.name,
            amount: Number(d.amount) || 0,
            currentAmount: Number(d.currentAmount) || 0,
            deadline: d.deadline,
            priority: d.priority,
            createdAt: d.createdAt
        };
    });
    renderGoals(currentFilter);
    updateSummary();
    hideLoading();
}

// Grava nova meta no Firestore
async function addNewGoal() {
    const name = goalForm.goalName.value.trim();
    const amount = parseFloat(goalForm.goalAmount.value);
    const current = parseFloat(goalForm.goalCurrentAmount.value) || 0;
    const deadline = goalForm.goalDeadline.value;
    const priority = goalForm.goalPriority.value;

    if (!name || isNaN(amount) || amount <= 0 || !deadline) {
        showAlert('Preencha todos os campos obrigatórios corretamente.', 'error');
        return;
    }
    if (current > amount) {
        showAlert('Valor atual não pode ser maior que o valor da meta.', 'error');
        return;
    }

    showLoading();

    const newGoalRef = await goalsRef().add({
        name,
        amount,
        currentAmount: current,
        deadline,
        priority,
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

    goalForm.reset();
    addGoalModal.classList.add('hidden');
    await loadGoals();
    hideLoading();
    showAlert('Meta adicionada com sucesso!', 'success');
}

// Atualiza meta existente no Firestore
async function updateGoalData(goal) {
    const data = {
        name: goal.name,
        amount: goal.amount,
        currentAmount: goal.currentAmount, // Manter currentAmount aqui para cards
        deadline: goal.deadline,
        priority: goal.priority
    };
    await goalsRef().doc(goal.id).update(data);
    await loadGoals(); // Recarrega todas as metas para atualizar o dashboard
}

// Remove meta do Firestore
async function deleteGoalData(id) {
    // Optionally, delete subcollection contributions first
    const contributionsSnapshot = await goalsRef().doc(id).collection('contributions').get();
    const batch = db.batch();
    contributionsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    await goalsRef().doc(id).delete();
    await loadGoals();
}

// Configura todos os event listeners de UI
function setupEventListeners() {
    // abrir/fechar modais (modais que estão no HTML estático)
    addGoalBtn.addEventListener('click', () => addGoalModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => addGoalModal.classList.add('hidden'));
    closeDetailsModalBtn.addEventListener('click', () => goalDetailsModal.classList.add('hidden'));
    // O adjustmentModal e seus botões serão configurados em showAdjustmentOptions

    // Fechar modal de confirmação de exclusão
    if (closeConfirmDeleteModalBtn) {
        closeConfirmDeleteModalBtn.addEventListener('click', () => confirmDeleteModal.classList.add('hidden'));
    }
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => confirmDeleteModal.classList.add('hidden'));
    }
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (goalToDeleteId) {
                showLoading();
                confirmDeleteModal.classList.add('hidden');
                // Fechar o modal de detalhes também, se estiver aberto e a meta for a mesma
                if (!goalDetailsModal.classList.contains('hidden') && currentSelectedGoal && currentSelectedGoal.id === goalToDeleteId) {
                    goalDetailsModal.classList.add('hidden');
                }
                await deleteGoalData(goalToDeleteId);
                hideLoading();
                showAlert('Meta excluída com sucesso!', 'success');
                goalToDeleteId = null; // Reseta a variável
                await loadGoals(); // Garante que o dashboard principal seja atualizado após a exclusão
            }
        });
    }

    // formulário de nova meta
    goalForm.addEventListener('submit', e => {
        e.preventDefault();
        addNewGoal();
    });

    // filtros
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active', 'bg-green-600', 'text-white'));
            btn.classList.add('active', 'bg-green-600', 'text-white');
            currentFilter = btn.dataset.filter;
            renderGoals(currentFilter);
            updateSummary();
        });
    });

    // fechar modais clicando fora
    window.addEventListener('click', e => {
        if (e.target === addGoalModal) addGoalModal.classList.add('hidden');
        if (e.target === goalDetailsModal) goalDetailsModal.classList.add('hidden');
        if (e.target === adjustmentModal) adjustmentModal.classList.add('hidden');
        if (e.target === confirmDeleteModal) confirmDeleteModal.classList.add('hidden');
    });

    // Atualiza a página principal ao voltar
    backToListBtn.addEventListener('click', async () => {
        detailPage.classList.add('hidden');
        document.querySelector('main').classList.remove('hidden');
        addGoalBtn.classList.remove('hidden'); // Show add goal button again
        await loadGoals(); // Força o recarregamento dos dados
    });
}


// Renderiza todos os cards mantendo seu design original
function renderGoals(filter = 'all') {
    goalsContainer.innerHTML = '';
    let filtered = [...goals];
    if (filter === 'active') filtered = filtered.filter(g => g.currentAmount < g.amount);
    if (filter === 'completed') filtered = filtered.filter(g => g.currentAmount >= g.amount);

    if (filtered.length === 0) {
        goalsContainer.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i class="fas fa-inbox text-4xl text-zinc-300 mb-4"></i>
        <p class="text-zinc-500">Nenhuma meta encontrada</p>
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
          <h3 class="font-bold text-zinc-50 truncate">${goal.name}</h3>
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
        <div class="mb-4">
          <div class="flex justify-between text-sm text-zinc-300 mb-1">
            <span>Progresso</span><span>${progress}%</span>
          </div>
          <div class="w-full bg-zinc-700 rounded-full h-2">
            <div class="bg-green-500 h-2 rounded-full" style="width:${progress}%"></div>
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
            <p class="text-zinc-300">Tempo Restante</p>
            <p class="font-medium ${
                daysLeft < 0 ? 'text-red-500' :
                    daysLeft <= 30 ? 'text-yellow-500' :
                        'text-zinc-50'
            }">${
                daysLeft < 0 ? 'Expirado' :
                    daysLeft === 0 ? 'Hoje' :
                        `${daysLeft} dias`
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

            card.addEventListener('click', () => showGoalDetails(goal.id));
            goalsContainer.appendChild(card);
        });
}


// Abre modal de detalhes e conecta botões a Firestore
function showGoalDetails(goalId) {
    const g = goals.find(x => x.id === goalId);
    if (!g) return;
    currentSelectedGoal = g;

    // Popula campos do modal de detalhes (o pequeno card circular)
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

    // Botões
    document.getElementById('addAmountBtn').onclick = async () => {
        const v = parseFloat(document.getElementById('addToGoal').value);
        if (isNaN(v) || v <= 0) {
            showAlert('Valor inválido para adicionar.', 'error');
            return;
        }

        showLoading();
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
        g.currentAmount = updatedTotalCurrentAmount; // Atualiza o objeto local

        document.getElementById('addToGoal').value = '';
        hideLoading();
        showAlert('Valor adicionado à meta!', 'success');

        // Chamar o modal de ajuste se a contribuição for significativa
        const remainingAfterAdd = g.amount - g.currentAmount;
        // Critério para exibir o ajuste:
        // 1. Meta ainda não atingida
        // 2. Contribuição é >= 10% do valor total da meta OU é >= 50% do planejado mensal atual
        const currentMonthlyPlannedData = calculateMonthlyPlanned(g, g.currentAmount); // Obtém o planejado para o cenário atual
        const currentMonthlyPlanned = currentMonthlyPlannedData.amount;
        
        if (remainingAfterAdd > 0 && 
            (v / g.amount > 0.1 || (currentMonthlyPlanned > 0 && v / currentMonthlyPlanned >= 0.5))) { 
            showAdjustmentOptions(g, v);
        } else {
            // Se não for uma contribuição grande, apenas atualiza a visualização sem perguntar
            await loadGoals(); // Recarrega todas as metas para atualizar o dashboard
            showGoalDetails(g.id); // Re-open details modal with updated info
        }
    };

    document.getElementById('editGoalBtn').onclick = () => {
        goalDetailsModal.classList.add('hidden');
        setTimeout(() => editGoal(g), 300);
    };

    // Altera para mostrar o modal de confirmação
    document.getElementById('deleteGoalBtn').onclick = () => {
        goalToDeleteId = g.id; // Armazena o ID da meta a ser excluída
        goalDetailsModal.classList.add('hidden'); // Fecha o modal de detalhes
        confirmDeleteModal.classList.remove('hidden'); // Abre o modal de confirmação
    };

    document.getElementById('viewDetailsBtn').onclick = () => {
        goalDetailsModal.classList.add('hidden');
        showGoalDetail(currentSelectedGoal); // This will navigate to the full details page
    };

    goalDetailsModal.classList.remove('hidden');
}

/**
 * Calcula o valor planejado mensalmente para o restante da meta e a nova data limite.
 * @param {object} goal - O objeto da meta.
 * @param {number} totalPaidSoFar - O valor total já contribuído para a meta.
 * @param {boolean} adjustMonths - Se true, calcula a nova deadline. Se false, calcula novo valor mensal.
 * @param {number} [targetMonthlyAmount=null] - (Opcional) Valor mensal alvo para o cálculo de meses.
 * @returns {object} { amount: novo valor mensal, months: total de meses, deadline: nova data limite }
 */
function calculateMonthlyPlanned(goal, totalPaidSoFar, adjustMonths = false, targetMonthlyAmount = null) {
    const remainingToPay = Math.max(0, goal.amount - totalPaidSoFar);

    const startDate = goal.createdAt.toDate();
    startDate.setDate(1); startDate.setHours(0, 0, 0, 0);

    let originalEndDate = new Date(goal.deadline);
    originalEndDate.setDate(new Date(originalEndDate.getFullYear(), originalEndDate.getMonth() + 1, 0).getDate());
    originalEndDate.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setDate(1); today.setHours(0, 0, 0, 0);

    let monthsToConsider = 0;
    let tempMonth = new Date(today);
    // Conta meses a partir do mês atual até a data limite original
    while (tempMonth <= originalEndDate) {
        monthsToConsider++;
        tempMonth.setMonth(tempMonth.getMonth() + 1);
    }
    
    let newMonthlyAmount = 0;
    let newDeadline = new Date(originalEndDate);
    let calculatedMonths = monthsToConsider;

    if (remainingToPay <= 0) {
        newMonthlyAmount = 0;
        newDeadline = today; // Meta concluída, deadline é o mês atual
        calculatedMonths = 0;
    } else if (adjustMonths) { // Opção de diminuir meses
        // Usar um valor mensal alvo para calcular quantos meses faltam
        // Se targetMonthlyAmount não for fornecido, tenta calcular um baseline do planejado original
        const originalStartDateForBaseline = goal.createdAt.toDate();
        originalStartDateForBaseline.setDate(1); originalStartDateForBaseline.setHours(0,0,0,0);
        let originalTotalMonthsDuration = 0;
        let tempOriginalMonthForBaseline = new Date(originalStartDateForBaseline);
        while (tempOriginalMonthForBaseline <= originalEndDate) {
            originalTotalMonthsDuration++;
            tempOriginalMonthForBaseline.setMonth(tempOriginalMonthForBaseline.getMonth() + 1);
        }
        const originalMonthlyPlannedBaseline = originalTotalMonthsDuration > 0 ? goal.amount / originalTotalMonthsDuration : 0;
        
        const effectiveTargetMonthlyAmount = Math.max(targetMonthlyAmount || originalMonthlyPlannedBaseline, 50); // Mínimo de R$ 50 para cálculo de meses para simulação
        
        calculatedMonths = Math.ceil(remainingToPay / effectiveTargetMonthlyAmount);
        // O valor mensal aqui é o "alvo", não necessariamente o final arredondado
        newMonthlyAmount = effectiveTargetMonthlyAmount; 

        newDeadline = new Date(today);
        if (calculatedMonths > 0) {
            newDeadline.setMonth(newDeadline.getMonth() + calculatedMonths - 1);
            newDeadline.setDate(new Date(newDeadline.getFullYear(), newDeadline.getMonth() + 1, 0).getDate());
            newDeadline.setHours(23,59,59,999);
        } else {
             newDeadline = today;
        }

    } else { // Opção de diminuir valor mensal (manter meses)
        newMonthlyAmount = monthsToConsider > 0 ? remainingToPay / monthsToConsider : remainingToPay;
        // Se monthsToConsider for 0 mas ainda houver restante, significa que a meta já expirou.
        // O valor mensal será o restante total para o 'mês atual' (o que já passou)
    }

    return { amount: newMonthlyAmount, months: calculatedMonths, deadline: newDeadline };
}


async function showGoalDetail(goal) {
    showLoading();
    // esconde botão Nova Meta (se existir)
    addGoalBtn.classList.add('hidden');

    // esconde lista e mostra detalhes
    document.querySelector('main').classList.add('hidden');
    detailPage.classList.remove('hidden');
    detailNameEl.textContent = goal.name;

    // buscar contribuições
    const contribSnap = await goalsRef()
        .doc(goal.id)
        .collection('contributions')
        .orderBy('date', 'asc')
        .get();
    const contribs = contribSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Calcular o total já pago
    let totalPaidSoFar = contribs.reduce((sum, c) => sum + c.value, 0);

    // Atualizar o currentAmount da meta no Firestore, se houver diferença
    if (goal.currentAmount !== totalPaidSoFar) {
        await goalsRef().doc(goal.id).update({ currentAmount: totalPaidSoFar });
        goal.currentAmount = totalPaidSoFar; // Atualiza o objeto local
    }

    // Calcular valores para o mini dashboard
    const remainingToPay = Math.max(0, goal.amount - totalPaidSoFar);
    let situationText = '';
    let situationColorClass = 'text-zinc-50'; // Cor padrão

    if (totalPaidSoFar >= goal.amount) {
        const extraAmount = totalPaidSoFar - goal.amount;
        situationText = `Meta Atingida! (+R$ ${extraAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
        situationColorClass = 'text-green-500';
    } else {
        situationText = `Faltam R$ ${remainingToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        situationColorClass = 'text-red-500';
    }

    // --- CÁLCULO DE MESES E DIAS FALTANTES ---
    let monthsLeftCount = 0;
    let daysLeftCount = 0;
    const todayForCalc = new Date();
    todayForCalc.setHours(0,0,0,0); // Zera hora para calculo de dias exatos
    const deadlineDate = new Date(goal.deadline);
    deadlineDate.setHours(23,59,59,999); // Final do dia da deadline

    if (remainingToPay > 0 && deadlineDate > todayForCalc) {
        // Calcular diferença em meses
        let startMonth = todayForCalc.getMonth();
        let startYear = todayForCalc.getFullYear();
        let endMonth = deadlineDate.getMonth();
        let endYear = deadlineDate.getFullYear();

        monthsLeftCount = (endYear - startYear) * 12 + (endMonth - startMonth);
        if (todayForCalc.getDate() > deadlineDate.getDate()) {
            monthsLeftCount--; // Se o dia atual for maior que o dia da deadline, o mês atual não conta como cheio
        }
        monthsLeftCount = Math.max(0, monthsLeftCount); // Garante que não seja negativo

        // Calcular diferença em dias
        daysLeftCount = Math.ceil((deadlineDate - todayForCalc) / (1000 * 60 * 60 * 24));
        daysLeftCount = Math.max(0, daysLeftCount); // Garante que não seja negativo
    } else if (remainingToPay > 0 && deadlineDate <= todayForCalc) {
        // Se a meta não foi paga e a deadline já passou
        monthsLeftCount = 0;
        daysLeftCount = 0;
        situationText = `<span class="text-red-500">Meta Expirada!</span>`;
        if (miniSituationEl) miniSituationEl.innerHTML = situationText; // Atualiza aqui também
    }
    // --- FIM CÁLCULO DE MESES E DIAS FALTANTES ---


    // Atualizar mini dashboard
    if (miniGoalTotalEl) miniGoalTotalEl.textContent = `R$ ${goal.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (miniCurrentPaidEl) miniCurrentPaidEl.textContent = `R$ ${totalPaidSoFar.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (miniSituationEl) miniSituationEl.innerHTML = `<span class="${situationColorClass}">${situationText}</span>`;
    
    // Atualiza os novos campos
    if (miniMonthsLeftEl) miniMonthsLeftEl.textContent = `${monthsLeftCount} meses`;

    // Montar meses para o plano
    const startDate = goal.createdAt.toDate();
    let endDate = new Date(goal.deadline); // Usamos a data limite atual da meta

    // Normaliza datas para o início/fim do mês para cálculos consistentes
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate()); // último dia do mês
    endDate.setHours(23, 59, 59, 999);

    const months = [];
    let currentMonthIter = new Date(startDate);
    
    // Popula o array de meses com estrutura básica até a data limite atual da meta
    while (currentMonthIter <= endDate) {
        months.push({
            label: currentMonthIter.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }),
            monthStart: new Date(currentMonthIter),
            monthEnd: new Date(currentMonthIter.getFullYear(), currentMonthIter.getMonth() + 1, 0, 23, 59, 59, 999),
            planned: 0, // Será calculado dinamicamente
            paid: 0, // Acumulado das contribuições para o mês
            contributions: [], // Contribuições individuais para o mês
        });
        currentMonthIter.setMonth(currentMonthIter.getMonth() + 1);
    }

    // Distribuir as contribuições reais nos meses e acumular o `paid`
    contribs.forEach(c => {
        const contributionDate = c.date.toDate();
        for (const month of months) {
            // Verifica se a contribuição está dentro do intervalo do mês
            if (contributionDate >= month.monthStart && contributionDate <= month.monthEnd) {
                month.paid += c.value;
                month.contributions.push(c);
                break;
            }
        }
    });

    // === Lógica para recalcular o planejado futuro ===
    let currentAccumulatedPaidForPlanning = 0; // Usado para rastrear o saldo ao longo do tempo para o planejamento

    for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const isPastMonth = month.monthEnd < new Date(); // Mês que já acabou
        
        currentAccumulatedPaidForPlanning += month.paid; // Acumula o que foi pago até este mês

        // Calcula o valor restante da meta que *ainda precisa ser coberto*
        const remainingGoalAmountAfterAccumulatedPaid = Math.max(0, goal.amount - currentAccumulatedPaidForPlanning);

        // Contagem de meses *futuros* (incluindo o mês atual, se ele ainda não acabou)
        // Isso é crucial para dividir o restante apenas pelos meses que ainda faltam
        const futureMonthsCountIncludingCurrent = months.length - i; 

        if (remainingGoalAmountAfterAccumulatedPaid <= 0) {
            // Se a meta já foi atingida/superada, não há mais planejado para este mês ou futuros
            month.planned = 0;
        } else if (isPastMonth) {
            // Se o mês já passou, o planejado para ele é 0 (o foco é no futuro)
            month.planned = 0;
        } else {
            // Este é um mês futuro ou o mês atual que ainda precisa ser planejado
            if (futureMonthsCountIncludingCurrent > 0) {
                let calculatedPlanned = remainingGoalAmountAfterAccumulatedPaid / futureMonthsCountIncludingCurrent;
                
                // No último mês, ajusta o valor para compensar arredondamentos
                if (i === months.length - 1) {
                    month.planned = remainingGoalAmountAfterAccumulatedPaid; // O último mês pega o valor exato
                } else {
                    month.planned = parseFloat(calculatedPlanned.toFixed(2));
                }
            } else {
                // Caso não haja mais meses futuros na deadline mas ainda falte valor
                month.planned = remainingGoalAmountAfterAccumulatedPaid; 
            }
        }
    }


    // Alertas de Conclusão/Expiração (garante que sejam mostrados apenas uma vez)
    if (totalPaidSoFar >= goal.amount && goal.amount > 0 && !alertShownForCompletion) {
        showAlert('Parabéns! Sua meta foi atingida ou superada!', 'success');
        alertShownForCompletion = true;
        alertShownForExpiration = false; // Reset para o caso de ter expirado antes
    } else if (totalPaidSoFar < goal.amount && new Date(goal.deadline) < new Date() && !alertShownForExpiration) {
        showAlert('Sua meta expirou e ainda não foi totalmente paga. Considere estender o prazo ou fazer mais contribuições.', 'warning');
        alertShownForExpiration = true;
        alertShownForCompletion = false; // Reset para o caso de ter sido concluído antes
    } else if (totalPaidSoFar < goal.amount && new Date(goal.deadline) >= new Date()) {
        // Se a meta ainda está ativa e não concluída/expirada, resetar os flags
        alertShownForCompletion = false;
        alertShownForExpiration = false;
    }


    // montar tabela
    let html = `
<div class="overflow-x-auto">
  <table class="w-full min-w-[600px] text-sm table-auto border-collapse">
    <thead class="bg-zinc-800 text-zinc-50 sticky top-0 z-10">
      <tr>
        <th class="px-4 py-3 text-left w-1/5">Item</th>
        `;
    months.forEach(m => html += `<th class="px-4 py-3 text-center">${m.label}</th>`);
    html += `
      </tr>
    </thead>
    <tbody class="bg-zinc-900 text-zinc-50">
      <tr>
        <td class="px-4 py-3 font-semibold border-t border-zinc-700">Planejado</td>`;
    months.forEach(m => html += `<td class="px-4 py-3 text-center border-t border-zinc-700">R$ ${m.planned.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>`);
    html += `
      </tr>
      <tr>
        <td class="px-4 py-3 font-semibold border-t border-zinc-700">Pago</td>`;
    months.forEach((m, idx) => {
        html += `
        <td class="px-4 py-3 group relative text-center border-t border-zinc-700" data-month-idx="${idx}">
          <span class="month-value">R$ ${m.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <button
            data-month-idx="${idx}"
            class="py-4 backdrop-blur-sm rounded-lg border border-zinc-700 edit-plan-btn absolute inset-0
                   flex items-center justify-center bg-zinc-900/80 text-sm font-bold text-green-400
                   opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >Editar</button>
        </td>`;
    });
    html += `
      </tr>
    </tbody>
  </table>
</div>`;
    tableWrapper.innerHTML = html;

    // handlers editar
    tableWrapper.querySelectorAll('.edit-plan-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (tableWrapper.querySelector('.edit-input')) return; // Evita múltiplas edições
            const cell = btn.closest('td');
            const monthIdx = +btn.dataset.monthIdx;
            const monthData = months[monthIdx];
            const currentPaid = monthData.paid;

            const editContainer = document.createElement('div');
            editContainer.className = 'flex items-center space-x-2 justify-center';
            const input = document.createElement('input');
            input.type = 'number';
            input.value = currentPaid.toFixed(2);
            input.className = 'edit-input bg-zinc-800 p-1 rounded w-24 text-zinc-50 text-center';
            input.step = "0.01";

            const saveBtn = document.createElement('button');
            saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                             viewBox="0 0 24 24" stroke="currentColor">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                   d="M5 13l4 4L19 7" /></svg>`;
            saveBtn.className = 'p-1 rounded bg-green-600 text-white';

            const cancelBtn = document.createElement('button');
            cancelBtn.innerHTML = `<i class="fas fa-times h-5 w-5"></i>`;
            cancelBtn.className = 'p-1 rounded bg-red-600 text-white ml-1';


            cell.innerHTML = '';
            editContainer.append(input, saveBtn, cancelBtn);
            cell.append(editContainer);
            input.focus();

            cancelBtn.addEventListener('click', () => {
                showGoalDetail(goal); // Reverte e atualiza
            });

            saveBtn.addEventListener('click', async () => {
                const newValue = parseFloat(input.value) || 0;
                
                showLoading();

                // Excluir contribuições existentes para este mês
                const batch = db.batch();
                for (const contrib of monthData.contributions) {
                    batch.delete(goalsRef().doc(goal.id).collection('contributions').doc(contrib.id));
                }
                await batch.commit();

                // Adicionar uma nova contribuição para o novo valor total do mês, se positivo
                if (newValue > 0) {
                    await goalsRef().doc(goal.id).collection('contributions').add({
                        value: newValue,
                        date: monthData.monthStart, // Atribuir ao início do mês
                        type: 'monthly_edit'
                    });
                }
                
                // Recarregar os detalhes da meta para refletir as mudanças
                showGoalDetail(goal);
                hideLoading();
                showAlert('Valor do mês atualizado!', 'success');
            });
        });
    });
    hideLoading();
}

// === Funções para o modal de ajuste ===
async function showAdjustmentOptions(goal, addedAmount) {
    // Re-obtem o goal mais atualizado (com o currentAmount já recalculado)
    const updatedGoalSnap = await goalsRef().doc(goal.id).get();
    const updatedGoal = { id: updatedGoalSnap.id, ...updatedGoalSnap.data() };

    const totalPaidSoFar = updatedGoal.currentAmount;
    const remainingToPay = Math.max(0, updatedGoal.amount - totalPaidSoFar);

    const originalEndDate = new Date(updatedGoal.deadline);
    const today = new Date();
    today.setDate(1); // Considera o início do mês atual
    today.setHours(0,0,0,0);

    let currentMonthsRemaining = 0;
    let tempMonth = new Date(today);
    tempMonth.setDate(1); // Garante que a contagem comece do dia 1 do mês
    while (tempMonth <= originalEndDate) {
        currentMonthsRemaining++;
        tempMonth.setMonth(tempMonth.getMonth() + 1);
    }
    
    // CENÁRIO 1: Diminuir valor mensal (mantendo meses)
    // Calcula o novo valor mensal para os meses restantes
    const { amount: newMonthlyAmountIfSameMonths } = calculateMonthlyPlanned(updatedGoal, totalPaidSoFar, false);
    
    // CENÁRIO 2: Diminuir meses (mantendo valor mensal aproximado)
    // Para obter um targetMonthlyAmount razoável para a simulação:
    // Pega o planejado original ou um mínimo se a meta já está quase paga/expirada
    const originalStartDateForBaseline = updatedGoal.createdAt.toDate();
    originalStartDateForBaseline.setDate(1); originalStartDateForBaseline.setHours(0,0,0,0);
    let originalTotalMonthsDuration = 0;
    let tempOriginalMonthForBaseline = new Date(originalStartDateForBaseline);
    while (tempOriginalMonthForBaseline <= originalEndDate) {
        originalTotalMonthsDuration++;
        tempOriginalMonthForBaseline.setMonth(tempOriginalMonthForBaseline.getMonth() + 1);
    }
    const originalMonthlyPlannedBaseline = originalTotalMonthsDuration > 0 ? updatedGoal.amount / originalTotalMonthsDuration : 0;
    const targetMonthlyAmount = Math.max(originalMonthlyPlannedBaseline, 50); // Mínimo de R$ 50 para cálculo de meses para simulação

    const { amount: monthlyAmountIfReducingMonths, months: newMonthsCount, deadline: newProjectedEndDate } = calculateMonthlyPlanned(updatedGoal, totalPaidSoFar, true, targetMonthlyAmount);


    const message = `Você adicionou R$ ${addedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
    Agora faltam R$ ${remainingToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para sua meta.<br><br>
    Você pode: <br>
    - **Diminuir o valor mensal:** As parcelas futuras seriam de <span class="font-semibold text-green-400">R$ ${newMonthlyAmountIfSameMonths.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> (mantendo ${currentMonthsRemaining} meses).<br>
    - **Diminuir os meses:** Sua meta poderia ser concluída em <span class="font-semibold text-green-400">${newMonthsCount} meses</span>, até <span class="font-semibold text-green-400">${formatDate(newProjectedEndDate)}</span>, com parcelas de R$ <span class="font-semibold text-green-400">${monthlyAmountIfReducingMonths.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>.`;

    // Preenche o conteúdo do modal de ajuste
    adjustmentModal.innerHTML = `
        <div class="bg-zinc-900 rounded-xl shadow-lg w-full max-w-md mx-4 border border-zinc-700 p-6">
            <h3 class="text-xl font-bold text-zinc-50 mb-4">Como deseja ajustar sua meta?</h3>
            <p class="text-zinc-300 mb-4" id="adjustmentMessage">${message}</p>
            <div class="flex justify-around space-x-4">
                <button id="adjustAmountBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex-1">
                    Diminuir valor mensal
                </button>
                <button id="adjustMonthsBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex-1">
                    Diminuir meses
                </button>
            </div>
            <button id="closeAdjustmentModalBtn" class="mt-4 w-full bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg transition-colors">
                Manter como está
            </button>
        </div>
    `;

    // Agora que o innerHTML foi definido, os botões existem e podemos adicionar os listeners
    const closeAdjustmentModalBtn = adjustmentModal.querySelector('#closeAdjustmentModalBtn');
    const adjustAmountBtn = adjustmentModal.querySelector('#adjustAmountBtn');
    const adjustMonthsBtn = adjustmentModal.querySelector('#adjustMonthsBtn');

    if (closeAdjustmentModalBtn) {
        closeAdjustmentModalBtn.addEventListener('click', () => adjustmentModal.classList.add('hidden'));
    }
    
    if (adjustAmountBtn) {
        adjustAmountBtn.addEventListener('click', async () => {
            adjustmentModal.classList.add('hidden');
            showGoalDetail(updatedGoal); // Recarrega a visualização detalhada com o novo planejado
            showAlert('Valor mensal futuro ajustado automaticamente.', 'info');
        });
    }

    if (adjustMonthsBtn) {
        adjustMonthsBtn.addEventListener('click', async () => {
            // Atualiza a deadline da meta no Firestore
            await goalsRef().doc(updatedGoal.id).update({ deadline: newProjectedEndDate.toISOString().split('T')[0] });
            updatedGoal.deadline = newProjectedEndDate.toISOString().split('T')[0]; // Atualiza o objeto local
            adjustmentModal.classList.add('hidden');
            showGoalDetail(updatedGoal); // Recarrega a visualização detalhada com a nova deadline
            showAlert('Prazo da meta ajustado com sucesso!', 'info');
        });
    }

    adjustmentModal.classList.remove('hidden'); // Mostra o modal
}


// Abre modal de edição (reusa o mesmo form de inclusão)
function editGoal(goal) {
    goalForm.goalName.value = goal.name;
    goalForm.goalAmount.value = goal.amount;
    goalForm.goalCurrentAmount.value = goal.currentAmount;
    goalForm.goalDeadline.value = goal.deadline;
    goalForm.goalPriority.value = goal.priority;

    const originalHandler = goalForm.onsubmit;
    goalForm.onsubmit = async e => {
        e.preventDefault();
        const oldAmount = goal.amount;
        const oldCurrentAmount = goal.currentAmount;

        goal.name = goalForm.goalName.value.trim();
        goal.amount = parseFloat(goalForm.goalAmount.value);
        goal.currentAmount = parseFloat(goalForm.goalCurrentAmount.value) || 0;
        goal.deadline = goal.goalDeadline.value;
        goal.priority = goal.goalPriority.value;

        if (goal.currentAmount > goal.amount) {
            showAlert('Valor atual não pode ser maior que o valor da meta.', 'error');
            return;
        }

        showLoading();
        // Não atualizamos o currentAmount diretamente aqui no `updateGoalData`
        // Ele será recalculado pela soma das contribuições ao recarregar
        const dataToUpdate = {
            name: goal.name,
            amount: goal.amount,
            deadline: goal.deadline,
            priority: goal.priority
        };
        await goalsRef().doc(goal.id).update(dataToUpdate);


        // Se o valor atual inicial for alterado manualmente no formulário de edição,
        // geramos uma contribuição para refletir essa mudança.
        // É importante que essa diferença seja tratada como uma nova contribuição
        // para manter a consistência com a soma das contribuições.
        if (oldCurrentAmount !== goal.currentAmount) {
            const difference = goal.currentAmount - oldCurrentAmount;
            if (difference !== 0) {
                await goalsRef().doc(goal.id).collection('contributions').add({
                    value: difference,
                    date: firebase.firestore.Timestamp.now(),
                    type: 'manual_current_edit'
                });
            }
        }
        
        goalForm.reset();
        goalForm.onsubmit = originalHandler;
        addGoalModal.classList.add('hidden');
        hideLoading();
        showAlert('Meta atualizada com sucesso!', 'success');
        // Se a edição foi do modal de detalhes, atualiza aquela view
        if (detailPage.classList.contains('hidden') === false && currentSelectedGoal && currentSelectedGoal.id === goal.id) {
            showGoalDetail(goal);
        } else {
             await loadGoals(); // Recarrega para atualizar os cards
        }
    };
    addGoalModal.classList.remove('hidden');
}

// Atualiza indicadores de resumo
function updateSummary() {
    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => g.currentAmount >= g.amount).length;
    const totalAmount = goals.reduce((acc, g) => acc + g.amount, 0);

    animateCount(totalGoalsElement, totalGoals);
    animateCount(completedGoalsElement, completedGoals);
    animateCount(totalAmountElement, totalAmount, 'R$ ', true);
}


// Formata data em PT-BR
function formatDate(d) {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function animateCount(element, endValue, prefix = '', isCurrency = false, duration = 500) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = start + (endValue - start) * progress;

        if (isCurrency) {
            element.textContent = prefix + current.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        } else {
            element.textContent = prefix + Math.floor(current);
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// Variáveis para controlar o estado dos alertas para não repetir
let alertShownForCompletion = false;
let alertShownForExpiration = false;