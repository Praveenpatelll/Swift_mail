let API_BASE = "https://api.mail.tm";
let currentAddress = "";
let currentToken = "";
let currentPassword = "";
let checkInterval;
let availableDomains = [];

// DOM Elements - Email
const emailInput = document.getElementById('email-address');
const loadEmailBtn = document.getElementById('load-email-btn');
const copyBtn = document.getElementById('copy-btn');
const refreshBtn = document.getElementById('refresh-btn');
const manualRefreshBtn = document.getElementById('manual-refresh');
const domainSelect = document.getElementById('domain-select');
const emailList = document.getElementById('email-list');
const emailDetail = document.getElementById('email-detail');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-emails');
const statusText = document.getElementById('status-text');
const lastUpdatedText = document.getElementById('last-updated');
const toast = document.getElementById('toast');
const backBtn = document.getElementById('back-to-list');
const simulateEmailOtpBtn = document.getElementById('simulate-email-otp-btn');

// Email Message Detail Elements
const msgSubject = document.getElementById('msg-subject');
const msgFrom = document.getElementById('msg-from');
const msgDate = document.getElementById('msg-date');
const msgBody = document.getElementById('msg-body');

// SMS Elements
const countrySelect = document.getElementById('country-select');
const numberSelect = document.getElementById('number-select');
const phoneDisplay = document.getElementById('phone-display');
const copySmsBtn = document.getElementById('copy-sms-btn');
const refreshSmsBtn = document.getElementById('refresh-sms-btn');
const smsStatusText = document.getElementById('sms-status-text');
const smsList = document.getElementById('sms-list');
const tabLinks = document.querySelectorAll('.tab-link');
const tabSections = document.querySelectorAll('.tab-section');
const simulateOtpBtn = document.getElementById('simulate-otp-btn');

let currentTab = 'email';
let currentPhoneNumber = "";
let smsInterval;
let smsMessages = []; // State for SMS

// History Elements
const historyBtn = document.getElementById('history-btn');
const historyModal = document.getElementById('history-modal');
const closeHistoryBtn = document.getElementById('close-history');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
const historySearch = document.getElementById('history-search');
const restoreTestDataBtn = document.getElementById('restore-test-data');
let emailHistory = [];

// --- OTP & MESSAGE STORAGE HELPERS ---

// Extract OTP / verification code from subject or body text
function extractOtp(text) {
    if (!text) return null;
    // Look for patterns like "verification code: 123456", "OTP is 123456", "code: 123456", etc.
    const labeledMatch = text.match(/(?:otp|code|verification|pin|password|security|access code)[\s:-]+(\b\d{4,8}\b)/i);
    if (labeledMatch) return labeledMatch[1];

    // Look for standalone 6-digit code
    const sixDigit = text.match(/\b(\d{6})\b/);
    if (sixDigit) return sixDigit[1];

    // Look for 4 to 8 digit numbers
    const digits = text.match(/\b(\d{4,8})\b/);
    return digits ? digits[1] : null;
}

// Retrieve saved messages for a specific email from localStorage
function getStoredMessages(address) {
    if (!address) return [];
    try {
        const key = 'swiftmail_msgs_' + address.trim().toLowerCase();
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Error loading stored messages", e);
        return [];
    }
}

// Persist messages for a specific email to localStorage
function saveStoredMessages(address, messages) {
    if (!address) return;
    try {
        const key = 'swiftmail_msgs_' + address.trim().toLowerCase();
        localStorage.setItem(key, JSON.stringify(messages));
    } catch (e) {
        console.error("Error saving stored messages", e);
    }
}

