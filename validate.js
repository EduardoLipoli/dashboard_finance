function onChangeDate() {
  const date = myForm.date().value;
  myForm.dateRequiredError().style.display = !date ? "block" : "none";

  toggleSaveButtonDisable();
}

function onChangeName() {
  const name = myForm.name().value;
  myForm.nameRequiredError().style.display = !name ? "block" : "none";

  toggleSaveButtonDisable();
}

function onChangeAmount() {
  const amount = myForm.amount().value;
  myForm.amountRequiredError().style.display = !amount ? "block" : "none";

  myForm.amountLessOrEqualToZeroError().style.display =
    amount <= 0 ? "block" : "none";

  toggleSaveButtonDisable();
}

function toggleSaveButtonDisable() {
  myForm.saveButton().disabled = !isFormValid();
}

function isFormValid() {
  const date = myForm.date().value;
  if (!date) {
    return false;
  }

  const amount = myForm.amount().value;
  if (!amount || amount <= 0) {
    return false;
  }

  const name = myForm.name().value;
  if (!name) {
    return false;
  }

  return true;
}

const myForm = {
  date: () => document.getElementById("dueDate"),
  dateRequiredError: () => document.getElementById("date-required-error"),
  name: () => document.getElementById("name"),
  nameRequiredError: () => document.getElementById("name-required-error"),
  amount: () => document.getElementById("amount"),
  amountRequiredError: () => document.getElementById("amount-required-error"),
  amountLessOrEqualToZeroError: () => document.getElementById("amount-less-or-equal-to-zero-error"),
  saveButton: () => document.getElementById("save-button"),
  type: () => document.getElementById("type"),
  category: () => document.getElementById("category"),
  fixed: () => document.getElementById("fixed"),
  installments: () => document.getElementById("installments"),
  datepay: () => document.getElementById("datepay"),
  essentialNot: () => document.getElementById("essentialNot"),
  essentialYes: () => document.getElementById("essentialYes"),
};
