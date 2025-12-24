const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs').promises;
const axios = require('axios');

// Load from environment variables or use defaults
const CONFIG = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || 'Add your token here',
    API_URL: process.env.API_URL || 'https://stapedial-stubbily-jedidiah.ngrok-free.dev',
    API_KEY: process.env.API_KEY || 'Add your token here',
    SERVICER_NAME: 'valentino_foundation'
};

const USER_MAP_FILE = 'discord_users.json';
const ENTITY_PERMS_FILE = 'entities_permissions.json';

// Currency cache
let currencyCache = {};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages
    ]
});

// ==================== FILE OPERATIONS ====================

async function loadUserMap() {
    try {
        return JSON.parse(await fs.readFile(USER_MAP_FILE, 'utf8'));
    } catch {
        return {};
    }
}

async function saveUserMap(data) {
    await fs.writeFile(USER_MAP_FILE, JSON.stringify(data, null, 2));
}

async function loadEntityPerms() {
    try {
        return JSON.parse(await fs.readFile(ENTITY_PERMS_FILE, 'utf8'));
    } catch {
        return {};
    }
}

// ==================== CURRENCY FORMATTING ====================

async function fetchCurrencies() {
    try {
        const response = await axios.get(`${CONFIG.API_URL}/currencies`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        currencyCache = response.data;
        console.log('✅ Currency cache updated:', Object.keys(currencyCache).length, 'currencies');
    } catch (error) {
        console.error('❌ Failed to fetch currencies:', error.message);
    }
}

function formatCurrency(amount, currencyCode) {
    const currency = currencyCache[currencyCode];
    if (!currency) return `${amount.toFixed(2)} ${currencyCode}`;
    
    const useSubunits = amount < 1.0 && currency.subunit && currency.subunit_ratio;
    
    if (useSubunits) {
        const subunitAmount = Math.round(amount * currency.subunit_ratio);
        const symbol = currency.symbol || currencyCode;
        return currency.symbol_placement === 'before' 
            ? `${symbol}${subunitAmount} ${currency.subunit}`
            : `${subunitAmount} ${currency.subunit} ${symbol}`;
    }
    
    const formatted = amount.toFixed(2);
    const symbol = currency.symbol || currencyCode;
    
    return currency.symbol_placement === 'before'
        ? `${symbol}${formatted}`
        : `${formatted} ${symbol}`;
}

function getCurrencyName(currencyCode) {
    const currency = currencyCache[currencyCode];
    return currency?.full_name || currencyCode;
}

// ==================== API CALLS ====================

async function apiCall(endpoint, method = 'GET', data = null) {
    const config = {
        method,
        url: `${CONFIG.API_URL}${endpoint}`,
        headers: {
            'api-key': CONFIG.API_KEY,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        }
    };
    if (data) config.data = data;

    const response = await axios(config);
    return response.data;
}

async function getUserData(username) {
    try {
        return await apiCall(`/user/${username}`);
    } catch (error) {
        return null;
    }
}

async function userHasEntityPerm(userId, entityName, permission) {
    const perms = await loadEntityPerms();
    
    for (const [key, entity] of Object.entries(perms)) {
        if (key.includes(entityName) || entity.entity_name === entityName) {
            const userPerm = entity.user_permissions[userId];
            if (userPerm && (userPerm.includes(permission) || userPerm.includes('admin'))) {
                return true;
            }
        }
    }
    return false;
}

// ==================== COMMAND REGISTRATION ====================

async function registerCommands() {
    const commands = [
        {
            name: 'balance',
            description: 'Check your balances',
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'history',
            description: 'View your transaction history',
            options: [
                { name: 'limit', description: 'Number of transactions (default 10)', type: 4, required: false }
            ],
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'hand',
            description: 'Hand physical cash to someone',
            options: [
                { name: 'to_user', description: 'Username', type: 3, required: true },
                { name: 'currency', description: 'Currency code', type: 3, required: true },
                { name: 'amount', description: 'Amount', type: 10, required: true },
                { name: 'reason', description: 'Reason', type: 3, required: false }
            ],
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'transfer',
            description: 'Bank transfer to another account',
            options: [
                { name: 'to_account', description: 'Account ID', type: 3, required: true },
                { name: 'amount', description: 'Amount', type: 10, required: true },
                { name: 'reason', description: 'Reason', type: 3, required: true }
            ],
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'deposit',
            description: 'Deposit cash into your bank account',
            options: [
                { name: 'account_id', description: 'Your account ID', type: 3, required: true },
                { name: 'amount', description: 'Amount', type: 10, required: true },
                { name: 'currency', description: 'Currency code', type: 3, required: true }
            ],
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'withdraw',
            description: 'Withdraw cash from your bank account',
            options: [
                { name: 'account_id', description: 'Your account ID', type: 3, required: true },
                { name: 'amount', description: 'Amount', type: 10, required: true }
            ],
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'pay',
            description: 'Pay someone from an entity treasury (requires permission)',
            options: [
                { name: 'entity', description: 'Entity name', type: 3, required: true },
                { name: 'amount', description: 'Amount', type: 10, required: true },
                { name: 'currency', description: 'Currency', type: 3, required: true },
                { name: 'reason', description: 'Reason', type: 3, required: true },
                { name: 'to_user', description: 'Username (for cash)', type: 3, required: false },
                { name: 'to_account', description: 'Account ID (for bank)', type: 3, required: false }
            ],
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'paytax',
            description: 'Pay an entity (country/company)',
            options: [
                { name: 'entity', description: 'Entity name', type: 3, required: true },
                { name: 'amount', description: 'Amount', type: 10, required: true },
                { name: 'reason', description: 'Reason (e.g. taxes)', type: 3, required: true }
            ],
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'burn',
            description: 'Burn cash',
            options: [
                { name: 'currency', description: 'Currency', type: 3, required: true },
                { name: 'amount', description: 'Amount', type: 10, required: true },
                { name: 'reason', description: 'Reason', type: 3, required: true }
            ],
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'pending',
            description: 'View and manage pending transactions',
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'stock',
            description: 'View stock information',
            options: [
                { name: 'ticker', description: 'Stock ticker', type: 3, required: true }
            ],
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'buy',
            description: 'Buy stocks',
            options: [
                { name: 'ticker', description: 'Stock ticker', type: 3, required: true },
                { name: 'shares', description: 'Number of shares', type: 4, required: true }
            ],
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'sell',
            description: 'Sell stocks',
            options: [
                { name: 'ticker', description: 'Stock ticker', type: 3, required: true },
                { name: 'shares', description: 'Number of shares', type: 4, required: true }
            ],
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'portfolio',
            description: 'View your stock portfolio',
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        },
        {
            name: 'market',
            description: 'View all listed stocks',
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        }
    ];

    const rest = new REST({ version: '10' }).setToken(CONFIG.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Commands registered');
}

// ==================== COMMAND HANDLERS ====================

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
    } else if (interaction.isButton()) {
        await handleButton(interaction);
    }
});