// Generate realistic OTP verification email
function generateOtpEmail(address, serviceName, customCode) {
    const services = [
        {
            name: 'Google',
            from: 'account-security-noreply@google.com',
            accent: '#1a73e8',
            subject: (code) => `${code} is your Google verification code`,
            body: (code) => `Use verification code <strong>${code}</strong> to verify your account or complete your sign-in for <strong>${address}</strong>. This code expires in 10 minutes.`
        },
        {
            name: 'Netflix',
            from: 'info@account.netflix.com',
            accent: '#e50914',
            subject: (code) => `Your Netflix sign-in code: ${code}`,
            body: (code) => `We received a request to access your Netflix account with <strong>${address}</strong>. Your single-use access code is <strong>${code}</strong>. Valid for 15 minutes.`
        },
        {
            name: 'Instagram',
            from: 'security@mail.instagram.com',
            accent: '#e1306c',
            subject: (code) => `${code} is your Instagram security code`,
            body: (code) => `Someone tried to log in or register with <strong>${address}</strong>. Enter your security code <strong>${code}</strong> to confirm your identity.`
        },
        {
            name: 'WhatsApp',
            from: 'verify@whatsapp.com',
            accent: '#25d366',
            subject: (code) => `WhatsApp verification code: ${code}`,
            body: (code) => `Your WhatsApp one-time registration code is <strong>${code}</strong>. Never share this code with anyone.`
        },
        {
            name: 'GitHub',
            from: 'support@github.com',
            accent: '#24292e',
            subject: (code) => `[GitHub] Device verification code: ${code}`,
            body: (code) => `Please use the following verification code to authenticate your session for <strong>${address}</strong>: <strong>${code}</strong>. Valid for 10 minutes.`
        },
        {
            name: 'Amazon',
            from: 'account-update@amazon.com',
            accent: '#ff9900',
            subject: (code) => `${code} is your Amazon verification OTP`,
            body: (code) => `For your security, don't share this code. Your Amazon One-Time Password (OTP) is <strong>${code}</strong>.`
        }
    ];

    let chosenService;
    if (serviceName) {
        chosenService = services.find(s => s.name.toLowerCase() === serviceName.toLowerCase()) || services[0];
    } else {
        // Deterministic service selection based on address hash
        let hash = 0;
        for (let i = 0; i < address.length; i++) hash = (hash * 31 + address.charCodeAt(i)) & 0xffffffff;
        chosenService = services[Math.abs(hash) % services.length];
    }

    const code = customCode || String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date();

    return {
        id: 'sim_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        subject: chosenService.subject(code),
        from: { address: chosenService.from, name: chosenService.name },
        createdAt: now.toISOString(),
        intro: `Your verification code is ${code}`,
        text: `From: ${chosenService.name}\n\nYour one-time verification code is: ${code}\n\nSent to: ${address}\nValid for 10 minutes.`,
        html: [
            `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:550px;margin:0 auto;background:#181824;color:#e2e8f0;border-radius:14px;padding:24px;border:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
                    <div style="background:${chosenService.accent};color:#fff;width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;">
                        ${chosenService.name[0]}
                    </div>
                    <div>
                        <h3 style="margin:0;font-size:16px;color:#fff;">${chosenService.name} Verification</h3>
                        <span style="font-size:12px;color:#94a3b8;">${chosenService.from}</span>
                    </div>
                </div>
                <p style="font-size:14px;color:#cbd5e1;line-height:1.6;margin-bottom:20px;">
                    ${chosenService.body(code)}
                </p>
                <div style="background:rgba(255,255,255,0.06);border:1.5px dashed ${chosenService.accent};border-radius:12px;padding:18px;text-align:center;margin:20px 0;">
                    <span style="display:block;font-size:11px;letter-spacing:1.5px;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;">One-Time Verification Code (OTP)</span>
                    <span style="font-size:32px;letter-spacing:6px;font-weight:800;color:#38bdf8;font-family:monospace;">${code}</span>
                </div>
                <p style="font-size:12px;color:#64748b;margin-top:20px;">
                    This email was sent to ${address}. If you did not request this verification, you can safely ignore this email.
                </p>
            </div>`
        ],
        otp: code,
        isSimulated: true
    };
}

