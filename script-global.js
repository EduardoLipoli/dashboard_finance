const addBtn = document.getElementById("addBtn");
const formSidebar = document.getElementById("formSidebar");
const backdrop = document.getElementById("backdrop");
const body = document.body;

// Abrir formulário para adicionar uma nova transação
document.getElementById("addBtn").addEventListener("click", () => {
  currentEditIndex = null;
  form.reset();
  toggleInstallmentsInput();
  openFormSidebar();
});

// Abrir formulário
function openFormSidebar() {
  const formSidebar = document.getElementById("formSidebar");
  const overlay = document.getElementById("overlay");

  formSidebar.style.width = "400px";
  formSidebar.style.visibility = "visible";
  overlay.classList.remove("hidden");
}

// Fechar formulário
function closeFormSidebar() {
  const formSidebar = document.getElementById("formSidebar");
  const overlay = document.getElementById("overlay");

  formSidebar.style.width = "0px";
  formSidebar.style.visibility = "hidden";
  overlay.classList.add("hidden");
}

// Evento para fechar ao clicar fora
document.body.addEventListener("click", (e) => {
  const formSidebar = document.getElementById("formSidebar");
  const overlay = document.getElementById("overlay");
  const addBtn = document.getElementById("addBtn");

  if (
    !formSidebar.contains(e.target) &&
    !overlay.contains(e.target) &&
    e.target !== addBtn &&
    formSidebar.style.visibility === "visible"
  ) {
    closeFormSidebar();
  }
});

// Prevenir propagação de cliques dentro do formulário e overlay
document.getElementById("formSidebar").addEventListener("click", (e) => {
  e.stopPropagation();
});

document.getElementById("overlay").addEventListener("click", (e) => {
  closeFormSidebar();
  e.stopPropagation();
});