async function handleCommand(interaction) {
    try {
        const userMap = await loadUserMap();
        const username = userMap[interaction.user.id];

        if (!username && !['market', 'stock'].includes(interaction.commandName)) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Account Not Linked')
                .setDescription('Your Discord account is not linked to a Construxis user')
                .setColor(0xff0000);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        switch (interaction.commandName) {
            case 'balance':
                await handleBalance(interaction, username);
                break;
            case 'history':
                await handleHistory(interaction, username);
                break;
            case 'hand':
                await handleHand(interaction, username);
                break;
            case 'transfer':
                await handleTransfer(interaction, username);
                break;
            case 'deposit':
                await handleDeposit(interaction, username);
                break;
            case 'withdraw':
                await handleWithdraw(interaction, username);
                break;
            case 'pay':
                await handlePay(interaction, username);
                break;
            case 'paytax':
                await handlePaytax(interaction, username);
                break;
            case 'burn':
                await handleBurn(interaction, username);
                break;
            case 'pending':
                await handlePending(interaction, username);
                break;
            case 'stock':
                await handleStock(interaction);
                break;
            case 'buy':
                await handleBuy(interaction, username);
                break;
            case 'sell':
                await handleSell(interaction, username);
                break;
            case 'portfolio':
                await handlePortfolio(interaction, username);
                break;
            case 'market':
                await handleMarket(interaction);
                break;
        }
    } catch (error) {
        console.error(error);
        const errorMsg = error.response?.data?.detail || error.message || 'Unknown error';
        const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(errorMsg)
            .setColor(0xff0000);
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
        }
    }
}