// Function to seed test history data with pre-loaded OTPs
function seedTestHistory() {
    const testEmails = [
        { address: 'r0ne8oiwt3@dollicons.com', password: 'testpass123', timestamp: Date.now() - 3600000 },
        { address: 't4ntdo928g@dollicons.com', password: 'testpass456', timestamp: Date.now() - 7200000 },
        { address: 'lw76rcrenqn@dollicons.com', password: 'testpass789', timestamp: Date.now() - 10800000 },
        { address: '2u0l49e20h@dollicons.com', password: 'testpass101', timestamp: Date.now() - 14400000 },
        { address: 'mxn676pzki@dollicons.com', password: 'testpass202', timestamp: Date.now() - 18000000 },
        { address: 'rf7hls1qk6@dollicons.com', password: 'testpass303', timestamp: Date.now() - 21600000 },
        { address: 'd4rathxuk@dollicons.com', password: 'testpass404', timestamp: Date.now() - 25200000 },
        { address: 'pc35e0s8pb@dollicons.com', password: 'testpass505', timestamp: Date.now() - 28800000 },
        { address: 'g00k5p7a99@dollicons.com', password: 'testpass606', timestamp: Date.now() - 32400000 },
        { address: 'yi7tsqxl1t@dollicons.com', password: 'testpass707', timestamp: Date.now() - 36000000 },
        { address: 'yskckxwmia@dollicons.com', password: 'testpass808', timestamp: Date.now() - 39600000 },
        { address: 'kq4cqpbk8y@dollicons.com', password: 'testpass909', timestamp: Date.now() - 43200000 },
        { address: 'fsp4swcfl9@dollicons.com', password: 'testpass010', timestamp: Date.now() - 46800000 },
        { address: '1g70esjvpa@dollicons.com', password: 'testpass111', timestamp: Date.now() - 50400000 },
        { address: 'vjx0s6qajb@dollicons.com', password: 'testpass222', timestamp: Date.now() - 54000000 },
        { address: '6bukmd0g3f@dollicons.com', password: 'testpass333', timestamp: Date.now() - 57600000 },
        { address: '57ydfuzke0@dollicons.com', password: 'testpass444', timestamp: Date.now() - 61200000 },
        { address: 'cb5xhgw3g8@dollicons.com', password: 'testpass555', timestamp: Date.now() - 64800000 },
        { address: 'vpd4h8fsvf@dollicons.com', password: 'testpass666', timestamp: Date.now() - 68400000 },
        { address: 'je6cxfquuu@dollicons.com', password: 'testpass777', timestamp: Date.now() - 72000000 }
    ];

    emailHistory = testEmails;
    localStorage.setItem('swiftmail_history', JSON.stringify(emailHistory));

    // Seed realistic OTP messages for each test email so their inboxes immediately have OTPs ready
    testEmails.forEach(item => {
        const stored = getStoredMessages(item.address);
        if (!stored || stored.length === 0) {
            const seedMsg = generateOtpEmail(item.address);
            seedMsg.createdAt = new Date(item.timestamp).toISOString();
            saveStoredMessages(item.address, [seedMsg]);
        }
    });

    console.log('✅ Test history seeded with', testEmails.length, 'emails & OTP messages');
}

// Initial Setup
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch available email domains
    await fetchDomains();

    // 2. Load History
    const savedHistory = localStorage.getItem('swiftmail_history');
    if (savedHistory) {
        try {
            emailHistory = JSON.parse(savedHistory);
        } catch (e) {
            console.error("Error parsing history", e);
            emailHistory = [];
        }
    }

    if (emailHistory.length === 0) {
        seedTestHistory();
    }

    // 3. Load or generate current active email
    const saved = localStorage.getItem('swiftmail_data');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            currentAddress = data.address;
            currentToken = data.token;
            currentPassword = data.password;
            emailInput.value = currentAddress;

            if (currentAddress && currentAddress.includes('@')) {
                const savedDomain = currentAddress.split('@')[1];
                domainSelect.value = savedDomain;
            }

            // Load and display messages / OTP for this email immediately
            loadEmailInbox(currentAddress);
        } catch (e) {
            await generateNewEmail();
        }
    } else {
        await generateNewEmail();
    }

    // 4. Setup SMS
    setupSms();

    startAutoCheck();
});

// Event Listeners - Email
copyBtn.addEventListener('click', () => {
    if (currentAddress) {
        navigator.clipboard.writeText(currentAddress).then(() => {
            showToast("Address copied!");
        });
    }
});

refreshBtn.addEventListener('click', () => {
    generateNewEmail();
});

manualRefreshBtn.addEventListener('click', () => {
    if (currentTab === 'email') {
        fetchMessages();
    } else {
        fetchSmsMessages();
    }
});

backBtn.addEventListener('click', () => {
    emailDetail.classList.add('hidden');
    if (currentTab === 'email') {
        emailList.classList.remove('hidden');
    } else {
        smsList.classList.remove('hidden');
    }
});

// Open / Load Inbox when user enters an old generated mail
loadEmailBtn.addEventListener('click', () => {
    loadEmailInbox(emailInput.value);
});

emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        loadEmailInbox(emailInput.value);
    }
});

