// MMDCARE AI Therapist Application
const app = {
    state: {
        currentUser: null,
        isAnonymous: false,
        currentLanguage: 'en',
        messages: [],
        isTyping: false,
        theme: 'light',
        feedbackRating: 0
    },

    safety: {
        crisisKeywords: ['die', 'suicide', 'suicidal', 'kill myself', 'end my life', 'self-harm', 'cutting', 'overdose'],
        blockedContent: ['medication', 'meds', 'drug', 'pills', 'prescription', 'dosage', 'xanax', 'prozac', 'zoloft'],
        harmfulAdvice: ['hurt yourself', 'harm yourself', 'don\'t eat', 'stop eating', 'isolate yourself']
    },

    init() {
        this.loadTheme();
        this.loadUser();
        const savedLang = localStorage.getItem('mmdcare_language');
        if (savedLang) this.changeLanguage(savedLang);
    },

    escapeHtml(str) {
        return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    showToast(msg) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        if (toast && toastMessage) {
            toastMessage.textContent = msg;
            toast.classList.remove('opacity-0');
            setTimeout(() => toast.classList.add('opacity-0'), 3000);
        }
    },

    // Retrieve previous conversations from MySQL
    async loadConversations() {
        if (!this.state.currentUser || this.state.isAnonymous) return;

        try {
            const response = await fetch(`/api/chats/${encodeURIComponent(this.state.currentUser.email)}`);
            if (response.ok) {
                const history = await response.json();
                this.state.messages = history.map(m => ({ text: m.text, sender: m.sender, timestamp: m.timestamp }));
                this.renderHistoryMessages();
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    },

    renderHistoryMessages() {
        const container = document.getElementById('chatMessages').querySelector('.max-w-4xl');
        container.querySelectorAll('.dynamic-msg').forEach(el => el.remove());

        this.state.messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'flex gap-4 animate-fade-in dynamic-msg';

            if (msg.sender === 'user') {
                messageDiv.classList.add('flex-row-reverse');
                messageDiv.innerHTML = `
                    <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-sage-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                        <span class="text-white font-bold">${this.state.currentUser.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="message-bubble user-message bg-gradient-to-r from-lavender-500 to-primary-500 text-white rounded-2xl rounded-tr-none px-5 py-4">
                        <p class="leading-relaxed">${this.escapeHtml(msg.text)}</p>
                    </div>`;
            } else {
                messageDiv.innerHTML = `
                    <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-lavender-400 to-primary-400 flex items-center justify-center flex-shrink-0">
                        <i data-lucide="heart-handshake" class="w-5 h-5 text-white"></i>
                    </div>
                    <div class="message-bubble ai-message bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-tl-none px-5 py-4">
                        <p class="text-slate-800 dark:text-slate-200 leading-relaxed">${msg.text}</p>
                    </div>`;
            }
            container.appendChild(messageDiv);
        });

        this.scrollToBottom();
        if (window.lucide) lucide.createIcons();
    },

    loadTheme() {
        const savedTheme = localStorage.getItem('mmdcare_theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            this.state.theme = 'dark';
        }
    },

    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        this.state.theme = isDark ? 'dark' : 'light';
        localStorage.setItem('mmdcare_theme', this.state.theme);
    },

    changeLanguage(lang) {
        this.state.currentLanguage = lang;
        localStorage.setItem('mmdcare_language', lang);
        document.documentElement.lang = lang;
        const langSelect = document.getElementById('languageSelect');
        if (langSelect) langSelect.value = lang;
        if (window.lucide) lucide.createIcons();
    },

    loadUser() {
        const savedUser = localStorage.getItem('mmdcare_user');
        if (savedUser) {
            this.state.currentUser = JSON.parse(savedUser);
            this.updateAuthUI();
        }
    },

    openAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) modal.classList.remove('hidden');
    },

    closeAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) modal.classList.add('hidden');
    },

    async handleSignIn(event) {
        event.preventDefault();
        const name = document.getElementById('authName').value.trim();
        const email = document.getElementById('authEmail').value.trim();

        if (name && email) {
            try {
                const response = await fetch('/api/users/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, name })
                });

                if (response.ok) {
                    const user = await response.json();
                    this.state.currentUser = { name: user.name, email: user.email };
                    this.state.isAnonymous = false;
                    localStorage.setItem('mmdcare_user', JSON.stringify(this.state.currentUser));
                    this.updateAuthUI();
                    this.closeAuthModal();
                    this.showToast(`Welcome back, ${name}! 💜`);
                    await this.loadConversations();
                }
            } catch (err) {
                console.error('Sign-in error:', err);
                this.showToast('Login failed. Please check network.');
            }
        }
    },

    continueAnonymous() {
        this.state.isAnonymous = true;
        this.state.currentUser = { name: 'Anonymous', email: 'anonymous@mmdcare.com' };
        this.closeAuthModal();
        this.showToast('Browsing anonymously.');
    },

    signOut() {
        this.state.currentUser = null;
        this.state.isAnonymous = false;
        this.state.messages = [];
        localStorage.removeItem('mmdcare_user');
        this.updateAuthUI();
        this.showToast('Signed out successfully');
    },

    updateAuthUI() {
        const authBtn = document.getElementById('authButton');
        const userProf = document.getElementById('userProfile');
        if (this.state.currentUser) {
            if (authBtn) authBtn.classList.add('hidden');
            if (userProf) userProf.classList.remove('hidden');
            document.getElementById('userNameDisplay').textContent = this.state.currentUser.name;
            document.getElementById('userAvatar').textContent = this.state.currentUser.name.charAt(0).toUpperCase();
        } else {
            if (authBtn) authBtn.classList.remove('hidden');
            if (userProf) userProf.classList.add('hidden');
        }
    },

    async startChat() {
        if (!this.state.currentUser) {
            this.openAuthModal();
            return;
        }
        document.getElementById('chatInterface').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (!this.state.isAnonymous) await this.loadConversations();
    },

    closeChat() {
        document.getElementById('chatInterface').classList.add('hidden');
        document.body.style.overflow = '';
    },

    async sendMessage(event) {
        event.preventDefault();
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        if (!message || this.state.isTyping) return;

        this.addMessage(message, 'user');
        input.value = '';

        if (this.checkCrisisKeywords(message)) {
            this.showEmergencyBanner();
            return;
        }

        this.showTyping();

        try {
            const response = await this.getAIResponse(message);
            this.hideTyping();
            this.addMessage(response, 'ai');
        } catch (error) {
            this.hideTyping();
            this.addMessage('I apologize, but I\'m having trouble responding right now. Please try again.', 'ai');
        }
    },

    addMessage(text, sender) {
        const container = document.getElementById('chatMessages').querySelector('.max-w-4xl');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex gap-4 animate-fade-in dynamic-msg';

        if (sender === 'user') {
            messageDiv.classList.add('flex-row-reverse');
            messageDiv.innerHTML = `
                <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-sage-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <span class="text-white font-bold">${this.state.currentUser.name.charAt(0).toUpperCase()}</span>
                </div>
                <div class="message-bubble user-message bg-gradient-to-r from-lavender-500 to-primary-500 text-white rounded-2xl rounded-tr-none px-5 py-4">
                    <p class="leading-relaxed">${this.escapeHtml(text)}</p>
                </div>`;
        } else {
            messageDiv.innerHTML = `
                <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-lavender-400 to-primary-400 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="heart-handshake" class="w-5 h-5 text-white"></i>
                </div>
                <div class="message-bubble ai-message bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-tl-none px-5 py-4">
                    <p class="text-slate-800 dark:text-slate-200 leading-relaxed">${text}</p>
                </div>`;
        }

        container.appendChild(messageDiv);
        this.scrollToBottom();
        if (window.lucide) lucide.createIcons();
        this.state.messages.push({ text, sender, timestamp: Date.now() });
    },

    showTyping() {
        this.state.isTyping = true;
        document.getElementById('typingIndicator').classList.remove('hidden');
        this.scrollToBottom();
    },

    hideTyping() {
        this.state.isTyping = false;
        document.getElementById('typingIndicator').classList.add('hidden');
    },

    scrollToBottom() {
        const container = document.getElementById('chatMessages');
        if (container) container.scrollTop = container.scrollHeight;
    },

    checkCrisisKeywords(message) {
        return this.safety.crisisKeywords.some(k => message.toLowerCase().includes(k));
    },

    showEmergencyBanner() {
        document.getElementById('emergencyBanner').classList.remove('hidden');
    },

    closeEmergencyBanner() {
        document.getElementById('emergencyBanner').classList.add('hidden');
    },

async getAIResponse(userMessage) {
        const lowerMessage = userMessage.toLowerCase();

        // Safety check: Block medication queries safely
        if (this.safety.blockedContent.some(word => lowerMessage.includes(word))) {
            return this.getMedicationResponse();
        }

        // Safety check: Block harm recommendations
        if (this.safety.harmfulAdvice.some(phrase => lowerMessage.includes(phrase))) {
            return this.getHarmPreventionResponse();
        }

        try {
            // Send request to Express backend Proxy (/api/chat)
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userEmail: this.state.currentUser ? this.state.currentUser.email : 'anonymous@mmdcare.com',
                    userMessage: userMessage,
                    userLanguage: this.state.currentLanguage,
                    messages: this.state.messages.slice(-6).map(m => ({
                        role: m.sender === 'user' ? 'user' : 'assistant',
                        content: m.text
                    }))
                })
            });

            if (!response.ok) {
                throw new Error(`Server returned status: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (error) {
            console.error('Fetch error calling /api/chat backend:', error);
            return "I'm having trouble connecting to my AI service right now. Please try again in a moment.";
        }
    
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());