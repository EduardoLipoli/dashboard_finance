// retirement.js

// Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Variáveis de estado globais
let retirementChart = null;
let currentPlan = null;
let originalChartData = null;
let isSavingsLocked = true;
let isInvestmentLocked = true;

// Funções de utilidade
function formatCurrency(value) {
    const numberValue = Number(value) || 0;
    return numberValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function showAlert(message, type = "success") {
    const alertContainer = document.getElementById("alert-container");
    if (!alertContainer) return;
    
    const alert = document.createElement("div");
    alert.className = `fade-in mb-3 px-4 py-3 rounded-lg shadow-lg flex items-center justify-between ${type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-green-500'} text-white`;
    
    alert.innerHTML = `
        <div class="flex items-center">
            <span class="font-medium">${message}</span>
        </div>
        <button class="ml-4 text-lg font-bold focus:outline-none">&times;</button>
    `;
    
    alert.querySelector("button").addEventListener("click", () => {
        alert.remove();
    });
    
    setTimeout(() => {
        if (alert.parentNode) alert.remove();
    }, 5000);
    
    alertContainer.appendChild(alert);
}

// Elementos do DOM
const retirementForm = document.getElementById('retirement-form');
const totalNeededEl = document.getElementById('total-needed');
const monthlyInvestmentEl = document.getElementById('monthly-investment');
const progressEl = document.getElementById('progress');
const progressText = document.getElementById('progress-text');
const progressRing = document.getElementById('progress-ring');
const planDetailsEl = document.getElementById('plan-details');
const retirementChartCtx = document.getElementById('retirement-chart').getContext('2d');

// Elementos do formulário e de simulação
const currentSavingsInput = document.getElementById('current-savings');
const unlockSavingsBtn = document.getElementById('unlock-savings-btn');
const monthlyInvestmentSlider = document.getElementById('monthly-investment-input');
const monthlyInvestmentDisplay = document.getElementById('monthly-investment-display');
const unlockInvestmentBtn = document.getElementById('unlock-investment-btn');
const recalculateBtn = document.getElementById('recalculate-btn');
const refreshDataBtn = document.getElementById('refresh-data-btn');

// Funções de autenticação
function logout() {
    auth.signOut().then(() => {
        window.location.href = "/index.html";
    }).catch((error) => {
        console.error("Erro ao deslogar:", error);
        showAlert("Erro ao deslogar: " + error.message, "error");
    });
}

// --- Funções de Busca de Dados Reais ---

/**
 * Busca o valor total do portfólio salvo pela página de Investimentos.
 */
async function getRealPortfolioValue() {
    const user = auth.currentUser;
    if (!user) return 0;
    try {
        const doc = await db.collection('users').doc(user.uid)
                            .collection('portfolioSummary').doc('summary').get();
        if (doc.exists) {
            return doc.data().totalPortfolioValue || 0;
        }
        console.warn("Nenhum sumário de portfólio encontrado. Cadastre investimentos.");
        return 0; // Nenhum sumário salvo ainda
    } catch (error) {
        console.error('Erro ao buscar valor real do portfólio:', error);
        showAlert("Erro ao buscar patrimônio. Verifique a pág. de Investimentos.", "error");
        return 0;
    }
}

/**
 * Busca o total de receitas MENSAIS FIXAS.
 */
async function getTotalMonthlyIncome() {
    const user = auth.currentUser;
    if (!user) return 0;
    try {
        const snapshot = await db.collection('users').doc(user.uid).collection('transactions')
            .where('type', '==', 'Ganho')
            .where('isFixed', '==', true) // A consulta está correta...
            .get();
            
        if (snapshot.empty) return 0;
        
        // [INÍCIO DA CORREÇÃO]
        // ...o problema é a lógica da soma.
        let monthlyIncome = 0;
        const seenBaseIds = new Set(); // Armazena os IDs base que já somamos

        snapshot.docs.forEach(doc => {
            const transaction = doc.data();
            const baseId = doc.id.split('-')[0]; // Pega o ID antes do '-'

            // Se ainda não somamos este grupo de transação, some-o
            if (!seenBaseIds.has(baseId)) {
                monthlyIncome += transaction.amount || 0;
                seenBaseIds.add(baseId); // Marca como somado
            }
            // Se o ID base já foi visto, ignora (é uma réplica)
        });
        return monthlyIncome;
        // [FIM DA CORREÇÃO]

    } catch (error) {
        console.error('Erro ao calcular renda mensal:', error);
        return 0;
    }
}
/**
 * Busca o total de despesas MENSAIS FIXAS.
 */
async function getTotalMonthlyExpenses() {
    const user = auth.currentUser;
    if (!user) return 0;
    try {
        const snapshot = await db.collection('users').doc(user.uid).collection('transactions')
            .where('type', '==', 'Gasto')
            .where('isFixed', '==', true) // A consulta está correta...
            .get();
            
        if (snapshot.empty) return 0;
        
        // [INÍCIO DA CORREÇÃO]
        // ...o problema é a lógica da soma.
        let monthlyExpense = 0;
        const seenBaseIds = new Set(); // Armazena os IDs base que já somamos

        snapshot.docs.forEach(doc => {
            const transaction = doc.data();
            const baseId = doc.id.split('-')[0]; // Pega o ID antes do '-'

            // Se ainda não somamos este grupo de transação, some-o
            if (!seenBaseIds.has(baseId)) {
                monthlyExpense += transaction.amount || 0;
                seenBaseIds.add(baseId); // Marca como somado
            }
            // Se o ID base já foi visto, ignora (é uma réplica)
        });
        return monthlyExpense;
        // [FIM DA CORREÇÃO]

    } catch (error) {
        console.error('Erro ao calcular despesa mensal:', error);
        return 0;
    }
}

/**
 * Busca o valor mensal necessário para atingir as metas.
 */
async function getMonthlyGoalContributions() {
    const user = auth.currentUser;
    if (!user) return 0;
    try {
        const snapshot = await db.collection('users').doc(user.uid).collection('goals').get();
        if (snapshot.empty) return 0;
        
        let totalMonthlyContribution = 0;
        const today = new Date();
        
        snapshot.docs.forEach(doc => {
            const goal = doc.data();
            if (goal.deadline) {
                const parts = goal.deadline.split('-'); // Formato YYYY-MM-DD
                const deadline = new Date(parts[0], parts[1] - 1, parts[2]);

                if (deadline > today) {
                    const remainingAmount = (goal.amount || 0) - (goal.currentAmount || 0);
                    if (remainingAmount <= 0) return; 

                    const monthsLeft = (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth());
                    
                    if (monthsLeft > 0) {
                        totalMonthlyContribution += remainingAmount / monthsLeft;
                    }
                }
            }
        });
        return totalMonthlyContribution;
    } catch (error) {
        console.error('Erro ao calcular contribuição para metas:', error);
        return 0;
    }
}

/**
 * Busca as metas para plotar como "saques" no gráfico.
 */
async function getGoalsForChart(currentAge) {
    const user = auth.currentUser;
    if (!user) return [];
    try {
        const snapshot = await db.collection('users').doc(user.uid).collection('goals').get();
        if (snapshot.empty) return [];
        
        const goals = [];
        const today = new Date();
        
        snapshot.docs.forEach(doc => {
            const goalData = doc.data();
            if (goalData.deadline) {
                const parts = goalData.deadline.split('-');
                const deadlineDate = new Date(parts[0], parts[1] - 1, parts[2]);

                if (deadlineDate >= today) {
                    const yearsFromNow = deadlineDate.getFullYear() - today.getFullYear();
                    const goalAmount = (goalData.amount || 0) - (goalData.currentAmount || 0);
                    
                    if (goalAmount > 0) { 
                        goals.push({
                            age: currentAge + yearsFromNow,
                            amount: goalAmount, 
                            name: goalData.name,
                        });
                    }
                }
            }
        });
        return goals;
    } catch (error) {
        console.error('Erro ao buscar metas para o gráfico:', error);
        return [];
    }
}

// --- Lógica de Cálculo do Plano ---

function calculateRetirementPlan(params, goals = []) {
    const { currentAge, retirementAge, monthlyIncome, currentSavings, annualReturn, inflation, monthlyInvestment } = params;
    
    const yearsToRetirement = retirementAge - currentAge;
    const postRetirementYears = 30; // Expectativa de vida pós-aposentadoria
    const postRetirementReturn = 0.04; // Rendimento conservador na aposentadoria
    
    if (yearsToRetirement <= 0) {
        showAlert("A idade de aposentadoria deve ser maior que a idade atual.", "error");
        return null;
    }
    
    const annualIncome = monthlyIncome * 12; // Renda anual *desejada* na aposentadoria
    const realReturn = (1 + annualReturn / 100) / (1 + inflation / 100) - 1;
    
    if (realReturn <= 0) {
         showAlert("O retorno anual deve ser maior que a inflação.", "error");
         return null;
    }
    
    // Valor total necessário no dia da aposentadoria
    const totalNeeded = annualIncome / realReturn;
    
    // Cálculo do aporte mensal *sugerido*
    const monthlyReturn = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
    const monthsToRetirement = yearsToRetirement * 12;
    const futureValueFactor = Math.pow(1 + monthlyReturn, monthsToRetirement);
    const currentSavingsFutureValue = currentSavings * futureValueFactor;
    const neededFromContributions = totalNeeded - currentSavingsFutureValue;

    let monthlyContributionSugg = 0;
    if (neededFromContributions > 0) {
        monthlyContributionSugg = neededFromContributions / ((futureValueFactor - 1) / monthlyReturn);
    }
    
    // --- Projeção para o Gráfico (baseada no aporte REAL/SIMULADO) ---
    const labels = [];
    const projectedPatrimony = [];
    const principalInvested = [];
    const goalEvents = [];
    
    let accumulatedValue = currentSavings;
    let principalAccumulated = currentSavings;
    
    // Fase de acumulação
    for (let i = 0; i <= yearsToRetirement; i++) {
        const age = currentAge + i;
        labels.push(age);
        
        if (i > 0) { 
            const annualContribution = monthlyInvestment * 12;
            principalAccumulated += annualContribution;
            accumulatedValue = (accumulatedValue + annualContribution) * (1 + annualReturn / 100);
        }

        const goalsThisYear = goals.filter(g => g.age === age);
        if (goalsThisYear.length > 0) {
            let totalGoalAmountThisYear = 0;
            goalsThisYear.forEach(goal => {
                totalGoalAmountThisYear += goal.amount;
                goalEvents.push({ x: age, y: accumulatedValue, name: goal.name, amount: goal.amount });
            });
            accumulatedValue -= totalGoalAmountThisYear; // Desconta a meta
        }
        
        projectedPatrimony.push(accumulatedValue);
        principalInvested.push(principalAccumulated);
    }
    
    // Fase de desacumulação (aposentadoria)
    for (let i = 1; i <= postRetirementYears; i++) {
        const age = retirementAge + i;
        labels.push(age);
        principalInvested.push(null); 
        
        accumulatedValue = (accumulatedValue - annualIncome) * (1 + postRetirementReturn);
        projectedPatrimony.push(Math.max(0, accumulatedValue));
    }
    
    return {
        ...params,
        totalNeeded,
        monthlyContribution: monthlyContributionSugg, // O valor *sugerido*
        progress: totalNeeded > 0 ? Math.min(100, (currentSavings / totalNeeded) * 100) : 0,
        projection: {
            labels,
            projectedPatrimony,
            principalInvested,
            goalEvents
        }
    };
}

// --- Funções de Atualização da UI ---

function updateProgressRing(progress) {
    const progressValue = Math.min(100, Math.max(0, progress));
    const circumference = 157; // 2 * π * r (r=25)
    const offset = circumference - (progressValue / 100) * circumference;
    
    if (progressRing) progressRing.style.strokeDashoffset = offset;
    if (progressText) progressText.textContent = `${Math.round(progressValue)}%`;
}

function updateChart(plan) {
    if (!plan || !plan.projection) return;
    
    const { labels, projectedPatrimony, principalInvested, goalEvents } = plan.projection;
    const retirementAge = plan.retirementAge;
    
    originalChartData = {
        labels: [...labels],
        datasets: [
            { data: [...projectedPatrimony] }, 
            { data: [...principalInvested] },
            { data: [...goalEvents] }
        ]
    };
    
    const datasets = [
        {
            label: 'Patrimônio Total',
            data: projectedPatrimony,
            type: 'line',
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            pointRadius: 0,
            fill: true,
            tension: 0.3
        },
        {
            label: 'Principal Investido',
            data: principalInvested,
            type: 'line',
            borderColor: '#3B82F6',
            borderWidth: 2,
            pointRadius: 0,
            borderDash: [5, 5],
            tension: 0.3
        },
        {
            label: 'Metas (Saídas)',
            data: goalEvents,
            type: 'scatter',
            backgroundColor: 'rgba(239, 68, 68, 0.8)', 
            pointStyle: 'triangle',
            pointRotation: 180,
            pointRadius: 8,
            pointHoverRadius: 10
        }
    ];
    
    const retirementIndex = labels.indexOf(retirementAge);
    
    const annotations = retirementIndex !== -1 ? {
        annotations: {
            retirementLine: {
                type: 'line',
                mode: 'vertical',
                scaleID: 'x',
                value: retirementAge,
                borderColor: 'rgba(239, 68, 68, 0.7)',
                borderWidth: 2,
                label: {
                    display: true,
                    content: 'Aposentadoria',
                    position: 'top',
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    font: { size: 12, weight: 'bold' }
                }
            }
        }
    } : {};
    
    if (retirementChart) {
        retirementChart.data.labels = labels;
        retirementChart.data.datasets = datasets;
        retirementChart.options.plugins.annotation = annotations;
        retirementChart.update();
    } else {
        retirementChart = new Chart(retirementChartCtx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: '#f4f4f5', font: { size: 12 } } },
                    tooltip: {
                        backgroundColor: 'rgba(39, 39, 42, 0.9)',
                        titleColor: '#f4f4f5',
                        bodyColor: '#f4f4f5',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (context.dataset.label === 'Metas (Saídas)') {
                                    const goal = context.raw;
                                    return `${goal.name}: - ${formatCurrency(goal.amount)}`;
                                }
                                return `${label}: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    },
                    annotation: annotations
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Idade', color: '#a1a1aa', font: { size: 13, weight: 'bold' } },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#d4d4d8' }
                    },
                    y: {
                        title: { display: true, text: 'Patrimônio (R$)', color: '#a1a1aa', font: { size: 13, weight: 'bold' } },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#d4d4d8', callback: value => formatCurrency(value) }
                    }
                }
            }
        });
    }
}

function updatePlanDetails(plan) {
    if (!plan || !plan.projection) {
        planDetailsEl.innerHTML = '<tr><td colspan="5" class="text-center py-4">Sem dados para exibir.</td></tr>';
        return;
    }
    
    const { labels, projectedPatrimony, principalInvested } = plan.projection;
    const retirementIndex = labels.indexOf(plan.retirementAge);
    const tableRows = [];
    
    for (let i = 1; i <= retirementIndex; i++) { 
        const age = labels[i];
        const value = projectedPatrimony[i];
        const principal = principalInvested[i];
        const lastValue = projectedPatrimony[i-1];
        const lastPrincipal = principalInvested[i-1];
        
        const contribution = principal - lastPrincipal;
        const interest = value - lastValue - contribution;
        
        tableRows.push(`
            <tr class="hover:bg-zinc-700/50">
                <td class="px-4 py-3">${i}</td>
                <td class="px-4 py-3">${age}</td>
                <td class="px-4 py-3 text-right font-medium">${formatCurrency(value)}</td>
                <td class="px-4 py-3 text-right text-green-400">${formatCurrency(contribution)}</td>
                <td class="px-4 py-3 text-right text-blue-400">${formatCurrency(interest)}</td>
            </tr>
        `);
    }
    
    planDetailsEl.innerHTML = tableRows.join('');
}

function displayRetirementPlan(plan) {
    if (!plan) return;
    
    totalNeededEl.textContent = formatCurrency(plan.totalNeeded);
    monthlyInvestmentEl.textContent = formatCurrency(plan.monthlyContribution);
    progressEl.textContent = `${Math.round(plan.progress)}%`;
    updateProgressRing(plan.progress);
    
    updateChart(plan);
    updatePlanDetails(plan);
    
    currentPlan = plan;
}

/**
 * Atualiza o card de Resumo Financeiro com dados reais.
 * Retorna o valor disponível para aposentadoria.
 */
async function refreshFinancialSummary() {
    try {
        const [monthlyIncome, monthlyExpenses, monthlyGoals] = await Promise.all([
            getTotalMonthlyIncome(),
            getTotalMonthlyExpenses(),
            getMonthlyGoalContributions()
        ]);
        
        const availableForRetirement = Math.max(0, monthlyIncome - monthlyExpenses - monthlyGoals);
        
        document.getElementById('monthly-income-summary').textContent = formatCurrency(monthlyIncome);
        document.getElementById('monthly-expenses-summary').textContent = `- ${formatCurrency(monthlyExpenses)}`;
        document.getElementById('monthly-goals-summary').textContent = `- ${formatCurrency(monthlyGoals)}`;
        document.getElementById('monthly-investment-value').textContent = formatCurrency(availableForRetirement);
        
        // Se o slider de investimento estiver travado, atualiza ele
        if (isInvestmentLocked) {
            monthlyInvestmentSlider.value = availableForRetirement.toFixed(0);
            if (availableForRetirement > monthlyInvestmentSlider.max) {
                monthlyInvestmentSlider.max = availableForRetirement.toFixed(0);
            }
            updateSliderLabels();
        }
        
        return availableForRetirement;
    } catch (error) {
        console.error("Erro ao atualizar resumo financeiro:", error);
        showAlert("Erro ao carregar dados financeiros", "error");
        return 0;
    }
}

/**
 * Atualiza o campo de Valor Acumulado com dados reais.
 * Retorna o valor acumulado.
 */
async function refreshCurrentSavings() {
    try {
        const savings = await getRealPortfolioValue();
        // Se o campo de patrimônio estiver travado, atualiza ele
        if (isSavingsLocked) {
            currentSavingsInput.value = savings.toFixed(2);
        }
        return savings;
    } catch (error) {
        console.error("Erro ao atualizar valor acumulado:", error);
        showAlert("Erro ao carregar valor dos investimentos", "error");
        return 0;
    }
}

/**
 * Pega todos os valores ATUAIS do formulário (reais ou simulados) e calcula o plano.
 */
async function recalculatePlan() {
    showLoading();
    try {
        const currentAge = parseInt(document.getElementById('current-age').value) || 30;
        const retirementAge = parseInt(document.getElementById('retirement-age').value) || 65;
        const monthlyIncome = parseFloat(document.getElementById('monthly-income').value) || 10000;
        const currentSavings = parseFloat(currentSavingsInput.value) || 0;
        const annualReturn = parseFloat(document.getElementById('annual-return').value) || 7;
        const inflation = parseFloat(document.getElementById('inflation').value) || 4;
        const monthlyInvestment = parseFloat(monthlyInvestmentSlider.value) || 0;
        
        const goals = await getGoalsForChart(currentAge);
        const planParams = {
            currentAge, retirementAge, monthlyIncome,
            currentSavings, annualReturn, inflation, monthlyInvestment
        };
        
        const newPlan = calculateRetirementPlan(planParams, goals);
        
        if (newPlan) {
            displayRetirementPlan(newPlan);
        }
    } catch (error) {
        console.error("Erro ao recalcular:", error);
        showAlert("Erro ao calcular plano.", "error");
    } finally {
        hideLoading();
    }
}

/**
 * Salva a simulação ATUAL (parâmetros do formulário) no Firestore.
 */
async function savePlan() {
    if (!currentPlan || !auth.currentUser) return;
    
    try {
        const planData = {
            currentAge: currentPlan.currentAge,
            retirementAge: currentPlan.retirementAge,
            monthlyIncome: currentPlan.monthlyIncome, // Renda desejada
            currentSavings: currentPlan.currentSavings, // Valor acumulado da simulação
            annualReturn: currentPlan.annualReturn,
            inflation: currentPlan.inflation,
            monthlyInvestment: currentPlan.monthlyInvestment, // Aporte da simulação
            lastUpdated: new Date()
        };
        
        await db.collection('users').doc(auth.currentUser.uid).collection('retirementPlans').doc('current').set(planData);
        showAlert("Plano de simulação salvo com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar plano:", error);
        showAlert("Erro ao salvar o plano: " + error.message, "error");
    }
}

/**
 * Filtra o gráfico para mostrar apenas um período de tempo.
 */
function filterChartByYears(years) {
    if (!retirementChart || !originalChartData) return;
    
    let labels, projectedData, principalData, goalData;

    if (years === 'max') {
        labels = [...originalChartData.labels];
        projectedData = [...originalChartData.datasets[0].data];
        principalData = [...originalChartData.datasets[1].data];
        goalData = [...originalChartData.datasets[2].data];
    } else {
        const numYears = parseInt(years);
        const endIndex = Math.min(numYears + 1, originalChartData.labels.length);
        
        labels = originalChartData.labels.slice(0, endIndex);
        projectedData = originalChartData.datasets[0].data.slice(0, endIndex);
        principalData = originalChartData.datasets[1].data.slice(0, endIndex);
        goalData = originalChartData.datasets[2].data.filter(
            point => point.x <= originalChartData.labels[endIndex - 1]
        );
    }

    retirementChart.data.labels = labels;
    retirementChart.data.datasets[0].data = projectedData;
    retirementChart.data.datasets[1].data = principalData;
    retirementChart.data.datasets[2].data = goalData;
    retirementChart.update();
}

/**
 * Atualiza os labels dos sliders (Idade, Renda, Aporte).
 */
function updateSliderLabels() {
    const retirementAgeSlider = document.getElementById('retirement-age');
    const retirementAgeValue = document.getElementById('retirement-age-value');
    const monthlyIncomeSlider = document.getElementById('monthly-income');
    const monthlyIncomeValue = document.getElementById('monthly-income-value');
    
    if (retirementAgeValue) retirementAgeValue.textContent = `${retirementAgeSlider.value} anos`;
    if (monthlyIncomeValue) monthlyIncomeValue.textContent = formatCurrency(monthlyIncomeSlider.value);
    if (monthlyInvestmentDisplay) monthlyInvestmentDisplay.textContent = formatCurrency(monthlyInvestmentSlider.value);
}

/**
 * Carrega os dados REAIS, preenche e trava os campos.
 */
async function loadRealDataAndLockFields() {
    // 1. Trava os campos
    isSavingsLocked = true;
    currentSavingsInput.disabled = true;
    unlockSavingsBtn.innerHTML = '<i class="fas fa-lock"></i>';
    unlockSavingsBtn.title = "Desbloquear para simular";
    
    isInvestmentLocked = true;
    monthlyInvestmentSlider.disabled = true;
    unlockInvestmentBtn.innerHTML = '<i class="fas fa-lock"></i>';
    unlockInvestmentBtn.title = "Desbloquear para simular";
    
    // 2. Busca os dados reais
    const [savings, availableForRetirement] = await Promise.all([
        refreshCurrentSavings(),      // Puxa o total de 'investimentos'
        refreshFinancialSummary()     // Puxa 'receitas', 'despesas' e 'metas'
    ]);
    
    // 3. Preenche os campos (as funções acima já fazem isso)
    // 4. Atualiza os labels
    updateSliderLabels();
}

// --- Inicialização da Página ---

async function initRetirementPage() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        showLoading();
        
        // 1. Carregar plano salvo (para preferências de simulação)
        let savedPlan = null;
        try {
            const doc = await db.collection('users').doc(user.uid).collection('retirementPlans').doc('current').get();
            savedPlan = doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Erro ao carregar plano:', error);
        }
        
        // 2. Preencher formulário com preferências salvas OU padrões
        document.getElementById('current-age').value = savedPlan?.currentAge || 30;
        document.getElementById('retirement-age').value = savedPlan?.retirementAge || 65;
        document.getElementById('monthly-income').value = savedPlan?.monthlyIncome || 10000;
        document.getElementById('annual-return').value = savedPlan?.annualReturn || 7;
        document.getElementById('inflation').value = savedPlan?.inflation || 4;
        
        // 3. Carregar dados REAIS e travar os campos
        await loadRealDataAndLockFields();
        
        // 4. Calcular o plano inicial com base nesses dados REAIS
        await recalculatePlan();
        
    } catch (error) {
        console.error("Erro ao inicializar a página:", error);
        showAlert("Erro ao carregar dados: " + error.message, "error");
    } finally {
        hideLoading();
    }
}

/**
 * Configura todos os event listeners da página.
 */
function setupPageEventListeners() {
    // Salvar Simulação
    retirementForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePlan();
    });
    
    // Calcular Simulação (usado para qualquer mudança nos sliders)
    recalculateBtn.addEventListener('click', recalculatePlan);
    
    // Botão Principal: Atualizar Dados Reais (Reseta para a realidade)
    refreshDataBtn.addEventListener('click', async () => {
        showLoading();
        await loadRealDataAndLockFields();
        await recalculatePlan();
        hideLoading();
        showAlert("Dados reais atualizados com sucesso!");
    });
    
    // Botão de Trava: Valor Acumulado
    unlockSavingsBtn.addEventListener('click', () => {
        isSavingsLocked = !isSavingsLocked;
        currentSavingsInput.disabled = isSavingsLocked;
        if (isSavingsLocked) {
            unlockSavingsBtn.innerHTML = '<i class="fas fa-lock"></i>';
            unlockSavingsBtn.title = "Desbloquear para simular";
            refreshCurrentSavings(); // Volta ao valor real
        } else {
            unlockSavingsBtn.innerHTML = '<i class="fas fa-lock-open"></i>';
            unlockSavingsBtn.title = "Bloquear e usar valor real";
            currentSavingsInput.focus();
        }
    });

    // Botão de Trava: Investimento Mensal
    unlockInvestmentBtn.addEventListener('click', () => {
        isInvestmentLocked = !isInvestmentLocked;
        monthlyInvestmentSlider.disabled = isInvestmentLocked;
        if (isInvestmentLocked) {
            unlockInvestmentBtn.innerHTML = '<i class="fas fa-lock"></i>';
            unlockInvestmentBtn.title = "Desbloquear para simular";
            refreshFinancialSummary(); // Volta ao valor real
        } else {
            unlockInvestmentBtn.innerHTML = '<i class="fas fa-lock-open"></i>';
            unlockInvestmentBtn.title = "Bloquear e usar valor real";
        }
    });
    
    // Filtros de tempo do gráfico
    document.querySelectorAll('.time-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.time-filter-btn').forEach(b => {
                b.classList.remove('bg-green-600', 'text-white');
                b.classList.add('bg-zinc-700', 'hover:bg-zinc-600');
            });
            btn.classList.add('bg-green-600', 'text-white');
            btn.classList.remove('bg-zinc-700', 'hover:bg-zinc-600');
            filterChartByYears(btn.dataset.years);
        });
    });
    
    // --- Sliders e Inputs que recalculam o plano ---
    
    const autoRecalculateInputs = [
        'current-age', 'retirement-age', 'monthly-income', 
        'current-savings', 'annual-return', 'inflation', 'monthly-investment-input'
    ];
    
    autoRecalculateInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // 'change' é acionado quando solta o mouse (slider) ou sai do campo (input)
            el.addEventListener('change', recalculatePlan);
        }
    });

    // Sliders que atualizam seus labels em tempo real
    const sliderInputs = ['retirement-age', 'monthly-income', 'monthly-investment-input'];
    sliderInputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('input', updateSliderLabels);
        }
    });

    // Lógica do dropdown do usuário (já inclusa no user-profile.js)
}

// --- Ponto de Entrada ---

document.addEventListener('DOMContentLoaded', setupPageEventListeners);

auth.onAuthStateChanged(user => {
    if (user) {
        // user-profile.js cuida de preencher o nome/foto
        loadUserName(user); // Função do user-profile.js
        initRetirementPage(); // Inicia a lógica desta página
    } else {
        window.location.href = "/index.html";
    }
});