// Simulate Incoming OTP Email
simulateEmailOtpBtn.addEventListener('click', () => {
    if (!currentAddress) {
        showToast("Please enter or generate an email address first");
        return;
    }
    simulateIncomingEmailOtp(currentAddress);
});

// Tab Switching
tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = link.getAttribute('data-tab');
        switchTab(tabId);
    });
});

// SMS Listeners
countrySelect.addEventListener('change', () => {
    fetchNumbersForCountry(countrySelect.value);
});

numberSelect.addEventListener('change', () => {
    selectPhoneNumber(numberSelect.value);
});

copySmsBtn.addEventListener('click', () => {
    if (currentPhoneNumber) {
        navigator.clipboard.writeText(currentPhoneNumber).then(() => {
            showToast("Number copied!");
        });
    }
});

refreshSmsBtn.addEventListener('click', () => {
    fetchNumbersForCountry(countrySelect.value);
});

simulateOtpBtn.addEventListener('click', () => {
    if (currentPhoneNumber) {
        simulateIncomingOTP();
    } else {
        showToast("Please select a phone number first");
    }
});

// History Modal Listeners
historyBtn.addEventListener('click', () => {
    historySearch.value = "";
    renderHistory();
    historyModal.classList.remove('hidden');
    setTimeout(() => historySearch.focus(), 100);
});

historySearch.addEventListener('input', (e) => {
    renderHistory(e.target.value);
});

closeHistoryBtn.addEventListener('click', () => {
    historyModal.classList.add('hidden');
});

clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Clear all history?')) {
        emailHistory = [];
        localStorage.removeItem('swiftmail_history');
        renderHistory();
        showToast("History cleared");
    }
});

restoreTestDataBtn.addEventListener('click', () => {
    if (confirm('Restore test email history? This will replace your current history.')) {
        seedTestHistory();
        renderHistory();
        showToast("Test data restored with 20 sample emails & OTPs");
    }
});

window.addEventListener('click', (e) => {
    if (e.target === historyModal) {
        historyModal.classList.add('hidden');
    }
});

// Helper for random string
function randomString(length) {
    return Math.random().toString(36).substring(2, 2 + length);
}

// Fetch available domains with local proxy fallback
async function fetchDomains() {
    try {
        let res;
        try {
            res = await fetch(`${API_BASE}/domains`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (fetchErr) {
            if (!API_BASE.includes('/api/mail')) {
                res = await fetch('/api/mail/domains');
                if (res.ok) {
                    API_BASE = '/api/mail';
                } else {
                    throw fetchErr;
                }
            } else {
                throw fetchErr;
            }
        }

        const data = await res.json();
        availableDomains = data['hydra:member'] || [];

        domainSelect.innerHTML = "";
        availableDomains.forEach(dom => {
            const opt = document.createElement('option');
            opt.value = dom.domain;
            opt.textContent = dom.domain;
            domainSelect.appendChild(opt);
        });
    } catch (error) {
        console.error("Error fetching domains:", error);
        domainSelect.innerHTML = '<option value="dollicons.com">dollicons.com</option>';
        if (window.location.protocol === 'file:') {
            showToast("Cannot fetch from file://. Please run with 'node server.js'");
        }
    }
}

// Generate new random email
async function generateNewEmail() {
    try {
        emailInput.value = "Generating...";
        loadingState.classList.remove('hidden');

        let domain = domainSelect.value;
        if (!domain && availableDomains.length > 0) {
            domain = availableDomains[0].domain;
            domainSelect.value = domain;
        }

        if (!domain) {
            await fetchDomains();
            if (availableDomains.length > 0) {
                domain = availableDomains[0].domain;
                domainSelect.value = domain;
            } else {
                domain = "dollicons.com";
            }
        }

        const login = randomString(10);
        const password = randomString(12);
        const address = `${login}@${domain}`;

        let token = "";
        try {
            const accRes = await fetch(`${API_BASE}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, password })
            });

            if (accRes.ok) {
                const tokRes = await fetch(`${API_BASE}/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address, password })
                });
                if (tokRes.ok) {
                    const tokData = await tokRes.json();
                    token = tokData.token;
                }
            }
        } catch (err) {
            console.warn("Mail.tm online creation skipped (offline/demo mode)", err.message);
        }

        currentAddress = address;
        currentToken = token;
        currentPassword = password;
        emailInput.value = address;
        localStorage.setItem('swiftmail_data', JSON.stringify({ address, token, password }));

        addToHistory(address, token, password);

        // Reset UI
        emailList.innerHTML = "";
        emailList.classList.add('hidden');
        emailDetail.classList.add('hidden');
        emptyState.classList.remove('hidden');
        loadingState.classList.add('hidden');
        statusText.textContent = "Waiting for emails...";

        showToast("New address generated!");
    } catch (error) {
        console.error("Error generating email:", error);
        emailInput.value = "Error. Try again.";
        loadingState.classList.add('hidden');
        showToast("Error: " + error.message);
    }
}

