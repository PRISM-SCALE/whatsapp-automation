class WhatsAppBotApp {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = null;
        this.socket = null;
        this.startTime = null;
        this.stats = {
            messagesSent: 0,
            uniqueContacts: new Set(),
            uptime: 0
        };
        this.init();
    }

    init() {
        if (this.token) {
            this.checkAuth();
        } else {
            this.showAuth();
        }

        // Start uptime counter
        this.startUptimeCounter();
    }

    startUptimeCounter() {
        setInterval(() => {
            if (this.startTime) {
                const now = new Date();
                const diff = now - this.startTime;
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                document.getElementById('uptime').textContent = `${hours}h ${minutes}m`;
            }
        }, 60000); // Update every minute
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/bot/status', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.showDashboard();
                this.initSocket();
                this.updateStatus(data);
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
        }
    }

    showAuth() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
        document.getElementById('user-info').classList.add('hidden');
    }

    showDashboard() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        document.getElementById('user-info').classList.remove('hidden');
        this.startTime = new Date();
    }

    initSocket() {
        this.socket = io();

        // Get user ID from token
        const payload = JSON.parse(atob(this.token.split('.')[1]));
        const userId = payload.userId;

        this.socket.on(`qr_${userId}`, (qrCode) => {
            this.showQRCode(qrCode);
        });

        this.socket.on(`ready_${userId}`, () => {
            this.hideQRCode();
            this.showControlPanel();
            this.updateStatusBadge('Connected', 'bg-green-500');
        });

        this.socket.on(`disconnected_${userId}`, () => {
            this.showQRSection();
            this.hideControlPanel();
            this.updateStatusBadge('Disconnected', 'bg-red-500');
        });

        this.socket.on(`activity_${userId}`, (activity) => {
            this.addActivityLog(activity);
        });
    }

    async login() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('token', this.token);
                this.user = data.user;
                this.showDashboard();
                this.initSocket();
                this.checkBotStatus();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed');
        }
    }

    async register() {
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('token', this.token);
                this.user = data.user;
                this.showDashboard();
                this.initSocket();
                this.showQRSection();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Registration failed:', error);
            alert('Registration failed');
        }
    }

    async checkBotStatus() {
        try {
            const response = await fetch('/api/bot/status', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateStatus(data);
            }
        } catch (error) {
            console.error('Status check failed:', error);
        }
    }

    updateStatus(data) {
        document.getElementById('auto-reply-message').value = data.autoReplyMessage;

        if (data.isActive) {
            this.showControlPanel();
            this.updateStatusBadge('Connected', 'bg-green-500');
            document.getElementById('pause-btn').textContent = data.isPaused ? 'Resume Bot' : 'Pause Bot';
        } else {
            this.showQRSection();
        }

        this.loadActivity();
    }

    showQRSection() {
        document.getElementById('qr-section').classList.remove('hidden');
        document.getElementById('control-panel').classList.add('hidden');
    }

    showControlPanel() {
        document.getElementById('qr-section').classList.add('hidden');
        document.getElementById('control-panel').classList.remove('hidden');
    }

    hideQRCode() {
        document.getElementById('qr-section').classList.add('hidden');
    }

    hideControlPanel() {
        document.getElementById('control-panel').classList.add('hidden');
    }

    showQRCode(qrCode) {
        document.getElementById('qr-code').innerHTML = `<img src="${qrCode}" alt="QR Code" class="mx-auto">`;
        document.getElementById('qr-section').classList.remove('hidden');
    }

    updateStatusBadge(text, className) {
        const badge = document.getElementById('status-badge');
        badge.textContent = text;
        badge.className = `inline-block px-3 py-1 rounded-full text-sm font-medium text-white ${className}`;
    }

    async startSession() {
        try {
            // Emit websocket event to trigger QR code generation
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const userId = payload.userId;
            if (this.socket) {
                this.socket.emit('start_session', { userId });
            }

            // Also call the REST API to start the session
            const response = await fetch('/api/bot/start-session', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.updateStatusBadge('Connecting...', 'bg-yellow-500');
            }
        } catch (error) {
            console.error('Start session failed:', error);
        }
    }

    async stopSession() {
        try {
            const response = await fetch('/api/bot/stop-session', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.showQRSection();
                this.updateStatusBadge('Disconnected', 'bg-red-500');
            }
        } catch (error) {
            console.error('Stop session failed:', error);
        }
    }

    async updateMessage() {
        const message = document.getElementById('auto-reply-message').value;

        try {
            const response = await fetch('/api/bot/message', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ message })
            });

            if (response.ok) {
                alert('Message updated successfully');
            } else {
                const data = await response.json();
                alert(data.error);
            }
        } catch (error) {
            console.error('Update message failed:', error);
        }
    }

    async togglePause() {
        try {
            const response = await fetch('/api/bot/toggle-pause', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById('pause-btn').textContent = data.isPaused ? 'Resume Bot' : 'Pause Bot';
                alert(data.message);
            }
        } catch (error) {
            console.error('Toggle pause failed:', error);
        }
    }

    async loadActivity() {
        try {
            const response = await fetch('/api/bot/activity', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.displayActivity(data.logs);
            }
        } catch (error) {
            console.error('Load activity failed:', error);
        }
    }

    displayActivity(logs) {
        const container = document.getElementById('activity-log');

        if (logs.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No activity yet</p>';
            return;
        }

        container.innerHTML = logs.map(log => `
            <div class="border-l-4 border-blue-500 pl-4 py-2">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-medium">+${log.contact_number}</p>
                        <p class="text-sm text-gray-600">Received: "${log.message_received}"</p>
                        <p class="text-sm text-green-600">Replied: "${log.reply_sent}"</p>
                    </div>
                    <span class="text-xs text-gray-500">${new Date(log.timestamp).toLocaleString()}</span>
                </div>
            </div>
        `).join('');
    }

    addActivityLog(activity) {
        const container = document.getElementById('activity-log');
        const newLog = document.createElement('div');
        newLog.className = 'border-l-4 border-blue-500 pl-4 py-2';
        newLog.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-medium">+${activity.contactNumber}</p>
                    <p class="text-sm text-gray-600">Received: "${activity.messageReceived}"</p>
                    <p class="text-sm text-green-600">Replied: "${activity.replySent}"</p>
                </div>
                <span class="text-xs text-gray-500">${new Date(activity.timestamp).toLocaleString()}</span>
            </div>
        `;

        if (container.firstChild && container.firstChild.tagName !== 'P') {
            container.insertBefore(newLog, container.firstChild);
        } else {
            container.innerHTML = '';
            container.appendChild(newLog);
        }
    }

    logout() {
        localStorage.removeItem('token');
        this.token = null;
        this.user = null;
        if (this.socket) {
            this.socket.disconnect();
        }
        this.showAuth();
    }
}

// Global functions for HTML onclick handlers
let app;

function login() {
    app.login();
}

function register() {
    app.register();
}

function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
}

function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
}

function startSession() {
    app.startSession();
}

function stopSession() {
    app.stopSession();
}

function updateMessage() {
    app.updateMessage();
}

function togglePause() {
    app.togglePause();
}

function loadActivity() {
    app.loadActivity();
}

function logout() {
    app.logout();
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new WhatsAppBotApp();
});