async function handleButton(interaction) {
    try {
        const [action, txnId] = interaction.customId.split('_');
        
        if (!['approve', 'decline'].includes(action)) return;
        
        await interaction.deferUpdate();
        
        const result = await apiCall('/pending/action', 'POST', {
            transaction_id: txnId,
            action: action
        });
        
        const embed = new EmbedBuilder()
            .setTitle(action === 'approve' ? '✅ Transaction Approved' : '❌ Transaction Declined')
            .setDescription(`Transaction ID: ${txnId}`)
            .setColor(action === 'approve' ? 0x00ff00 : 0xff0000)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed], components: [] });
    } catch (error) {
        console.error(error);
        const errorMsg = error.response?.data?.detail || error.message;
        const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(errorMsg)
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
    }
}

// ==================== INDIVIDUAL COMMAND IMPLEMENTATIONS ====================

async function handleBalance(interaction, username) {
    const userData = await getUserData(username);
    if (!userData) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription('User not found')
            .setColor(0xff0000);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const embed = new EmbedBuilder().setTitle('💰 Your Balances').setColor(0x0099ff);

    const cash = {};
    userData.wallets?.forEach(w => {
        cash[w.currency] = (cash[w.currency] || 0) + w.balance;
    });

    if (Object.keys(cash).length) {
        embed.addFields({ 
            name: '💵 Cash', 
            value: Object.entries(cash).map(([c,b]) => 
                `${formatCurrency(b, c)} (${getCurrencyName(c)})`
            ).join('\n') 
        });
    }

    if (userData.bankAccounts?.length) {
        embed.addFields({ 
            name: '🏦 Bank Accounts', 
            value: userData.bankAccounts.map(a => {
                const frozen = a.frozen ? ' **[FROZEN]**' : '';
                return `${formatCurrency(a.balance, a.currency)} (${getCurrencyName(a.currency)})${frozen}\nAccount: ${a.accountId}`;
            }).join('\n\n') 
        });
    }

    if (!Object.keys(cash).length && !userData.bankAccounts?.length) {
        embed.setDescription('No balances found');
    }

    embed.setTimestamp();
    await interaction.reply({ embeds: [embed] });
}

async function handleHistory(interaction, username) {
    const limit = interaction.options.getInteger('limit') || 10;
    const history = await apiCall(`/user/${username}/history?limit=${limit}`);
    
    if (!history.transactions || history.transactions.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Transaction History')
            .setDescription('No transactions found')
            .setColor(0x999999);
        return interaction.reply({ embeds: [embed] });
    }
    
    const embed = new EmbedBuilder()
        .setTitle('📋 Transaction History')
        .setDescription(`Showing ${history.transactions.length} most recent transactions`)
        .setColor(0x0099ff);
    
    for (const txn of history.transactions.slice(0, 10)) {
        const date = new Date(txn.date).toLocaleString();
        const amount = formatCurrency(txn.amount, txn.currency);
        const from = txn.from.includes(':') ? txn.from.split(':')[1] : txn.from;
        const to = txn.to.includes(':') ? txn.to.split(':')[1] : txn.to;
        
        embed.addFields({
            name: `${txn.id} - ${txn.type}`,
            value: `${amount}\n${from} → ${to}\n${txn.note || 'No note'}\n${date}`,
            inline: false
        });
    }
    
    await interaction.reply({ embeds: [embed] });
}