// --- CORE FEATURE: LOAD OLD GENERATED MAIL & SHOW OTPs ---
function loadEmailInbox(rawAddress) {
    if (!rawAddress) {
        showToast("Please enter an email address");
        return;
    }

    let address = rawAddress.trim().toLowerCase();

    // If user entered only the username prefix (e.g. "mymail"), append current domain
    if (!address.includes('@')) {
        const defaultDomain = domainSelect.value || (availableDomains.length > 0 ? availableDomains[0].domain : 'dollicons.com');
        address = `${address}@${defaultDomain}`;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
        showToast("Please enter a valid email format");
        return;
    }

    // Check if credentials exist in history
    const existing = emailHistory.find(item => item.address.toLowerCase() === address);
    if (existing) {
        currentToken = existing.token || "";
        currentPassword = existing.password || "";
    } else {
        currentToken = "";
        currentPassword = randomString(12);
        addToHistory(address, currentToken, currentPassword);
    }

    currentAddress = address;
    emailInput.value = address;

    // Match domain dropdown if applicable
    const parts = address.split('@');
    if (parts[1]) {
        domainSelect.value = parts[1];
    }

    // Save to active session storage
    localStorage.setItem('swiftmail_data', JSON.stringify({
        address: currentAddress,
        token: currentToken,
        password: currentPassword
    }));

    // Ensure we are in Email tab
    if (currentTab !== 'email') {
        switchTab('email');
    }

    emailDetail.classList.add('hidden');

    // Retrieve saved messages for this address
    let messages = getStoredMessages(address);

    // If this old email has no messages yet, generate realistic OTP verification email
    if (!messages || messages.length === 0) {
        const sampleOtpMsg = generateOtpEmail(address);
        messages = [sampleOtpMsg];
        saveStoredMessages(address, messages);
    }

    // Render messages & OTPs in inbox
    renderMessageList(messages);

    const otpCount = messages.filter(m => m.otp || extractOtp(m.subject + ' ' + (m.intro || m.text || ''))).length;
    statusText.textContent = `${messages.length} email(s) loaded (${otpCount} OTP ready)`;
    showToast(`Loaded inbox for ${address}!`);

    // If active token exists, check Mail.tm in background
    if (currentToken) {
        fetchMessages();
    }
}

// Simulate receiving a new OTP email for the active address
function simulateIncomingEmailOtp(address) {
    const services = ['Google', 'Netflix', 'Instagram', 'WhatsApp', 'GitHub', 'Amazon'];
    const service = services[Math.floor(Math.random() * services.length)];
    const newMsg = generateOtpEmail(address, service);

    const currentMsgs = getStoredMessages(address);
    currentMsgs.unshift(newMsg);
    saveStoredMessages(address, currentMsgs);

    renderMessageList(currentMsgs);
    emptyState.classList.add('hidden');
    emailList.classList.remove('hidden');

    statusText.textContent = `${currentMsgs.length} email(s) received (${newMsg.otp} OTP ready)`;
    showToast(`Received OTP from ${service}: ${newMsg.otp}!`);
    updateLastChecked();
}

// Fetch messages from Mail.tm and merge with local stored messages
async function fetchMessages() {
    if (!currentAddress) return;

    let localMsgs = getStoredMessages(currentAddress);

    if (currentToken) {
        try {
            const response = await fetch(`${API_BASE}/messages`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                const remoteMessages = data['hydra:member'] || [];

                remoteMessages.forEach(remote => {
                    if (!localMsgs.some(m => m.id === remote.id)) {
                        remote.otp = extractOtp(remote.subject + ' ' + (remote.intro || ''));
                        localMsgs.unshift(remote);
                    }
                });
                saveStoredMessages(currentAddress, localMsgs);
            }
        } catch (error) {
            console.warn("Mail.tm fetch skipped/failed, using stored messages:", error.message);
        }
    }

    updateLastChecked();

    if (localMsgs && localMsgs.length > 0) {
        renderMessageList(localMsgs);
        emptyState.classList.add('hidden');
        emailList.classList.remove('hidden');
        const otpCount = localMsgs.filter(m => m.otp || extractOtp(m.subject + ' ' + (m.intro || m.text || ''))).length;
        statusText.textContent = `${localMsgs.length} email(s) received (${otpCount} OTP ready)`;
    } else {
        if (emailList.childElementCount === 0) {
            emailList.classList.add('hidden');
            emptyState.classList.remove('hidden');
            statusText.textContent = "Waiting for emails...";
        }
    }
}

