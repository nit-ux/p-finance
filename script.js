const balance = document.getElementById('balance');
const totalIncome = document.getElementById('total-income');
const totalExpense = document.getElementById('total-expense');
const list = document.getElementById('transaction-list');
const form = document.getElementById('transaction-form');
const description = document.getElementById('description');
const amount = document.getElementById('amount');
const type = document.getElementById('type');

// Dummy transactions for initialization
const dummyTransactions = [
    { id: 1, description: 'Salary', amount: 5000, type: 'income' },
    { id: 2, description: 'Rent', amount: 1000, type: 'expense' },
    { id: 3, description: 'Groceries', amount: 300, type: 'expense' }
];

let transactions = dummyTransactions;

// Add transaction to DOM list
function addTransactionDOM(transaction) {
    const item = document.createElement('li');
    item.classList.add(transaction.type);

    item.innerHTML = `
        ${transaction.description} <span>${transaction.type === 'income' ? '+' : '-'}${Math.abs(transaction.amount)}</span>
        <button class="delete-btn" onclick="removeTransaction(${transaction.id})">x</button>
    `;

    list.appendChild(item);
}

// Update the balance, income, and expense
function updateValues() {
    const amounts = transactions.map(transaction => transaction.amount);

    const income = amounts
        .filter(item => item > 0)
        .reduce((acc, item) => (acc += item), 0)
        .toFixed(2);

    const expense = (
        amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0) * -1
    ).toFixed(2);

    const total = (income - expense).toFixed(2);

    totalIncome.innerText = `$${income}`;
    totalExpense.innerText = `$${expense}`;
    balance.innerText = `$${total}`;
}

// Remove transaction by ID
function removeTransaction(id) {
    transactions = transactions.filter(transaction => transaction.id !== id);
    init();
}

// Add new transaction
function addTransaction(e) {
    e.preventDefault();

    if (description.value.trim() === '' || amount.value.trim() === '') {
        alert('Please add a description and amount');
    } else {
        const transaction = {
            id: generateID(),
            description: description.value,
            amount: type.value === 'income' ? +amount.value : -amount.value,
            type: type.value
        };

        transactions.push(transaction);

        addTransactionDOM(transaction);
        updateValues();

        description.value = '';
        amount.value = '';
    }
}

// Generate random ID
function generateID() {
    return Math.floor(Math.random() * 100000000);
}

// Init app
function init() {
    list.innerHTML = '';
    transactions.forEach(addTransactionDOM);
    updateValues();
}

init();

form.addEventListener('submit', addTransaction);