async function handleHand(interaction, username) {
    const toUser = interaction.options.getString('to_user');
    const currency = interaction.options.getString('currency').toUpperCase();
    const amount = interaction.options.getNumber('amount');
    const reason = interaction.options.getString('reason') || 'Cash payment';

    const userData = await getUserData(username);
    const fromWallet = userData.wallets?.find(w => w.currency === currency);
    
    if (!fromWallet) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(`You don't have a ${getCurrencyName(currency)} cash wallet`)
            .setColor(0xff0000);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const toWalletId = `VF-CASH-${toUser}-${currency}`;

    await apiCall('/transaction', 'POST', {
        from_wallet: fromWallet.id,
        to_wallet: toWalletId,
        amount,
        currency,
        note: reason,
        is_physical: true
    });

    const userMap = await loadUserMap();
    const recipientId = Object.keys(userMap).find(id => userMap[id] === toUser);
    if (recipientId) {
        try {
            const recipient = await client.users.fetch(recipientId);
            const notifEmbed = new EmbedBuilder()
                .setTitle('💵 Cash Received')
                .setDescription(`**${interaction.user.username}** handed you **${formatCurrency(amount, currency)}**`)
                .addFields({ name: 'Reason', value: reason })
                .setColor(0x00ff00)
                .setTimestamp();
            await recipient.send({ embeds: [notifEmbed] });
        } catch (e) {}
    }

    const embed = new EmbedBuilder()
        .setTitle('💵 Cash Handed')
        .setDescription(`Handed **${formatCurrency(amount, currency)}** to **${toUser}**`)
        .addFields({ name: 'Reason', value: reason })
        .setColor(0x00ff00)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleTransfer(interaction, username) {
    const toAccount = interaction.options.getString('to_account');
    const amount = interaction.options.getNumber('amount');
    const reason = interaction.options.getString('reason');

    const userData = await getUserData(username);
    const myAccount = userData.bankAccounts?.[0];
    
    if (!myAccount) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription('You don\'t have a bank account')
            .setColor(0xff0000);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const result = await apiCall('/transaction', 'POST', {
        from_wallet: myAccount.accountId,
        to_wallet: toAccount,
        amount,
        currency: myAccount.currency,
        note: reason,
        is_physical: false
    });

    const amountFormatted = formatCurrency(amount, myAccount.currency);

    const embed = new EmbedBuilder()
        .setDescription(`Transferred **${amountFormatted}** to **${toAccount}**`)
        .addFields({ name: 'Reason', value: reason })
        .setTimestamp();

    if (result.status === 'completed') {
        embed.setTitle('✅ Transfer Complete')
            .setColor(0x00ff00);
    } else {
        embed.setTitle('⏳ Transfer Pending')
            .addFields({ name: 'Transaction ID', value: result.transaction_id })
            .setColor(0xffaa00);
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleDeposit(interaction, username) {
    const accountId = interaction.options.getString('account_id');
    const amount = interaction.options.getNumber('amount');
    const currency = interaction.options.getString('currency').toUpperCase();

    await apiCall('/account/operation', 'POST', {
        account_id: accountId,
        amount,
        currency,
        action: 'deposit'
    });

    const embed = new EmbedBuilder()
        .setTitle('✅ Deposit Complete')
        .setDescription(`Deposited **${formatCurrency(amount, currency)}** into account`)
        .addFields({ name: 'Account', value: accountId })
        .setColor(0x00ff00)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleWithdraw(interaction, username) {
    const accountId = interaction.options.getString('account_id');
    const amount = interaction.options.getNumber('amount');

    const userData = await getUserData(username);
    const account = userData.bankAccounts?.find(a => a.accountId === accountId);
    
    if (!account) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription('Account not found')
            .setColor(0xff0000);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await apiCall('/account/operation', 'POST', {
        account_id: accountId,
        amount,
        currency: account.currency,
        action: 'withdraw'
    });

    const embed = new EmbedBuilder()
        .setTitle('✅ Withdrawal Complete')
        .setDescription(`Withdrew **${formatCurrency(amount, account.currency)}** from account`)
        .addFields({ name: 'Account', value: accountId })
        .setColor(0x00ff00)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handlePay(interaction, username) {
    const entityName = interaction.options.getString('entity');
    const amount = interaction.options.getNumber('amount');
    const currency = interaction.options.getString('currency').toUpperCase();
    const reason = interaction.options.getString('reason');
    const toUser = interaction.options.getString('to_user');
    const toAccount = interaction.options.getString('to_account');

    if (!await userHasEntityPerm(interaction.user.id, entityName, 'pay')) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Permission Denied')
            .setDescription('You don\'t have permission to pay from this entity')
            .setColor(0xff0000);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const payload = {
        entity_name: entityName,
        amount,
        currency,
        note: reason
    };

    if (toUser) {
        payload.to_username = toUser;
    } else if (toAccount) {
        payload.to_wallet = toAccount;
    } else {
        const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription('Specify either to_user or to_account')
            .setColor(0xff0000);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await apiCall('/entity/pay', 'POST', payload);

    const recipient = toUser ? `**${toUser}**` : `account **${toAccount}**`;
    const embed = new EmbedBuilder()
        .setTitle('✅ Entity Payment')
        .setDescription(`Paid **${formatCurrency(amount, currency)}** from **${entityName}**`)
        .addFields(
            { name: 'To', value: recipient },
            { name: 'Reason', value: reason }
        )
        .setColor(0x0099ff)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handlePaytax(interaction, username) {
    const entityName = interaction.options.getString('entity');
    const amount = interaction.options.getNumber('amount');
    const reason = interaction.options.getString('reason');

    const userData = await getUserData(username);
    const account = userData.bankAccounts?.[0];
    
    if (!account) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription('You don\'t have a bank account')
            .setColor(0xff0000);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await apiCall('/entity/receive', 'POST', {
        entity_name: entityName,
        from_account: account.accountId,
        amount,
        currency: account.currency,
        note: reason
    });

    const embed = new EmbedBuilder()
        .setTitle('✅ Payment to Entity')
        .setDescription(`Paid **${formatCurrency(amount, account.currency)}** to **${entityName}**`)
        .addFields({ name: 'Reason', value: reason })
        .setColor(0x00ff00)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleBurn(interaction, username) {
    const currency = interaction.options.getString('currency').toUpperCase();
    const amount = interaction.options.getNumber('amount');
    const reason = interaction.options.getString('reason');

    const userData = await getUserData(username);
    const wallet = userData.wallets?.find(w => w.currency === currency);
    
    if (!wallet) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(`You don't have ${getCurrencyName(currency)} cash`)
            .setColor(0xff0000);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await apiCall('/burn', 'POST', {
        wallet_id: wallet.id,
        amount,
        currency,
        reason
    });

    const embed = new EmbedBuilder()
        .setTitle('🔥 Currency Burned')
        .setDescription(`Destroyed **${formatCurrency(amount, currency)}**`)
        .addFields({ name: 'Reason', value: reason })
        .setColor(0xff6600)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handlePending(interaction, username) {
    const pending = await apiCall('/pending');
    
    if (!pending.pending_transactions || Object.keys(pending.pending_transactions).length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('⏳ Pending Transactions')
            .setDescription('No pending transactions')
            .setColor(0x999999);
        return interaction.reply({ embeds: [embed] });
    }
    
    for (const [txnId, txn] of Object.entries(pending.pending_transactions)) {
        const amount = formatCurrency(txn.amount, txn.currency);
        const date = new Date(txn.created_at).toLocaleString();
        
        const embed = new EmbedBuilder()
            .setTitle('⏳ Pending Transaction')
            .setDescription(`**${amount}**`)
            .addFields(
                { name: 'From', value: txn.from, inline: true },
                { name: 'To', value: txn.to, inline: true },
                { name: 'Type', value: txn.is_physical ? 'Physical' : 'Digital', inline: true },
                { name: 'Note', value: txn.note || 'No note' },
                { name: 'Created', value: date },
                { name: 'Transaction ID', value: txnId }
            )
            .setColor(0xffaa00)
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`approve_${txnId}`)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`decline_${txnId}`)
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Danger)
            );
        
        await interaction.reply({ embeds: [embed], components: [row] });
        return; // Show one at a time
    }
}

async function handleStock(interaction) {
    const ticker = interaction.options.getString('ticker').toUpperCase();
    const stock = await apiCall(`/stock/${ticker}`);

    const priceFormatted = formatCurrency(stock.price, stock.currency);
    const currencyName = getCurrencyName(stock.currency);

    const embed = new EmbedBuilder()
        .setTitle(`📈 ${stock.name} (${ticker})`)
        .addFields(
            { name: 'Current Price', value: priceFormatted, inline: true },
            { name: 'Volume (24h)', value: `${stock.volume_24h} shares`, inline: true },
            { name: 'Shareholders', value: `${stock.shareholders}`, inline: true },
            { name: 'Outstanding Shares', value: `${stock.outstanding_shares.toLocaleString()}`, inline: true }
        )
        .setColor(0x00ff00);
    
    if (currencyName) {
        embed.setFooter({ text: currencyName });
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleBuy(interaction, username) {
    const ticker = interaction.options.getString('ticker').toUpperCase();
    const shares = interaction.options.getInteger('shares');

    const userData = await getUserData(username);
    const account = userData.bankAccounts?.[0];

    if (!account) {
        return interaction.reply({ content: '❌ You need a bank account to buy stocks', ephemeral: true });
    }

    const result = await apiCall('/stock/trade', 'POST', {
        ticker,
        shares,
        action: 'buy',
        wallet_id: account.accountId
    });

    const currency = result.currency || account.currency;
    const priceFormatted = formatCurrency(result.price, currency);
    const totalFormatted = formatCurrency(result.total, currency);
    const newPriceFormatted = formatCurrency(result.new_price, currency);

    const embed = new EmbedBuilder()
        .setTitle('✅ Stock Purchase')
        .setDescription(`Bought **${shares} ${ticker}**`)
        .addFields(
            { name: 'Price per Share', value: priceFormatted, inline: true },
            { name: 'Total Cost', value: totalFormatted, inline: true },
            { name: 'New Market Price', value: newPriceFormatted, inline: true }
        )
        .setColor(0x00ff00)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleSell(interaction, username) {
    const ticker = interaction.options.getString('ticker').toUpperCase();
    const shares = interaction.options.getInteger('shares');

    const userData = await getUserData(username);
    const account = userData.bankAccounts?.[0];

    if (!account) {
        return interaction.reply({ content: '❌ You need a bank account', ephemeral: true });
    }

    const result = await apiCall('/stock/trade', 'POST', {
        ticker,
        shares,
        action: 'sell',
        wallet_id: account.accountId
    });

    const currency = result.currency || account.currency;
    const priceFormatted = formatCurrency(result.price, currency);
    const totalFormatted = formatCurrency(result.total, currency);
    const newPriceFormatted = formatCurrency(result.new_price, currency);

    const embed = new EmbedBuilder()
        .setTitle('✅ Stock Sale')
        .setDescription(`Sold **${shares} ${ticker}**`)
        .addFields(
            { name: 'Price per Share', value: priceFormatted, inline: true },
            { name: 'Total Received', value: totalFormatted, inline: true },
            { name: 'New Market Price', value: newPriceFormatted, inline: true }
        )
        .setColor(0xff9900)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handlePortfolio(interaction, username) {
    const portfolio = await apiCall(`/stock/portfolio/${username}`);

    if (!portfolio.holdings || !portfolio.holdings.length) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Portfolio')
            .setDescription('You don\'t own any stocks yet')
            .setColor(0x999999);
        return interaction.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
        .setTitle(`📊 ${username}'s Portfolio`)
        .setColor(0x0099ff);

    const totalsByCurrency = {};
    
    for (const holding of portfolio.holdings) {
        const priceFormatted = formatCurrency(holding.current_price, holding.currency);
        const valueFormatted = formatCurrency(holding.total_value, holding.currency);
        
        embed.addFields({
            name: holding.ticker,
            value: `${holding.shares} shares @ ${priceFormatted}\nValue: **${valueFormatted}**`,
            inline: true
        });
        
        totalsByCurrency[holding.currency] = (totalsByCurrency[holding.currency] || 0) + holding.total_value;
    }

    const totalText = Object.entries(totalsByCurrency)
        .map(([curr, val]) => formatCurrency(val, curr))
        .join('\n');
    
    embed.addFields({ 
        name: 'Total Portfolio Value', 
        value: totalText,
        inline: false 
    });

    await interaction.reply({ embeds: [embed] });
}

async function handleMarket(interaction) {
    const market = await apiCall('/stocks');

    if (!market.stocks || !market.stocks.length) {
        return interaction.reply({ content: '📈 No stocks listed yet' });
    }

    const embed = new EmbedBuilder()
        .setTitle('📈 Stock Market')
        .setDescription('All available stocks')
        .setColor(0x00ff00);

    for (const stock of market.stocks) {
        const priceFormatted = formatCurrency(stock.price, stock.currency);
        
        embed.addFields({
            name: `${stock.ticker} - ${stock.name}`,
            value: `Price: **${priceFormatted}**\n24h Vol: ${stock.volume_24h} shares`,
            inline: true
        });
    }

    await interaction.reply({ embeds: [embed] });
}

// ==================== BOT STARTUP ====================

client.once('ready', async () => {
    console.log(`✅ Bot online as ${client.user.tag}`);
    
    await fetchCurrencies();
    setInterval(fetchCurrencies, 10 * 60 * 1000);
    
    await registerCommands();
});

client.login(CONFIG.DISCORD_TOKEN);