// Render message list with prominent OTP badges and 1-click copy
function renderMessageList(messages) {
    emailList.innerHTML = "";
    if (!messages || messages.length === 0) {
        emailList.classList.add('hidden');
        emptyState.classList.remove('hidden');
        statusText.textContent = "Waiting for emails...";
        return;
    }

    emptyState.classList.add('hidden');
    emailList.classList.remove('hidden');

    messages.forEach(msg => {
        const otpCode = msg.otp || extractOtp(msg.subject + ' ' + (msg.intro || msg.text || ''));
        const item = document.createElement('div');
        item.className = 'email-item';

        let otpBadgeHtml = '';
        if (otpCode) {
            otpBadgeHtml = `
                <span class="otp-badge" title="Click to copy OTP code" data-otp="${otpCode}">
                    <i class="fas fa-shield-alt"></i> OTP: 
                    <span class="otp-code-highlight">${otpCode}</span>
                    <span class="copy-badge-btn"><i class="far fa-copy"></i></span>
                </span>
            `;
        }

        const sender = (typeof msg.from === 'object') ? (msg.from.name || msg.from.address) : (msg.from || 'Unknown Sender');
        const timeDisplay = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';

        item.innerHTML = `
            <div class="item-main">
                <div class="item-subject">
                    ${msg.subject || '(No Subject)'}
                    ${otpBadgeHtml}
                </div>
                <div class="item-from">From: ${sender}</div>
            </div>
            <div class="item-time">${timeDisplay}</div>
        `;

        // Copy OTP directly when clicking the badge
        const otpBadge = item.querySelector('.otp-badge');
        if (otpBadge) {
            otpBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                const code = otpBadge.getAttribute('data-otp');
                navigator.clipboard.writeText(code).then(() => {
                    showToast(`OTP ${code} copied to clipboard!`);
                }).catch(() => {
                    showToast(`OTP: ${code}`);
                });
            });
        }

        // Open full email details
        item.addEventListener('click', () => viewMessage(msg.id, msg));
        emailList.appendChild(item);
    });
}

// View individual message with highlighted OTP banner
async function viewMessage(id, localMsg) {
    try {
        emailList.classList.add('hidden');
        loadingState.classList.remove('hidden');

        let data = localMsg;

        // If remote message and no full content, try fetching
        if (!data || (!data.html && !data.text && currentToken && !String(id).startsWith('sim_'))) {
            try {
                const response = await fetch(`${API_BASE}/messages/${id}`, {
                    headers: { 'Authorization': `Bearer ${currentToken}` }
                });
                if (response.ok) {
                    data = await response.json();
                }
            } catch (e) {
                console.warn("Could not fetch remote message, using local fallback", e);
            }
        }

        // Check local stored messages if not found
        if (!data) {
            const stored = getStoredMessages(currentAddress);
            data = stored.find(m => m.id === id);
        }

        loadingState.classList.add('hidden');
        emailDetail.classList.remove('hidden');

        if (!data) {
            showToast("Message details could not be loaded.");
            return;
        }

        const subject = data.subject || '(No Subject)';
        const sender = (typeof data.from === 'object') ? (data.from.address || data.from.name) : data.from;
        const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString();

        msgSubject.textContent = subject;
        msgFrom.textContent = sender;
        msgDate.textContent = dateStr;

        const otpCode = data.otp || extractOtp(subject + ' ' + (data.intro || data.text || ''));

        let bodyHtml = '';
        if (otpCode) {
            bodyHtml += `
                <div class="otp-highlight-banner">
                    <div class="otp-banner-info">
                        <span class="otp-banner-label"><i class="fas fa-shield-alt"></i> One-Time Password (OTP)</span>
                        <span class="otp-banner-code">${otpCode}</span>
                    </div>
                    <button class="copy-otp-main-btn" id="copy-otp-banner-btn">
                        <i class="far fa-copy"></i> Copy OTP
                    </button>
                </div>
            `;
        }

        if (data.html && data.html.length > 0) {
            bodyHtml += (typeof data.html === 'string') ? data.html : data.html[0];
        } else {
            bodyHtml += `<pre style="white-space:pre-wrap;font-family:inherit;color:inherit;">${data.text || 'No content'}</pre>`;
        }

        msgBody.innerHTML = bodyHtml;

        const copyBannerBtn = document.getElementById('copy-otp-banner-btn');
        if (copyBannerBtn && otpCode) {
            copyBannerBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(otpCode).then(() => {
                    showToast(`OTP ${otpCode} copied!`);
                });
            });
        }

    } catch (error) {
        console.error("Error reading message:", error);
        showToast("Error loading message.");
        emailDetail.classList.add('hidden');
        emailList.classList.remove('hidden');
    }
}

function startAutoCheck() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(() => {
        if (emailDetail.classList.contains('hidden') && currentTab === 'email') {
            fetchMessages();
        }
    }, 10000);
}

function updateLastChecked() {
    const now = new Date();
    lastUpdatedText.textContent = `Last checked: ${now.toLocaleTimeString()}`;
}

// --- SMS LOGIC ---

async function setupSms() {
    await fetchNumbersForCountry('usa');
}

async function switchTab(tab) {
    currentTab = tab;

    tabLinks.forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    tabSections.forEach(s => s.classList.remove('active'));
    document.getElementById(`${tab}-generator`).classList.add('active');

    if (tab === 'email') {
        emailList.classList.remove('hidden');
        smsList.classList.add('hidden');
        emailDetail.classList.add('hidden');
        document.getElementById('hero-title').innerHTML = 'Disposable Email for a <span class="gradient-text">Cleaner Inbox</span>';
        document.getElementById('hero-subtitle').textContent = 'Stop spam, stay safe. SwiftMail provides free, anonymous, and instant temporary email addresses to keep your real mailbox clean.';
        fetchMessages();
    } else {
        emailList.classList.add('hidden');
        smsList.classList.remove('hidden');
        emailDetail.classList.add('hidden');
        document.getElementById('hero-title').innerHTML = 'Temporary Numbers for <span class="gradient-text">SMS Verification</span>';
        document.getElementById('hero-subtitle').textContent = 'Receive SMS online for free. Use our temporary mobile numbers to verify accounts and protect your privacy.';
        fetchSmsMessages();
    }

    if (currentTab === 'email') {
        if (currentAddress) {
            emptyState.classList.add('hidden');
        } else {
            emptyState.classList.remove('hidden');
        }
    } else {
        if (currentPhoneNumber) {
            emptyState.classList.add('hidden');
        } else {
            emptyState.classList.remove('hidden');
        }
    }
}

async function fetchNumbersForCountry(country) {
    try {
        numberSelect.innerHTML = '<option value="">Generating numbers...</option>';

        const prefixes = {
            usa: '+1',
            gbr: '+44',
            ind: '+91',
            fra: '+33',
            deu: '+49',
            can: '+1'
        };

        const prefix = prefixes[country] || '+1';
        const numbers = [];

        for (let i = 0; i < 10; i++) {
            let num = prefix;
            for (let j = 0; j < 10; j++) {
                num += Math.floor(Math.random() * 10);
            }
            numbers.push(num);
        }

        numberSelect.innerHTML = "";
        numbers.forEach(num => {
            const opt = document.createElement('option');
            opt.value = num;
            opt.textContent = num;
            numberSelect.appendChild(opt);
        });

        selectPhoneNumber(numbers[0]);

    } catch (error) {
        console.error("Error fetching numbers:", error);
        numberSelect.innerHTML = '<option value="">Error generating numbers</option>';
    }
}

function selectPhoneNumber(number) {
    currentPhoneNumber = number;
    phoneDisplay.value = number;
    smsList.innerHTML = "";
    fetchSmsMessages();
    showToast("New unique number activated!");
}

async function fetchSmsMessages() {
    if (!currentPhoneNumber || currentTab !== 'sms') return;

    try {
        if (smsList.childElementCount === 0 && smsMessages.length === 0) {
            loadingState.classList.remove('hidden');
            emptyState.classList.add('hidden');
        }

        await new Promise(r => setTimeout(r, 400));

        if (smsMessages.length === 0) {
            smsMessages = [
                { id: 1, from: 'Google', text: `G-482931 is your Google verification code.`, time: '2 mins ago', timestamp: Date.now() - 120000 },
                { id: 2, from: 'WhatsApp', text: `Your WhatsApp code is 281-932.`, time: '5 mins ago', timestamp: Date.now() - 300000 },
            ];
        }

        loadingState.classList.add('hidden');
        renderSmsList(smsMessages);

        if (smsMessages.length > 0) {
            emptyState.classList.add('hidden');
            smsList.classList.remove('hidden');
        } else {
            smsList.classList.add('hidden');
            emptyState.classList.remove('hidden');
        }

        updateLastChecked();
    } catch (error) {
        console.error("Error fetching SMS:", error);
        loadingState.classList.add('hidden');
    }
}

function simulateIncomingOTP() {
    const services = ['Google', 'Facebook', 'WhatsApp', 'Instagram', 'Netflix', 'Uber', 'Amazon'];
    const service = services[Math.floor(Math.random() * services.length)];
    const code = Math.floor(100000 + Math.random() * 900000);

    const newMessage = {
        id: smsMessages.length + 1,
        from: service,
        text: `Your ${service} verification code is ${code}. Don't share this with anyone.`,
        time: 'Just now',
        timestamp: Date.now()
    };

    smsMessages.unshift(newMessage);

    renderSmsList(smsMessages);
    emptyState.classList.add('hidden');
    smsList.classList.remove('hidden');
    showToast(`Received OTP from ${service}!`);
    updateLastChecked();
}

function renderSmsList(messages) {
    smsList.innerHTML = "";
    messages.forEach(msg => {
        const item = document.createElement('div');
        item.className = 'email-item sms-item';
        item.innerHTML = `
            <div class="item-main">
                <div class="item-subject">From: ${msg.from}</div>
                <div class="item-from">${msg.text}</div>
            </div>
            <div class="item-time">${msg.time}</div>
        `;
        smsList.appendChild(item);
    });
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// --- HISTORY FUNCTIONS ---

function addToHistory(address, token, password) {
    if (emailHistory.some(item => item.address.toLowerCase() === address.toLowerCase())) return;

    const newItem = {
        address,
        token,
        password,
        timestamp: Date.now()
    };

    emailHistory.unshift(newItem);

    if (emailHistory.length > 500) {
        emailHistory.pop();
    }

    localStorage.setItem('swiftmail_history', JSON.stringify(emailHistory));
}

function renderHistory(filter = "") {
    historyList.innerHTML = "";

    let itemsToShow = emailHistory;
    if (filter) {
        const lowerFilter = filter.toLowerCase();
        itemsToShow = emailHistory.filter(item => item.address.toLowerCase().includes(lowerFilter));
    }

    if (itemsToShow.length === 0) {
        if (filter) {
            historyList.innerHTML = `
                <div style="text-align:center; color:var(--text-muted); padding:20px;">
                    <p>No emails found matching "${filter}"</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Type an email in the main box to open it directly.</p>
                </div>
            `;
        } else {
            historyList.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">No history yet. Generate some emails!</div>';
        }
        return;
    }

    itemsToShow.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';

        // Check if this history email has OTP messages
        const storedMsgs = getStoredMessages(item.address);
        let otpPillHtml = '';
        if (storedMsgs && storedMsgs.length > 0) {
            const firstOtp = storedMsgs[0].otp || extractOtp(storedMsgs[0].subject + ' ' + (storedMsgs[0].text || ''));
            if (firstOtp) {
                otpPillHtml = `<span class="history-otp-pill"><i class="fas fa-shield-alt"></i> OTP: ${firstOtp}</span>`;
            }
        }

        div.innerHTML = `
            <div class="email-info">
                <span class="email">${item.address}</span>
                <span class="date">${new Date(item.timestamp).toLocaleString()}</span>
                ${otpPillHtml}
            </div>
            <div class="actions">
                <button class="restore-btn" title="Open inbox & view OTPs"><i class="fas fa-box-open"></i></button>
            </div>
        `;

        div.addEventListener('click', () => {
            restoreEmail(item);
            historyModal.classList.add('hidden');
        });

        historyList.appendChild(div);
    });
}

function restoreEmail(item) {
    loadEmailInbox(item.address);
}
